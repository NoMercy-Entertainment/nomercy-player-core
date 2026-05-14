import type { BasePlaylistItem, BasePlayerConfig, PlayerPhase } from '../../types';
import { SetupState } from '../../types';
import type { IPlatform } from '../../platform';
import type { PreloadAsset, PreloadStrategy, TransitionBackend } from '../../preload-strategy';
import { DefaultPreloadStrategy } from '../../preload-strategy';
import { builtInCueParsers } from '../../cues/parsers/built-ins';
import { hlsFactory } from '../../streams/hls';
import { nativeFactory } from '../../streams/native';
import { StreamRegistry } from '../../streams/registry';
import { browserPlatform } from '../../platform';
import { DefaultTranslator } from '../../translator';

import { stateError } from '../../errors';
import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: lifecycle — owns the player's birth, ready signal, and death.
// `setup()` wires every cross-cutting concern (visibility / network / wakeLock
// policies, metrics, progress emit, preload + transition orchestration) and
// kicks off the async pipeline that fires `ready`. `dispose()` tears the same
// wiring down via the cleanup queue each `_wire*` helper pushed onto it.
// ──────────────────────────────────────────────────────────────────────────

export const lifecycleMethods = {
	/**
	 * Configure the player and start the async setup pipeline.
	 *
	 * Synchronously: normalises options (debug / accessToken back-compat shims),
	 * seeds internal state from config, wires every cross-cutting concern
	 * (visibility, network, wake-lock, metrics, progress, preload+transition,
	 * window expose), and emits `beforeSetup` followed by a `setup` phase
	 * transition.
	 *
	 * Asynchronously: fires the setup pipeline (`setupStart` → `configResolved`
	 * → `pluginsRegistering` → `pluginsRegistered` → `streamsReady` → `authReady`
	 * → `playlistReady` → `mediaReady` → `ready`). Each stage emits its name on
	 * success or a `<stage>Error` event on failure, then rejects the `ready()`
	 * promise.
	 *
	 * Throws `core:lifecycle/already-setup` if called twice without `dispose()`
	 * in between, or `core:player/disposed` if called after dispose. Returns
	 * the player instance so callers can chain.
	 */
	setup(this: Internals, config: BasePlayerConfig): unknown {
		_guardSetup(this);
		this._setupCalled = true;

		_normalizeOptions(this, config);
		_seedFromOptions(this);
		_initTranslator(this);
		_registerCueParsers(this);
		_resolvePlatform(this);

		_wireVisibilityPolicy(this);
		_wireNetworkPolicy(this);
		_wireWakeLockPolicy(this);
		_wireMetrics(this);
		_wireTimeAndDurationSync(this);
		_wireProgressEmit(this);
		_wirePreloadAndTransition(this);
		_wireWindowExpose(this);
		_initContainerClass(this);

		this.emit('beforeSetup');
		this._transitionPhase('setup');
		_runSetupPipeline(this);

		return this;
	},

	/**
	 * Returns a promise that resolves when the setup pipeline reaches the
	 * `ready` stage, or rejects if any stage fails or `dispose()` is called
	 * first. Memoised — repeated calls return the same promise.
	 *
	 * Already in `'ready'` phase? Resolves immediately. Already disposed?
	 * Rejects immediately with `core:player/disposed`.
	 */
	ready(this: Internals): Promise<void> {
		if (this._readyPromise)
			return this._readyPromise;
		this._readyPromise = new Promise<void>((resolve, reject) => {
			if (this._phase === 'ready') {
				resolve();
				return;
			}
			if (this._phase === 'disposed' || this._phase === 'disposing') {
				reject(stateError('core:player/disposed', 'ready() called after dispose()'));
				return;
			}
			this._readyResolve = resolve;
			this._readyReject = reject;
		});
		return this._readyPromise;
	},

	/**
	 * Tear down the player. Idempotent — a second call is a no-op.
	 *
	 * Drains the policy cleanup queue (everything `setup()`'s `_wire*` helpers
	 * registered: subscriptions, event listeners, intervals, RAF handles) BEFORE
	 * emitting `dispose`, so handlers observing the transition see a sensible
	 * final state. Phase moves `→ disposing → disposed`, the `ready()` promise
	 * rejects if it hadn't resolved yet, and all listeners are removed.
	 *
	 * After this call the instance is dead — re-setup requires constructing a
	 * new player.
	 */
	dispose(this: Internals): void {
		if (this._phase === 'disposed' || this._phase === 'disposing')
			return;
		this._transitionPhase('disposing');
		for (const cleanup of this._policyCleanup) {
			try {
				cleanup();
			}
			catch { /* defensive — never let teardown errors escape */ }
		}
		this._policyCleanup = [];
		this._readyReject?.(stateError('core:player/disposed', 'dispose() called before ready'));
		this.emit('dispose');
		this._transitionPhase('disposed');
		this.off('all');
	},

	/**
	 * High-level setup status as a `SetupState` enum value. Coarser than `phase()`:
	 * `'idle'` → `NOT_SETUP`, `'setup'` → `SETTING_UP`, `'disposing'`/`'disposed'`
	 * → `DISPOSED`, anything else (loading / ready / playing / paused / etc.)
	 * → `READY`. Useful for "is the player usable right now?" checks.
	 */
	setupState(this: Internals): SetupState {
		switch (this._phase) {
			case 'idle':
				return SetupState.NOT_SETUP;
			case 'setup':
				return SetupState.SETTING_UP;
			case 'disposing':
			case 'disposed':
				return SetupState.DISPOSED;
			default:
				return SetupState.READY;
		}
	},

	/** Current fine-grained player phase (idle / setup / loading / ready / playing / paused / ...). */
	phase(this: Internals): PlayerPhase {
		return this._phase;
	},

	/**
	 * Names of all events currently being dispatched, outermost first.
	 * Populated by `pushDispatch` / `popDispatch` around event emission;
	 * read by `beforeMutation` advisories that gate on which event chain
	 * they're inside.
	 */
	dispatching(this: Internals): ReadonlyArray<string> {
		return [...this._dispatchStack];
	},

	/**
	 * Push an event name onto the dispatch stack. Used by the shared
	 * `runDispatchBefore` helper from both kit transport mixins AND
	 * `Plugin.dispatchBefore`. Pairs with `popDispatch`.
	 */
	pushDispatch(this: Internals, name: string): void {
		this._dispatchStack.push(name);
	},

	/** Pop the most recently pushed dispatch name. Returns the popped name or `undefined`. */
	popDispatch(this: Internals): string | undefined {
		return this._dispatchStack.pop();
	},

	/**
	 * The platform bundle (visibility / network / wake-lock / fullscreen / etc.).
	 * Defaults to `browserPlatform`; consumers swap via `setup({ platform: ... })`
	 * for Capacitor / Tauri / Electron or to mock for tests. Returns the default
	 * even before `setup()` has run so early reads don't need a null check.
	 */
	platform(this: Internals): IPlatform {
		return this._platform ?? browserPlatform;
	},
} as const;


// ──────────────────────────────────────────────────────────────────────────
// Setup phase helpers — invoked in order by setup() above
// ──────────────────────────────────────────────────────────────────────────

/** Reject re-entry or post-dispose `setup()` calls with a typed StateError. */
function _guardSetup(self: Internals): void {
	if (self._setupCalled) {
		throw stateError('core:lifecycle/already-setup', 'setup() called twice. Re-setup requires dispose() first.');
	}
	if (self._phase === 'disposed' || self._phase === 'disposing') {
		throw stateError('core:player/disposed', 'setup() called after dispose().');
	}
}

/**
 * Snapshot the config onto `self.options` and apply v1 → v2 back-compat shims:
 *  - `debug: true` upgrades to `logLevel: 'debug'` (only when logLevel is unset).
 *  - top-level `accessToken` folds into `auth.bearerToken` (only when bearerToken
 *    is unset). Explicit auth always wins.
 */
function _normalizeOptions(self: Internals, config: BasePlayerConfig): void {
	self.options = { ...config };

	if (self.options.debug === true && self.options.logLevel === undefined) {
		self.options.logLevel = 'debug';
	}

	if (self.options.accessToken !== undefined) {
		const existing = self.options.auth ?? {};
		if (existing.bearerToken === undefined) {
			self.options.auth = {
				...existing,
				bearerToken: self.options.accessToken,
			};
		}
	}
}

/** Copy options that runtime methods read directly into their `self._*` slots. */
function _seedFromOptions(self: Internals): void {
	// Authoritative auth copy — `auth(config)` and `auth(partial)` mutators
	// write here, the auth-fetch pipeline reads here.
	self._authConfig = self.options.auth ? { ...self.options.auth } : undefined;

	self._urlResolver = self.options.urlResolver;

	if (self.options.baseUrl)
		self._baseUrl = self.options.baseUrl;

	if (typeof self.options.defaultVolume === 'number') {
		self._internalVolume = Math.max(0, Math.min(1, self.options.defaultVolume));
		self._volumeBeforeMute = self._internalVolume;
	}
}

function _initTranslator(self: Internals): void {
	self._translator = self.options.translator ?? new DefaultTranslator({
		language: self.options.language,
		translations: self.options.translations,
		loadTranslations: self.options.loadTranslations,
		onMissingTranslation: self.options.onMissingTranslation,
	});
}

/**
 * Register cue parsers in priority order. Built-ins (LRC, VTT-subtitle,
 * sprite-VTT) go first so consumer-supplied parsers registered after them win
 * resolution — the registry walks newest-first.
 */
function _registerCueParsers(self: Internals): void {
	for (const parser of builtInCueParsers) {
		self._cueParsers.register(parser);
	}
	if (self.options.cueParsers) {
		for (const parser of self.options.cueParsers) {
			self._cueParsers.register(parser);
		}
	}
}

function _resolvePlatform(self: Internals): void {
	self._platform = self.options.platform ?? browserPlatform;
}

/**
 * Pause playback when the page goes hidden. Emits `visibility:visible` /
 * `visibility:hidden` regardless of the pause action. Opt-in via
 * `options.pauseWhenHidden` (default off).
 */
function _wireVisibilityPolicy(self: Internals): void {
	if (!self.options.pauseWhenHidden) return;

	const platform = self._platform ?? browserPlatform;
	const unsubscribe = platform.visibility.subscribe((visible) => {
		if (!visible) {
			self.pause({ source: 'platform' }).catch(() => { /* swallow */ });
		}
		if (visible) {
			self.emit('visibility:visible');
		}
		else {
			self.emit('visibility:hidden');
		}
	});
	self._policyCleanup.push(unsubscribe);
}

/**
 * React to network state changes per `options.onOffline`:
 *  - `'pause'`              — calls `pause()` when offline.
 *  - `'continue-buffered'`  — emits `network:offline` but doesn't touch transport (default).
 *  - `'ignore'`             — no subscription, no emit.
 * `network:online` fires on reconnect in all non-ignore modes.
 */
function _wireNetworkPolicy(self: Internals): void {
	const onOffline = self.options.onOffline ?? 'continue-buffered';
	if (onOffline === 'ignore') return;

	const platform = self._platform ?? browserPlatform;
	const unsubscribe = platform.network.subscribe((state) => {
		if (state.online) {
			self.emit('network:online');
		}
		else {
			self.emit('network:offline');
			if (onOffline === 'pause') {
				self.pause({ source: 'platform' }).catch(() => { /* swallow */ });
			}
		}
	});
	self._policyCleanup.push(unsubscribe);
}

/**
 * Hold a screen wake lock so the device doesn't sleep during playback.
 * `options.wakeLock`:
 *  - `'never'`   — never acquire (default).
 *  - `'always'`  — acquire at setup, release at dispose.
 *  - `'auto'`    — follow phase transitions: acquire on `'playing'`/`'starting'`,
 *                  release on `'paused'`/`'stopped'`/`'ended'`/`'disposed'`.
 * All acquire/release calls swallow errors — wake-lock is best-effort.
 */
function _wireWakeLockPolicy(self: Internals): void {
	const wakeLockPolicy = self.options.wakeLock ?? 'never';
	const platform = self._platform ?? browserPlatform;

	if (wakeLockPolicy === 'always') {
		void platform.wakeLock.acquire().catch(() => { /* unsupported */ });
		self._policyCleanup.push(() => {
			void platform.wakeLock.release().catch(() => { /* defensive */ });
		});
	}
	else if (wakeLockPolicy === 'auto') {
		const phaseHandler = ({ to }: { to: PlayerPhase }): void => {
			if (to === 'playing' || to === 'starting') {
				if (!platform.wakeLock.isHeld()) {
					void platform.wakeLock.acquire().catch(() => { /* unsupported */ });
				}
			}
			else if (to === 'paused' || to === 'stopped' || to === 'ended' || to === 'disposed') {
				if (platform.wakeLock.isHeld()) {
					void platform.wakeLock.release().catch(() => { /* defensive */ });
				}
			}
		};
		self.on('phase', phaseHandler);
		self._policyCleanup.push(() => {
			self.off('phase', phaseHandler);
			if (platform.wakeLock.isHeld()) {
				void platform.wakeLock.release().catch(() => { /* defensive */ });
			}
		});
	}
}

/**
 * Wire the playback-metrics pipeline. Three signals get populated as the
 * player runs:
 *  - `ttff`           — milliseconds from first `play()` to first `firstFrame`.
 *                       Single-shot; only the first play→frame pair counts.
 *  - `joinTime`       — milliseconds from setup() to first `firstFrame`.
 *  - `rebufferRatio`  — cumulative stall time ÷ session duration. Stall starts
 *                       on `backend:waiting`, ends on `backend:loaded` or `play`.
 *
 * On a non-zero `options.metricsIntervalMs` (default 10s), `playback:metrics`
 * fires periodically carrying the current snapshot (with `sessionDurationMs`
 * refreshed). All listeners and the interval timer are released on dispose
 * via the cleanup queue.
 */
function _wireMetrics(self: Internals): void {
	self._metricsStartedAt = Date.now();

	let ttffStartTs = 0;
	let ttffRecorded = false;
	const onPlay = (): void => {
		if (ttffStartTs === 0)
			ttffStartTs = Date.now();
	};
	const onFirstFrame = (): void => {
		if (!ttffRecorded && ttffStartTs > 0) {
			self._metrics.ttff = Date.now() - ttffStartTs;
			ttffRecorded = true;
			if (self._metricsStartedAt > 0) {
				self._metrics.joinTime = Date.now() - self._metricsStartedAt;
			}
		}
	};
	self.on('play', onPlay);
	self.on('firstFrame', onFirstFrame);

	let stallStartTs = 0;
	let cumulativeStallMs = 0;
	const onWaiting = (): void => {
		if (stallStartTs === 0)
			stallStartTs = Date.now();
	};
	const onResume = (): void => {
		if (stallStartTs > 0) {
			cumulativeStallMs += Date.now() - stallStartTs;
			stallStartTs = 0;
			const sessionMs = Date.now() - self._metricsStartedAt;
			if (sessionMs > 0) {
				self._metrics.rebufferRatio = cumulativeStallMs / sessionMs;
			}
		}
	};
	self.on('backend:waiting', onWaiting);
	self.on('backend:loaded', onResume);
	self.on('play', onResume);

	self._policyCleanup.push(() => {
		self.off('play', onPlay);
		self.off('firstFrame', onFirstFrame);
		self.off('backend:waiting', onWaiting);
		self.off('backend:loaded', onResume);
		self.off('play', onResume);
	});

	const interval = self.options.metricsIntervalMs ?? 10_000;
	if (interval > 0) {
		self._metricsTimer = setInterval(() => {
			self._metrics.sessionDurationMs = Date.now() - self._metricsStartedAt;
			self.emit('playback:metrics', self._metrics);
		}, interval);
		self._policyCleanup.push(() => {
			if (self._metricsTimer)
				clearInterval(self._metricsTimer);
			self._metricsTimer = undefined;
		});
	}
}

function _wireTimeAndDurationSync(self: Internals): void {
	const onTimeSync = ({ time }: { time: number }): void => {
		self._internalCurrentTime = time;
	};
	self.on('time', onTimeSync);
	self._policyCleanup.push(() => {
		self.off('time', onTimeSync);
	});

	const onDurationSync = ({ duration }: { duration: number }): void => {
		self._internalDuration = duration;
	};
	self.on('duration', onDurationSync);
	self._policyCleanup.push(() => {
		self.off('duration', onDurationSync);
	});
}

/**
 * Re-emit `time` as a throttled `progress` event so consumers can persist
 * watch position without subscribing to a per-frame stream. `time` fires every
 * animation frame; `progress` fires at most every `options.progressIntervalMs`
 * (default 5s, set to 0 to disable). The first `time` event after setup
 * always fires `progress` because `_lastProgressEmit` starts at 0.
 */
function _wireProgressEmit(self: Internals): void {
	const progressInterval = self.options.progressIntervalMs ?? 5_000;
	if (progressInterval <= 0) return;

	const onTime = ({ time }: { time: number }): void => {
		const now = Date.now();
		if (now - self._lastProgressEmit < progressInterval) return;
		self._lastProgressEmit = now;
		const duration = self.duration();
		const percentage = duration > 0 ? (time / duration) * 100 : 0;
		self.emit('progress', { time, duration, percentage });
	};
	self.on('time', onTime);
	self._policyCleanup.push(() => {
		self.off('time', onTime);
	});
}

/**
 * Wire up next-item preloading and crossfade transitions.
 *
 * Two listeners get registered:
 *  - `current` — bumps `_preloadEpoch`, cancels in-flight work, resets the
 *                "already fired this cycle" flags so the next item starts fresh.
 *  - `time`    — on every tick, asks the preload + transition strategies whether
 *                their thresholds have been crossed; fires `_runPreload` /
 *                `_runTransition` exactly once per cursor cycle.
 *
 * Strategy resolution order: explicit `options.preloadStrategy` /
 * `transitionStrategy` win over per-library defaults. When no custom preload
 * strategy is supplied, `options.preloadLeadSeconds` (default 10) drives a
 * fresh `DefaultPreloadStrategy`.
 *
 * Crossfade only runs when `options.crossfadeEnabled` is true.
 */
function _wirePreloadAndTransition(self: Internals): void {
	if (self.options.preloadStrategy) {
		self._preloadStrategy = self.options.preloadStrategy;
	}
	if (self.options.transitionStrategy) {
		self._transitionStrategy = self.options.transitionStrategy;
	}

	const configuredLeadSeconds = self.options.preloadLeadSeconds ?? 10;
	if (!self.options.preloadStrategy) {
		self._preloadStrategy = new DefaultPreloadStrategy(configuredLeadSeconds);
	}

	const onCurrentChange = (): void => {
		self._preloadFired = false;
		self._transitionFired = false;
		self._preloadStrategy.cancel();
		self._transitionStrategy.cancel('cursor-changed');
		self._preloadEpoch += 1;

		if (self._transitionRafHandle !== undefined) {
			cancelAnimationFrame(self._transitionRafHandle);
			self._transitionRafHandle = undefined;
		}
	};
	self.on('current', onCurrentChange);
	self._policyCleanup.push(() => {
		self.off('current', onCurrentChange);
	});

	const onTimeOrchestration = ({ time }: { time: number }): void => {
		const duration = self._internalDuration;
		const nextItem = self._queueList.peekNext() ?? null;
		const context = { currentTime: time, duration, nextItem };

		if (!self._preloadFired && self._preloadStrategy.shouldPreload(context) && nextItem !== null) {
			self._preloadFired = true;
			void _runPreload(self, nextItem, self._preloadStrategy);
		}

		const crossfadeEnabled = self.options.crossfadeEnabled ?? false;
		if (crossfadeEnabled && !self._transitionFired && self._transitionStrategy.shouldTransition(context) && nextItem !== null) {
			self._transitionFired = true;
			const outgoing = self._queueList.current() ?? null;
			if (outgoing !== null) {
				_runTransition(self, outgoing, nextItem);
			}
		}
	};
	self.on('time', onTimeOrchestration);
	self._policyCleanup.push(() => {
		self.off('time', onTimeOrchestration);
	});
}

/**
 * Stash the player on `window.player` when `options.expose: true`. Useful
 * for browser-console debugging. Cleanup checks identity before deleting so a
 * second player instance won't clobber the wrong handle.
 */
function _wireWindowExpose(self: Internals): void {
	if (self.options.expose !== true || typeof window === 'undefined') return;

	Object.assign(window, { player: self });
	self._policyCleanup.push(() => {
		if (Object.is(Reflect.get(window, 'player'), self)) {
			Reflect.deleteProperty(window, 'player');
		}
	});
}

/** Seed the container element with the player's baseline classes. */
function _initContainerClass(self: Internals): void {
	if (self.container && typeof self.container.classList !== 'undefined') {
		self.container.classList.add('nomercyplayer', 'paused');
	}
}


// ──────────────────────────────────────────────────────────────────────────
// Setup pipeline + transition helpers — async work fired by setup()
// ──────────────────────────────────────────────────────────────────────────

/** Lazily build the stream registry. Each call returns the same instance. */
function _ensureStreamRegistry(self: Internals): StreamRegistry {
	if (!self._streamRegistry) {
		self._streamRegistry = new StreamRegistry();
	}
	return self._streamRegistry;
}

/**
 * Drive the async setup pipeline, fire-and-forget. Each stage runs in order;
 * any failure short-circuits the rest and rejects the `ready()` promise.
 *
 * Plugin queue is drained during `pluginsRegistering`, with each plugin's
 * `use()` bounded by `options.pluginInitTimeoutMs` (default 30s). A plugin
 * that adds another plugin during its own `use()` is processed in the same
 * pass — the `shift()` loop catches new entries.
 *
 * Pipeline event order:
 *   setupStart → configResolved → pluginsRegistering → pluginsRegistered →
 *   streamsReady → authReady → playlistResolving? → playlistReady →
 *   mediaReady → ready
 *
 * The promise this fires is captured by `ready()` via `_readyResolve` /
 * `_readyReject` wiring set up before this runs.
 */
function _runSetupPipeline(self: Internals): void {
	const pipeline = async (): Promise<void> => {
		try {
			await _runStage(self, 'setupStart', 'setupStartError', () => {}, { container: self.container });
			await _runStage(self, 'configResolved', 'configResolvedError', () => {}, { config: self.options });
			await _runStage(self, 'pluginsRegistering', 'pluginsRegisteringError', async () => {
				const timeoutMs = self.options.pluginInitTimeoutMs ?? 30_000;
				while (self._pluginQueue.length > 0) {
					const entry = self._pluginQueue.shift()!;
					await self._registerPlugin(entry.ctor, entry.opts, timeoutMs);
				}
			});
			await _runStage(self, 'pluginsRegistered', 'pluginsRegisteredError', () => {});
			await _runStage(self, 'streamsReady', 'streamsReadyError', () => {
				// Native registered first so HLS (registered after) wins resolution
				// when a URL matches both — the registry walks newest-first.
				const reg = _ensureStreamRegistry(self);
				reg.register(nativeFactory);
				reg.register(hlsFactory);
			});
			await _runStage(self, 'authReady', 'authReadyError', () => {});

			// Playlist fires `playlistReady` with `length: 0` even when no
			// playlist is configured, so consumers can rely on the event.
			// String form (a playlist URL) is reserved for future fetch+parse;
			// today any non-array also lands on length 0.
			const playlist = self.options.playlist;
			if (typeof playlist === 'string') {
				self.emit('playlistResolving', { url: playlist });
				self.emit('playlistReady', { length: 0 });
			}
			else if (Array.isArray(playlist)) {
				self.emit('playlistReady', { length: playlist.length });
			}
			else {
				self.emit('playlistReady', { length: 0 });
			}

			await _runStage(self, 'mediaReady', 'mediaReadyError', () => {});

			self._transitionPhase('ready');
			self.emit('ready');
			self._readyResolve?.();
		}
		catch (err) {
			self._readyReject?.(err);
		}
	};

	void pipeline();
}

/**
 * Pre-fetch the next item's assets via HEAD requests so the browser cache
 * is warm by the time playback advances. The strategy decides what to fetch
 * (poster, manifest, first media segments, etc.).
 *
 * Race-guarded by `_preloadEpoch`: the orchestrator bumps the epoch on
 * `current` events, and every per-asset fetch checks that its captured epoch
 * still matches before emitting progress / complete. A stale fetch silently
 * exits — its result would describe yesterday's item.
 *
 * Emits `preloadStart`, then one `preloadProgress` per asset, then either
 * `preloadComplete` (all finished) or `preloadError` (any fetch threw).
 */
async function _runPreload(player: Internals, nextItem: BasePlaylistItem, strategy: PreloadStrategy): Promise<void> {
	const capturedEpoch = player._preloadEpoch;
	const assets = strategy.assetsToPreload(nextItem);

	player.emit('preloadStart', {
		item: nextItem,
		assets: assets.map(asset => ({ url: asset.url, category: asset.category })),
	});

	let loaded = 0;
	const total = assets.length;

	if (total === 0) {
		player.emit('preloadComplete', { item: nextItem });
		return;
	}

	const fetchAsset = async (asset: PreloadAsset): Promise<void> => {
		if (player._preloadEpoch !== capturedEpoch) return;

		try {
			const request = new Request(asset.url, {
				method: 'HEAD',
				mode: 'no-cors',
			});
			await fetch(request).catch(() => {});

			loaded += 1;

			if (player._preloadEpoch !== capturedEpoch) return;

			player.emit('preloadProgress', { item: nextItem, loaded, total });

			if (loaded === total) {
				player.emit('preloadComplete', { item: nextItem });
			}
		}
		catch (error: unknown) {
			if (player._preloadEpoch !== capturedEpoch) return;
			player.emit('preloadError', { item: nextItem, error });
		}
	};

	await Promise.all(assets.map(fetchAsset));
}

/**
 * Drive a crossfade transition from `outgoing` to `incoming` using
 * `requestAnimationFrame`. The strategy.tick() runs on every frame with a
 * `fraction` from 0 to 1 covering the crossfade window
 * (`crossfadeLeadSeconds + crossfadeTailSeconds`, both default 3).
 *
 * Same epoch race-guard as `_runPreload`: a cursor change mid-fade bumps
 * `_preloadEpoch` and the RAF callback exits silently. Dispose checks too,
 * so a teardown during a fade doesn't tick forever.
 *
 * Emits `transitionStart`, then `transitionProgress` per frame, then
 * `transitionComplete` when fraction hits 1.
 */
function _runTransition(player: Internals, outgoing: BasePlaylistItem, incoming: BasePlaylistItem): void {
	const backend = _resolveTransitionBackend(player);

	player._transitionStrategy.start(outgoing, incoming, backend);
	player.emit('transitionStart', { outgoing, incoming });

	const capturedEpoch = player._preloadEpoch;
	const crossfadeLeadSeconds = player.options.crossfadeLeadSeconds ?? 3;
	const crossfadeTailSeconds = player.options.crossfadeTailSeconds ?? 3;
	const totalWindowSeconds = crossfadeLeadSeconds + crossfadeTailSeconds;

	const tick = (): void => {
		if (player._preloadEpoch !== capturedEpoch) return;
		if (player._phase === 'disposed' || player._phase === 'disposing') return;

		const currentTime = player._internalCurrentTime;
		const duration = player._internalDuration;
		const elapsed = currentTime - (duration - crossfadeLeadSeconds);
		const fraction = totalWindowSeconds > 0 ? Math.max(0, Math.min(1, elapsed / totalWindowSeconds)) : 1;

		const context = { currentTime, duration, outgoingItem: outgoing, incomingItem: incoming, fraction };

		player._transitionStrategy.tick(context, backend);
		player.emit('transitionProgress', { outgoing, incoming, fraction });

		if (fraction >= 1) {
			player._transitionStrategy.complete(outgoing, incoming);
			player.emit('transitionComplete', { from: outgoing, to: incoming });
			player._transitionRafHandle = undefined;
			return;
		}

		player._transitionRafHandle = requestAnimationFrame(tick);
	};

	player._transitionRafHandle = requestAnimationFrame(tick);
}

function _resolveTransitionBackend(player: Internals): TransitionBackend | null {
	const backend = player.backend?.();
	if (!backend) return null;
	const candidate = backend as Partial<TransitionBackend>;
	if (typeof candidate.supportsCrossfade === 'function') {
		return candidate as TransitionBackend;
	}
	return null;
}

/**
 * Run a setup stage. Emits the success event on completion; on failure emits
 * the matching `<stage>Error` event AND a severity-tier `error`/`fatal` event,
 * then re-throws so the pipeline driver can bail.
 */
async function _runStage(
	self: Internals,
	stage: string,
	errorEvent: string,
	work: () => void | Promise<void>,
	successPayload?: unknown,
): Promise<void> {
	try {
		await work();
		if (successPayload !== undefined) {
			self.emit(stage, successPayload);
		}
		else {
			self.emit(stage);
		}
	}
	catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		const payload = {
			error,
			severity: 'error' as const,
			scope: { kind: 'core' as const },
			timestamp: Date.now(),
			markHandled: () => {},
			isHandled: () => false,
			stopImmediatePropagation: () => {},
			isPropagationStopped: () => false,
			preventDefault: () => {},
			isDefaultPrevented: () => false,
		};
		self.emit(errorEvent, payload);
		self.emit('error', payload);
		throw err;
	}
}
