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
// Mixin: lifecycle (setup, ready, dispose, setupState, phase, dispatching,
// pushDispatch, popDispatch, platform)
// ──────────────────────────────────────────────────────────────────────────

export const lifecycleMethods = {
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

	dispose(this: Internals): void {
		if (this._phase === 'disposed' || this._phase === 'disposing')
			return;
		this._transitionPhase('disposing');
		// Tear down policy subscriptions (visibility / network / wakeLock)
		// BEFORE the disposed phase so handlers see a sensible final state.
		for (const cleanup of this._policyCleanup) {
			try {
				cleanup();
			}
			catch { /* defensive */ }
		}
		this._policyCleanup = [];
		this._readyReject?.(stateError('core:player/disposed', 'dispose() called before ready'));
		this.emit('dispose');
		this._transitionPhase('disposed');
		this.off('all');
	},

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

	phase(this: Internals): PlayerPhase {
		return this._phase;
	},

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
	 * Resolved platform bundle. Defaults to `browserPlatform`; consumers swap
	 * via `setup({ platform: capacitorPlatform })`. Lazy fallback during
	 * pre-setup reads.
	 */
	platform(this: Internals): IPlatform {
		return this._platform ?? browserPlatform;
	},
} as const;


// ──────────────────────────────────────────────────────────────────────────
// Setup phase helpers — invoked in order by setup() above
// ──────────────────────────────────────────────────────────────────────────

function _guardSetup(self: Internals): void {
	// Spec §14: re-setup is `dispose → setup again`. Calling `setup()` twice
	// is a programmer error.
	if (self._setupCalled) {
		throw stateError('core:lifecycle/already-setup', 'setup() called twice. Re-setup requires dispose() first.');
	}
	if (self._phase === 'disposed' || self._phase === 'disposing') {
		throw stateError('core:player/disposed', 'setup() called after dispose().');
	}
}

function _normalizeOptions(self: Internals, config: BasePlayerConfig): void {
	self.options = { ...config };

	// Spec §G: deprecated `debug: true` → `logLevel = 'debug'` when no
	// explicit logLevel set. Explicit value always wins.
	if (self.options.debug === true && self.options.logLevel === undefined) {
		self.options.logLevel = 'debug';
	}

	// Spec §G + spec §12: deprecated `accessToken` → `auth.bearerToken`
	// shim. Lifts the v1 alias into the v2 auth pipeline. If `auth` is
	// already supplied, accessToken does NOT override an existing
	// bearerToken — explicit auth always wins.
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

function _seedFromOptions(self: Internals): void {
	// Snapshot the auth config so runtime mutators (`auth(config)` / `auth(partial)`)
	// have a live source of truth. Frozen on read via `auth()`.
	self._authConfig = self.options.auth ? { ...self.options.auth } : undefined;

	// Capture the consumer-supplied URL resolver, if any. Falls back to
	// the built-in default at call time when undefined.
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

function _registerCueParsers(self: Internals): void {
	// Spec §G + §24.7: kit-default parsers (LRC, VTT-subtitle, sprite-VTT)
	// register first. Resolution walks newest → oldest, so built-ins act as
	// the LOW-priority fallback while consumer-supplied parsers (registered
	// AFTER) win the resolution. Both go to the back of the list — order
	// is "consumer pushed last, checked first."
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
	// Spec §G: resolve platform bundle. Default is browserPlatform but
	// consumers can swap (Capacitor, Tauri, Electron) or partially override
	// (`{ ...browserPlatform, wakeLock: customWakeLock }`).
	self._platform = self.options.platform ?? browserPlatform;
}

function _wireVisibilityPolicy(self: Internals): void {
	// Spec §G — pauseWhenHidden: subscribe to the platform's visibility
	// monitor; pause when the page goes hidden. Default is `false` for
	// both libraries so we wire ONLY when explicitly enabled.
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

function _wireNetworkPolicy(self: Internals): void {
	// Spec §G — onOffline: subscribe to the platform's network monitor and
	// react per the configured policy. `'pause'` calls pause() on offline;
	// `'continue-buffered'` (default) emits the network events but doesn't
	// touch transport; `'ignore'` skips emission entirely.
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

function _wireWakeLockPolicy(self: Internals): void {
	//   `'never'`    — no acquire ever
	//   `'always'`   — acquire at setup, release at dispose
	//   `'auto'`     — track via phase events; acquire when entering
	//                  `playing`/`starting`, release when exiting
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

function _wireMetrics(self: Internals): void {
	// Spec §T — periodic metrics emit + per-event instrumentation.
	// `_metricsStartedAt` anchors session-duration; per-event hooks below
	// populate TTFF / joinTime / rebufferRatio as the player runs.
	self._metricsStartedAt = Date.now();

	// TTFF instrumentation: capture `play()` timestamp, compute delta on
	// first `firstFrame` event. Single-shot — only the FIRST play→frame
	// pair counts; subsequent plays don't reset TTFF.
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
			// joinTime aggregates: ready→firstFrame total.
			if (self._metricsStartedAt > 0) {
				self._metrics.joinTime = Date.now() - self._metricsStartedAt;
			}
		}
	};
	self.on('play', onPlay);
	self.on('firstFrame', onFirstFrame);

	// Rebuffer instrumentation: `backend:waiting` starts a stall timer;
	// `backend:loaded`/`play` ends it. Sum the stall durations and divide
	// by session duration on each metrics-snapshot read.
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
			// Refresh sessionDurationMs on every emit so listeners see
			// current numbers without calling metrics() explicitly.
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

function _wireProgressEmit(self: Internals): void {
	// Spec §P4-V5: throttled progress event. `time` fires every animation
	// frame — too noisy for server-side watch-position saves. We subscribe
	// to the player's own `time` event and re-emit `progress` at most every
	// `progressIntervalMs` (default 5000ms, 0 = disabled). `_lastProgressEmit`
	// starts at 0 so the first `time` event always fires `progress`.
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

function _wirePreloadAndTransition(self: Internals): void {
	// Override strategies from config if supplied. Per-library players set
	// their own defaults AFTER initPlayerCoreState; config injection always
	// wins over library defaults when both are present.
	if (self.options.preloadStrategy) {
		self._preloadStrategy = self.options.preloadStrategy;
	}
	if (self.options.transitionStrategy) {
		self._transitionStrategy = self.options.transitionStrategy;
	}

	// Apply config-level lead times to the default strategy when no custom
	// strategy has been injected. We rebuild the default strategy so the
	// per-library player's preloadLeadSeconds takes effect here.
	const configuredLeadSeconds = self.options.preloadLeadSeconds ?? 10;
	if (!self.options.preloadStrategy) {
		self._preloadStrategy = new DefaultPreloadStrategy(configuredLeadSeconds);
	}

	// Cursor-change guard: reset preload/transition flags whenever the active
	// item changes so the next item gets a fresh cycle.
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

	// Time-driven orchestration: check preload + transition on every time tick.
	const onTimeOrchestration = ({ time }: { time: number }): void => {
		const duration = self._internalDuration;
		const nextItem = self._queueList.peekNext() ?? null;
		const context = { currentTime: time, duration, nextItem };

		// Preload gate.
		if (!self._preloadFired && self._preloadStrategy.shouldPreload(context) && nextItem !== null) {
			self._preloadFired = true;
			void _runPreload(self, nextItem, self._preloadStrategy);
		}

		// Transition gate.
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

function _wireWindowExpose(self: Internals): void {
	if (self.options.expose !== true || typeof window === 'undefined') return;

	Object.assign(window, { player: self });
	self._policyCleanup.push(() => {
		if (Object.is(Reflect.get(window, 'player'), self)) {
			Reflect.deleteProperty(window, 'player');
		}
	});
}

function _initContainerClass(self: Internals): void {
	if (self.container && typeof self.container.classList !== 'undefined') {
		self.container.classList.add('nomercyplayer', 'paused');
	}
}


// ──────────────────────────────────────────────────────────────────────────
// Setup pipeline + transition helpers — async work fired by setup()
// ──────────────────────────────────────────────────────────────────────────

function _ensureStreamRegistry(self: Internals): StreamRegistry {
	if (!self._streamRegistry) {
		self._streamRegistry = new StreamRegistry();
	}
	return self._streamRegistry;
}

/**
 * Drives the async setup pipeline. Each stage runs in order; failure short-
 * circuits the rest. Plugin queue is drained during `pluginsRegistering`,
 * with each plugin's `use()` bounded by `pluginInitTimeoutMs` (default 30s).
 *
 * Pipeline event order (spec §14):
 *   setupStart → configResolved → pluginsRegistering → pluginsRegistered →
 *   streamsReady → authReady → playlistResolving? → playlistReady →
 *   mediaReady → ready
 */
function _runSetupPipeline(self: Internals): void {
	const pipeline = async (): Promise<void> => {
		try {
			await _runStage(self, 'setupStart', 'setupStartError', () => {}, { container: self.container });
			await _runStage(self, 'configResolved', 'configResolvedError', () => {}, { config: self.options });
			await _runStage(self, 'pluginsRegistering', 'pluginsRegisteringError', async () => {
				// Drain the queue. New plugins added during a `use()` (rare) get
				// processed in the same pass — splicing the array catches them.
				const timeoutMs = self.options.pluginInitTimeoutMs ?? 30_000;
				while (self._pluginQueue.length > 0) {
					const entry = self._pluginQueue.shift()!;
					await self._registerPlugin(entry.ctor, entry.opts, timeoutMs);
				}
			});
			await _runStage(self, 'pluginsRegistered', 'pluginsRegisteredError', () => {});
			await _runStage(self, 'streamsReady', 'streamsReadyError', () => {
				// Spec §I: kit defaults (native + hls) auto-register here.
				// Resolution order is most-recent-first; pushing native first so
				// HLS (registered after) wins when a URL matches both.
				const reg = _ensureStreamRegistry(self);
				reg.register(nativeFactory);
				reg.register(hlsFactory);
			});
			await _runStage(self, 'authReady', 'authReadyError', () => {});

			// Playlist stage — spec §14 says fire `playlistReady` with `length: 0`
			// even when no playlist is configured. URL form (string) is reserved
			// for §L impl; for now treat any non-string as inline.
			const playlist = self.options.playlist;
			if (typeof playlist === 'string') {
				self.emit('playlistResolving', { url: playlist });
				// Fetch+parse lands with §L; emit ready with length 0 for now.
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

	// Eager start, fire-and-forget. The promise itself is captured by `ready()`
	// via `_readyResolve` / `_readyReject` wiring set up before the pipeline runs.
	void pipeline();
}

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
