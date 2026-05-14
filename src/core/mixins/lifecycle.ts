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
// Private helpers — only used by setup pipeline
// ──────────────────────────────────────────────────────────────────────────

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


// ──────────────────────────────────────────────────────────────────────────
// Mixin: lifecycle (setup, ready, dispose, setupState, phase, dispatching,
// pushDispatch, popDispatch, platform)
// ──────────────────────────────────────────────────────────────────────────

export const lifecycleMethods = {
	setup(this: Internals, config: BasePlayerConfig): unknown {
		// Spec §14: re-setup is `dispose → setup again`. Calling `setup()` twice
		// is a programmer error.
		if (this._setupCalled) {
			throw stateError('core:lifecycle/already-setup', 'setup() called twice. Re-setup requires dispose() first.');
		}
		if (this._phase === 'disposed' || this._phase === 'disposing') {
			throw stateError('core:player/disposed', 'setup() called after dispose().');
		}
		this._setupCalled = true;

		this.options = { ...config };

		// Spec §G: deprecated `debug: true` → `logLevel = 'debug'` when no
		// explicit logLevel set. Explicit value always wins.
		if (this.options.debug === true && this.options.logLevel === undefined) {
			this.options.logLevel = 'debug';
		}

		// Spec §G + spec §12: deprecated `accessToken` → `auth.bearerToken`
		// shim. Lifts the v1 alias into the v2 auth pipeline. If `auth` is
		// already supplied, accessToken does NOT override an existing
		// bearerToken — explicit auth always wins.
		if (this.options.accessToken !== undefined) {
			const existing = this.options.auth ?? {};
			if (existing.bearerToken === undefined) {
				this.options.auth = {
					...existing,
					bearerToken: this.options.accessToken,
				};
			}
		}

		// Snapshot the auth config so runtime mutators (`auth(config)` / `auth(partial)`)
		// have a live source of truth. Frozen on read via `auth()`.
		this._authConfig = this.options.auth ? { ...this.options.auth } : undefined;

		// Capture the consumer-supplied URL resolver, if any. Falls back to
		// the built-in default at call time when undefined.
		this._urlResolver = this.options.urlResolver;

		if (this.options.baseUrl)
			this._baseUrl = this.options.baseUrl;

		if (typeof this.options.defaultVolume === 'number') {
			this._internalVolume = Math.max(0, Math.min(1, this.options.defaultVolume));
			this._volumeBeforeMute = this._internalVolume;
		}

		this._translator = this.options.translator ?? new DefaultTranslator({
			language: this.options.language,
			translations: this.options.translations,
			loadTranslations: this.options.loadTranslations,
			onMissingTranslation: this.options.onMissingTranslation,
		});

		// Spec §G + §24.7: kit-default parsers (LRC, VTT-subtitle, sprite-VTT)
		// register first. Resolution walks newest → oldest, so built-ins act as
		// the LOW-priority fallback while consumer-supplied parsers (registered
		// AFTER) win the resolution. Both go to the back of the list — order
		// is "consumer pushed last, checked first."
		for (const parser of builtInCueParsers) {
			this._cueParsers.register(parser);
		}
		if (this.options.cueParsers) {
			for (const parser of this.options.cueParsers) {
				this._cueParsers.register(parser);
			}
		}

		// Spec §G: resolve platform bundle. Default is browserPlatform but
		// consumers can swap (Capacitor, Tauri, Electron) or partially override
		// (`{ ...browserPlatform, wakeLock: customWakeLock }`).
		this._platform = this.options.platform ?? browserPlatform;

		// Spec §G — pauseWhenHidden: subscribe to the platform's visibility
		// monitor; pause when the page goes hidden. Default is `false` for
		// both libraries so we wire ONLY when explicitly enabled.
		if (this.options.pauseWhenHidden) {
			const unsubscribe = this._platform.visibility.subscribe((visible) => {
				if (!visible) {
					this.pause({ source: 'platform' }).catch(() => { /* swallow */ });
				}
				if (visible) {
					this.emit('visibility:visible');
				}
				else {
					this.emit('visibility:hidden');
				}
			});
			this._policyCleanup.push(unsubscribe);
		}

		// Spec §G — onOffline: subscribe to the platform's network monitor and
		// react per the configured policy. `'pause'` calls pause() on offline;
		// `'continue-buffered'` (default) emits the network events but doesn't
		// touch transport; `'ignore'` skips emission entirely.
		const onOffline = this.options.onOffline ?? 'continue-buffered';
		if (onOffline !== 'ignore') {
			const unsubscribe = this._platform.network.subscribe((state) => {
				if (state.online) {
					this.emit('network:online');
				}
				else {
					this.emit('network:offline');
					if (onOffline === 'pause') {
						this.pause({ source: 'platform' }).catch(() => { /* swallow */ });
					}
				}
			});
			this._policyCleanup.push(unsubscribe);
		}

		// Spec §G — wakeLock policy:
		//   `'never'`    — no acquire ever
		//   `'always'`   — acquire at setup, release at dispose
		//   `'auto'`     — track via phase events; acquire when entering
		//                  `playing`/`starting`, release when exiting
		const wakeLockPolicy = this.options.wakeLock ?? 'never';
		if (wakeLockPolicy === 'always') {
			void this._platform.wakeLock.acquire().catch(() => { /* unsupported */ });
			this._policyCleanup.push(() => {
				void this._platform?.wakeLock.release().catch(() => { /* defensive */ });
			});
		}
		else if (wakeLockPolicy === 'auto') {
			const platform = this._platform;
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
			this.on('phase', phaseHandler);
			this._policyCleanup.push(() => {
				this.off('phase', phaseHandler);
				if (platform.wakeLock.isHeld()) {
					void platform.wakeLock.release().catch(() => { /* defensive */ });
				}
			});
		}

		// Spec §T — periodic metrics emit + per-event instrumentation.
		// `_metricsStartedAt` anchors session-duration; per-event hooks below
		// populate TTFF / joinTime / rebufferRatio as the player runs.
		this._metricsStartedAt = Date.now();

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
				this._metrics.ttff = Date.now() - ttffStartTs;
				ttffRecorded = true;
				// joinTime aggregates: ready→firstFrame total.
				if (this._metricsStartedAt > 0) {
					this._metrics.joinTime = Date.now() - this._metricsStartedAt;
				}
			}
		};
		this.on('play', onPlay);
		this.on('firstFrame', onFirstFrame);

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
				const sessionMs = Date.now() - this._metricsStartedAt;
				if (sessionMs > 0) {
					this._metrics.rebufferRatio = cumulativeStallMs / sessionMs;
				}
			}
		};
		this.on('backend:waiting', onWaiting);
		this.on('backend:loaded', onResume);
		this.on('play', onResume);

		this._policyCleanup.push(() => {
			this.off('play', onPlay);
			this.off('firstFrame', onFirstFrame);
			this.off('backend:waiting', onWaiting);
			this.off('backend:loaded', onResume);
			this.off('play', onResume);
		});

		const interval = this.options.metricsIntervalMs ?? 10_000;
		if (interval > 0) {
			this._metricsTimer = setInterval(() => {
				// Refresh sessionDurationMs on every emit so listeners see
				// current numbers without calling metrics() explicitly.
				this._metrics.sessionDurationMs = Date.now() - this._metricsStartedAt;
				this.emit('playback:metrics', this._metrics);
			}, interval);
			this._policyCleanup.push(() => {
				if (this._metricsTimer)
					clearInterval(this._metricsTimer);
				this._metricsTimer = undefined;
			});
		}

		const onTimeSync = ({ time }: { time: number }): void => {
			this._internalCurrentTime = time;
		};
		this.on('time', onTimeSync);
		this._policyCleanup.push(() => {
			this.off('time', onTimeSync);
		});

		const onDurationSync = ({ duration }: { duration: number }): void => {
			this._internalDuration = duration;
		};
		this.on('duration', onDurationSync);
		this._policyCleanup.push(() => {
			this.off('duration', onDurationSync);
		});

		// Spec §P4-V5: throttled progress event. `time` fires every animation
		// frame — too noisy for server-side watch-position saves. We subscribe
		// to the player's own `time` event and re-emit `progress` at most every
		// `progressIntervalMs` (default 5000ms, 0 = disabled). `_lastProgressEmit`
		// starts at 0 so the first `time` event always fires `progress`.
		const progressInterval = this.options.progressIntervalMs ?? 5_000;
		if (progressInterval > 0) {
			const onTime = ({ time }: { time: number }): void => {
				const now = Date.now();
				if (now - this._lastProgressEmit < progressInterval) return;
				this._lastProgressEmit = now;
				const duration = this.duration();
				const percentage = duration > 0 ? (time / duration) * 100 : 0;
				this.emit('progress', { time, duration, percentage });
			};
			this.on('time', onTime);
			this._policyCleanup.push(() => {
				this.off('time', onTime);
			});
		}

		// ── Preload + transition orchestration ────────────────────────────────
		// Override strategies from config if supplied. Per-library players set
		// their own defaults AFTER initPlayerCoreState; config injection always
		// wins over library defaults when both are present.
		if (this.options.preloadStrategy) {
			this._preloadStrategy = this.options.preloadStrategy;
		}
		if (this.options.transitionStrategy) {
			this._transitionStrategy = this.options.transitionStrategy;
		}

		// Apply config-level lead times to the default strategy when no custom
		// strategy has been injected. We rebuild the default strategy so the
		// per-library player's preloadLeadSeconds takes effect here.
		const configuredLeadSeconds = this.options.preloadLeadSeconds ?? 10;
		if (!this.options.preloadStrategy) {
			this._preloadStrategy = new DefaultPreloadStrategy(configuredLeadSeconds);
		}

		// Cursor-change guard: reset preload/transition flags whenever the active
		// item changes so the next item gets a fresh cycle.
		const onCurrentChange = (): void => {
			this._preloadFired = false;
			this._transitionFired = false;
			this._preloadStrategy.cancel();
			this._transitionStrategy.cancel('cursor-changed');
			this._preloadEpoch += 1;

			if (this._transitionRafHandle !== undefined) {
				cancelAnimationFrame(this._transitionRafHandle);
				this._transitionRafHandle = undefined;
			}
		};
		this.on('current', onCurrentChange);
		this._policyCleanup.push(() => {
			this.off('current', onCurrentChange);
		});

		// Time-driven orchestration: check preload + transition on every time tick.
		const onTimeOrchestration = ({ time }: { time: number }): void => {
			const duration = this._internalDuration;
			const nextItem = this._queueList.peekNext() ?? null;
			const context = { currentTime: time, duration, nextItem };

			// Preload gate.
			if (!this._preloadFired && this._preloadStrategy.shouldPreload(context) && nextItem !== null) {
				this._preloadFired = true;
				void _runPreload(this, nextItem, this._preloadStrategy);
			}

			// Transition gate.
			const crossfadeEnabled = this.options.crossfadeEnabled ?? false;
			if (crossfadeEnabled && !this._transitionFired && this._transitionStrategy.shouldTransition(context) && nextItem !== null) {
				this._transitionFired = true;
				const outgoing = this._queueList.current() ?? null;
				if (outgoing !== null) {
					_runTransition(this, outgoing, nextItem);
				}
			}
		};
		this.on('time', onTimeOrchestration);
		this._policyCleanup.push(() => {
			this.off('time', onTimeOrchestration);
		});

		if (this.options.expose === true && typeof window !== 'undefined') {
			Object.assign(window, { player: this });
			this._policyCleanup.push(() => {
				if (Object.is(Reflect.get(window, 'player'), this)) {
					Reflect.deleteProperty(window, 'player');
				}
			});
		}

		if (this.container && typeof this.container.classList !== 'undefined') {
			this.container.classList.add('nomercyplayer', 'paused');
		}

		// Pre-pipeline ceremony: beforeSetup fires synchronously so consumers
		// can attach last-mile listeners before the pipeline actually runs.
		this.emit('beforeSetup');
		this._transitionPhase('setup');

		// Kick off the async pipeline fire-and-forget. `ready()` is the public
		// signal that the pipeline finished — internal `_readyResolve` /
		// `_readyReject` get wired below before the pipeline runs.
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
