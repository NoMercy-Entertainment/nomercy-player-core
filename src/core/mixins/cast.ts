import type { CastConfig } from '../../types';
import type { Internals } from '../state';
import { browserPolicyError } from '../../errors';

import { CastState as _CastStateEnum } from '../../types';

// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by castMethods
// ──────────────────────────────────────────────────────────────────────────

interface _CastGlobal {
	cast: {
		framework: {
			CastContext: {
				getInstance: () => {
					requestSession: () => Promise<unknown>;
					setOptions: (opts: Record<string, unknown>) => void;
				};
			};
		};
	};
	chrome?: {
		cast?: {
			AutoJoinPolicy?: Record<string, string>;
			media?: { DEFAULT_MEDIA_RECEIVER_APP_ID?: string };
		};
	};
}

interface _CastApiGlobal {
	__onGCastApiAvailable?: (loaded: boolean, errorInfo?: string) => void;
}

const DEFAULT_CAST_SCRIPT = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
const DEFAULT_LOAD_TIMEOUT_MS = 10_000;

/**
 * Module-level promise that dedupes concurrent `_ensureCastLoaded` calls. The
 * Cast SDK is a singleton on `window`, so multiple players (or rapid
 * transferTo clicks) must share one script injection.
 */
let _castLoadPromise: Promise<void> | null = null;

/**
 * Module-level flag so `_initCastContext` only runs setOptions() once per
 * page. The SDK's `CastContext` is itself a singleton — applying the same
 * options twice is harmless, but the flag avoids the redundant call.
 */
let _castContextConfigured = false;

/** Probe whether the Cast Web Sender SDK is loaded on the page. */
function _isCastAvailable(): boolean {
	return typeof globalThis !== 'undefined' && 'cast' in globalThis;
}

/** Probe whether AirPlay is available (WebKit-only, on a video element). */
function _isAirPlayAvailable(): boolean {
	return typeof window !== 'undefined' && 'WebKitPlaybackTargetAvailabilityEvent' in window;
}

/** Probe whether the W3C RemotePlayback API is available. */
function _isRemotePlaybackAvailable(): boolean {
	const proto: unknown = typeof window !== 'undefined' ? window.HTMLMediaElement?.prototype : undefined;
	return proto !== undefined && typeof proto === 'object' && proto !== null && 'remote' in proto;
}

/**
 * Inject the Cast Web Sender SDK and resolve when the SDK signals ready.
 *
 * The SDK calls `window.__onGCastApiAvailable(loaded, errorInfo)` on init —
 * the hook MUST be installed before the script appends or the SDK's own
 * check fires first and the callback never runs.
 *
 * Errors come back as `BrowserPolicyError` with codes the caller can branch
 * on: `castLoadTimeout` (deadline exceeded), `castLoadFailed` (SDK refused
 * to initialise), `castScriptLoadFailed` (network / CSP blocked the script).
 *
 * Concurrent calls share one in-flight promise (`_castLoadPromise`) so two
 * near-simultaneous `transferTo('cast')` clicks don't double-inject.
 */
function _ensureCastLoaded(cfg: CastConfig | undefined): Promise<void> {
	if (_isCastAvailable())
		return Promise.resolve();
	if (_castLoadPromise)
		return _castLoadPromise;

	const scriptUrl = cfg?.scriptUrl ?? DEFAULT_CAST_SCRIPT;
	const timeoutMs = cfg?.loadTimeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;

	_castLoadPromise = new Promise<void>((resolve, reject) => {
		const win = window as unknown as _CastApiGlobal;
		const previous = win.__onGCastApiAvailable;
		let settled = false;
		let timer: ReturnType<typeof setTimeout>;

		const finish = (ok: boolean, err?: unknown): void => {
			if (settled)
				return;
			settled = true;
			clearTimeout(timer);
			win.__onGCastApiAvailable = previous;
			if (ok) {
				resolve();
			}
			else {
				_castLoadPromise = null;
				reject(err);
			}
		};

		timer = setTimeout(
			() => finish(false, browserPolicyError(
				'core:policy/castLoadTimeout',
				`Cast SDK load exceeded ${timeoutMs}ms`,
			)),
			timeoutMs,
		);

		win.__onGCastApiAvailable = (loaded, errorInfo): void => {
			if (loaded) {
				finish(true);
			}
			else {
				finish(false, browserPolicyError(
					'core:policy/castLoadFailed',
					`Cast SDK refused to load: ${errorInfo ?? 'unknown'}`,
				));
			}
		};

		// Skip injection if the consumer already added the script tag manually —
		// we still hold the callback so the SDK reports back to us, not them.
		if (document.querySelector('script[src*="cast_sender.js"]'))
			return;

		const script = document.createElement('script');
		script.src = scriptUrl;
		script.async = true;
		script.onerror = () => finish(false, browserPolicyError(
			'core:policy/castScriptLoadFailed',
			'Cast SDK script failed to load — check network and any Content-Security-Policy blocking gstatic.com',
		));
		document.head.appendChild(script);
	});
	return _castLoadPromise;
}

/**
 * Apply the consumer's `CastConfig` options to the SDK's `CastContext`. Runs
 * once per page; subsequent calls no-op. Falls back to SDK defaults for any
 * missing fields.
 */
function _initCastContext(cfg: CastConfig | undefined): void {
	if (_castContextConfigured)
		return;

	const castGlobal = globalThis as unknown as _CastGlobal;
	if (!castGlobal.cast?.framework?.CastContext)
		return;

	const policyMap: Record<NonNullable<CastConfig['autoJoinPolicy']>, string> = {
		'origin-scoped': 'ORIGIN_SCOPED',
		'tab-and-origin-scoped': 'TAB_AND_ORIGIN_SCOPED',
		'page-scoped': 'PAGE_SCOPED',
	};
	const policyKey = policyMap[cfg?.autoJoinPolicy ?? 'origin-scoped'];
	const autoJoinPolicy = castGlobal.chrome?.cast?.AutoJoinPolicy?.[policyKey];

	const defaultAppId = castGlobal.chrome?.cast?.media?.DEFAULT_MEDIA_RECEIVER_APP_ID ?? 'CC1AD845';

	castGlobal.cast.framework.CastContext.getInstance().setOptions({
		receiverApplicationId: cfg?.receiverApplicationId ?? defaultAppId,
		autoJoinPolicy,
		resumeSavedSession: cfg?.resumeSavedSession ?? true,
	});

	_castContextConfigured = true;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: cast / handoff — coarse handoff state plus the `transferTo()`
// dispatcher that hands playback off to Cast / AirPlay / RemotePlayback or
// pulls it back to local. Cast SDK is loaded on demand when configured via
// `options.cast.autoLoad: true`.
// ──────────────────────────────────────────────────────────────────────────

export const castMethods = {
	/**
	 * Coarse handoff state. Returns the status of the most recently active
	 * remote-playback target. With no Cast/AirPlay/RemotePlayback APIs
	 * available, returns `'unavailable'`. Use `castState()` for a quick
	 * "is any remote target reachable?" check before showing a cast button.
	 */
	castState(this: Internals): _CastStateEnum {
		if (this._castState !== undefined)
			return this._castState;
		if (_isCastAvailable() || _isAirPlayAvailable() || _isRemotePlaybackAvailable()) {
			return _CastStateEnum.AVAILABLE;
		}
		return _CastStateEnum.UNAVAILABLE;
	},
	/**
	 * Hand playback off to a remote target (or pull it back to local).
	 *
	 * Targets:
	 *  - `'cast'` — Chromecast / Google Cast. When `options.cast.autoLoad`
	 *    is true, the SDK is injected on first call; otherwise the SDK
	 *    script must already be present on the page or the call throws
	 *    `core:policy/castUnavailable`. Custom receivers are configured via
	 *    `options.cast.receiverApplicationId`.
	 *  - `'airplay'` — Safari / WebKit only. Opens the playback target
	 *    picker on the bound video element; Safari binds the picker to the
	 *    user gesture so the consumer should call this from a click handler.
	 *  - `'remote-playback'` — W3C RemotePlayback API (Chrome on desktop /
	 *    Android). Prompts the user with the platform device list.
	 *  - `'local'` — return playback to the local element.
	 *
	 * Throws `BrowserPolicyError` with a target-specific code when the
	 * target's API isn't available so consumers can surface a "device not
	 * supported" UI instead of an opaque failure.
	 */
	async transferTo(this: Internals, target: 'cast' | 'airplay' | 'remote-playback' | 'local'): Promise<void> {
		const setState = (s: _CastStateEnum): void => {
			this._castState = s;
			this.emit('castState', { state: s });
		};

		switch (target) {
			case 'cast': {
				const cfg = this.options.cast;
				if (!_isCastAvailable()) {
					if (!cfg?.autoLoad) {
						throw browserPolicyError(
							'core:policy/castUnavailable',
							'Cast SDK not loaded. Either include the cast_sender.js script tag manually OR pass `cast: { autoLoad: true }` to setup() to load it on demand.',
						);
					}
					await _ensureCastLoaded(cfg);
				}
				setState(_CastStateEnum.CONNECTING);
				try {
					_initCastContext(cfg);
					const castGlobal = globalThis as unknown as _CastGlobal;
					await castGlobal.cast.framework.CastContext.getInstance().requestSession();
					setState(_CastStateEnum.CONNECTED);
				}
				catch (err) {
					setState(_CastStateEnum.AVAILABLE);
					throw err;
				}
				return;
			}
			case 'airplay': {
				if (!_isAirPlayAvailable()) {
					throw browserPolicyError('core:policy/airplayUnavailable', 'AirPlay is WebKit-only (Safari, iOS).');
				}
				// AirPlay handoff requires the consumer to call
				// `videoElement.webkitShowPlaybackTargetPicker()` directly
				// because Safari binds the picker to user-gesture events.
				// Mark the state as connecting; consumer wires the picker.
				setState(_CastStateEnum.CONNECTING);
				if (this.videoElement?.webkitShowPlaybackTargetPicker) {
					this.videoElement.webkitShowPlaybackTargetPicker();
				}
				return;
			}
			case 'remote-playback': {
				if (!_isRemotePlaybackAvailable()) {
					throw browserPolicyError('core:policy/remotePlaybackUnavailable', 'RemotePlayback API not supported in this browser.');
				}
				const video = this.videoElement;
				if (!video?.remote) {
					throw browserPolicyError('core:policy/remotePlaybackUnavailable', 'No video element bound to player.');
				}
				setState(_CastStateEnum.CONNECTING);
				try {
					await video.remote.prompt();
					setState(_CastStateEnum.CONNECTED);
				}
				catch (err) {
					setState(_CastStateEnum.AVAILABLE);
					throw err;
				}
				return;
			}
			case 'local': {
				setState(_CastStateEnum.DISCONNECTED);
				return;
			}
			default:
				throw browserPolicyError('core:policy/transferTargetUnknown', `Unknown transfer target: ${target}`);
		}
	},
} as const;
