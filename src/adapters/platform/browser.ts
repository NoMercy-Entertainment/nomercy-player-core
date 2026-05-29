import type {
	ICapabilitiesProbe,
	IFullscreenController,
	INetworkMonitor,
	IPipController,
	IPlatform,
	IVisibilityMonitor,
	IWakeLock,
	NetworkType,
} from './IPlatform';

import { BrowserPolicyError } from '../../errors';

export type {
	DecodeCapability,
	DecodeProfile,
	ICapabilitiesProbe,
	IFullscreenController,
	INetworkMonitor,
	IPipController,
	IPlatform,
	IVisibilityMonitor,
	IWakeLock,
	NetworkType,
} from './IPlatform';

// ─────────────────────────────────────────────────────────────────────────
// Default browser platform
// ─────────────────────────────────────────────────────────────────────────

interface WakeLockSentinelLike {
	released: boolean;
	release: () => Promise<void>;
}

interface NavigatorWakeLockLike {
	wakeLock?: {
		request: (type: 'screen') => Promise<WakeLockSentinelLike>;
	};
}

interface ConnectionLike {
	effectiveType?: string;
	downlink?: number;
	rtt?: number;
	type?: string;
	addEventListener?: (event: string, listener: () => void) => void;
	removeEventListener?: (event: string, listener: () => void) => void;
}

interface NavigatorConnectionLike {
	connection?: ConnectionLike;
}

function browserWakeLock(): IWakeLock {
	let sentinel: WakeLockSentinelLike | undefined;
	return {
		async acquire() {
			const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as NavigatorWakeLockLike | undefined;
			if (!nav?.wakeLock) {
				throw new BrowserPolicyError({
					code: 'core:policy/wakeLockUnsupported',
					severity: 'error',
					scope: { kind: 'core' },
					message: 'Wake lock not supported in this environment.',
				});
			}
			sentinel = await nav.wakeLock.request('screen');
		},
		async release() {
			if (sentinel && !sentinel.released)
				await sentinel.release();
			sentinel = undefined;
		},
		isHeld() {
			return !!sentinel && !sentinel.released;
		},
		isSupported() {
			const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as NavigatorWakeLockLike | undefined;
			return !!nav?.wakeLock;
		},
	};
}

function browserNetworkMonitor(): INetworkMonitor {
	const mapType = (raw?: string): NetworkType => {
		if (!raw)
			return 'unknown';
		if (raw === 'wifi' || raw === 'ethernet' || raw === 'cellular' || raw === 'none')
			return raw;
		return 'unknown';
	};

	return {
		isOnline() {
			return typeof navigator !== 'undefined' ? navigator.onLine : true;
		},
		type() {
			const conn = (navigator as NavigatorConnectionLike).connection;
			return mapType(conn?.type);
		},
		downlinkMbps() {
			return (navigator as NavigatorConnectionLike).connection?.downlink;
		},
		rttMs() {
			return (navigator as NavigatorConnectionLike).connection?.rtt;
		},
		subscribe(fn) {
			if (typeof window === 'undefined')
				return () => {};
			const conn = (navigator as NavigatorConnectionLike).connection;
			const fire = (): void => fn({
				online: navigator.onLine,
				type: mapType(conn?.type),
			});
			window.addEventListener('online', fire);
			window.addEventListener('offline', fire);
			conn?.addEventListener?.('change', fire);
			return () => {
				window.removeEventListener('online', fire);
				window.removeEventListener('offline', fire);
				conn?.removeEventListener?.('change', fire);
			};
		},
	};
}

function browserVisibilityMonitor(): IVisibilityMonitor {
	return {
		isVisible() {
			if (typeof document === 'undefined')
				return true;
			return document.visibilityState === 'visible';
		},
		subscribe(fn) {
			if (typeof document === 'undefined')
				return () => {};
			const handler = (): void => fn(document.visibilityState === 'visible');
			document.addEventListener('visibilitychange', handler);
			return () => document.removeEventListener('visibilitychange', handler);
		},
	};
}

/**
 * Standard codec MIME type strings swept by `supportedCodecs()`. Covers the
 * full matrix a modern browser is expected to support across H.264, H.265,
 * VP8, VP9, AV1 (video) and AAC, Opus, Vorbis, FLAC (audio).
 */
const _CODEC_PROBE_SET: readonly string[] = [
	'video/mp4; codecs="avc1.42E01E"',
	'video/mp4; codecs="avc1.4D401F"',
	'video/mp4; codecs="avc1.640028"',
	'video/mp4; codecs="hev1.1.6.L93.90"',
	'video/webm; codecs="vp8"',
	'video/webm; codecs="vp9"',
	'video/webm; codecs="av01.0.05M.08"',
	'audio/mp4; codecs="mp4a.40.2"',
	'audio/webm; codecs="opus"',
	'audio/webm; codecs="vorbis"',
	'audio/flac',
];

function browserCapabilitiesProbe(): ICapabilitiesProbe {
	return {
		async canDecode(profile) {
			if (typeof navigator === 'undefined' || !navigator.mediaCapabilities?.decodingInfo) {
				return {
					supported: false,
					smooth: false,
					powerEfficient: false,
				};
			}
			try {
				const info = await navigator.mediaCapabilities.decodingInfo({
					type: 'media-source',
					video: profile.width && profile.height && profile.bitrate && profile.framerate
						? {
								contentType: profile.contentType,
								width: profile.width,
								height: profile.height,
								bitrate: profile.bitrate,
								framerate: profile.framerate,
							}
						: undefined,
					audio: !profile.width
						? { contentType: profile.contentType }
						: undefined,
				} as MediaDecodingConfiguration);
				return {
					supported: info.supported,
					smooth: info.smooth,
					powerEfficient: info.powerEfficient,
				};
			}
			catch {
				return {
					supported: false,
					smooth: false,
					powerEfficient: false,
				};
			}
		},

		async supportedCodecs(): Promise<readonly string[]> {
			if (typeof MediaSource === 'undefined' || typeof MediaSource.isTypeSupported !== 'function') {
				return [];
			}
			return _CODEC_PROBE_SET.filter(mimeType => MediaSource.isTypeSupported(mimeType));
		},
	};
}

interface DocumentWithFullscreen extends Document {
	webkitFullscreenElement?: Element | null;
	msFullscreenElement?: Element | null;
	webkitExitFullscreen?: () => Promise<void>;
	msExitFullscreen?: () => Promise<void>;
}

interface ElementWithFullscreen extends HTMLElement {
	webkitRequestFullscreen?: () => Promise<void>;
	msRequestFullscreen?: () => Promise<void>;
}

function browserFullscreenController(): IFullscreenController {
	const getFsEl = (): Element | null | undefined => {
		const doc = document as DocumentWithFullscreen;
		return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement;
	};
	return {
		async enter(target) {
			const el = target as ElementWithFullscreen;
			const req = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
			if (!req) {
				throw new BrowserPolicyError({
					code: 'core:policy/fullscreenUnsupported',
					severity: 'error',
					scope: { kind: 'core' },
					message: 'Fullscreen not supported in this environment.',
				});
			}
			await req.call(el);
		},
		async exit() {
			const doc = document as DocumentWithFullscreen;
			const ex = doc.exitFullscreen ?? doc.webkitExitFullscreen ?? doc.msExitFullscreen;
			if (!ex)
				return;
			await ex.call(doc);
		},
		isActive() {
			return !!getFsEl();
		},
		isSupported() {
			if (typeof document === 'undefined')
				return false;
			const el = document.documentElement as ElementWithFullscreen;
			return !!(el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen);
		},
		subscribe(fn) {
			if (typeof document === 'undefined')
				return () => {};
			const handler = (): void => fn(!!getFsEl());
			document.addEventListener('fullscreenchange', handler);
			document.addEventListener('webkitfullscreenchange', handler);
			document.addEventListener('msfullscreenchange', handler);
			return () => {
				document.removeEventListener('fullscreenchange', handler);
				document.removeEventListener('webkitfullscreenchange', handler);
				document.removeEventListener('msfullscreenchange', handler);
			};
		},
	};
}

interface PipDocumentLike {
	pictureInPictureElement?: Element | null;
	exitPictureInPicture?: () => Promise<void>;
}

interface PipVideoLike {
	requestPictureInPicture?: () => Promise<unknown>;
}

function browserPipController(): IPipController {
	return {
		async enter(element) {
			const el = element as unknown as PipVideoLike;
			if (!el.requestPictureInPicture) {
				throw new BrowserPolicyError({
					code: 'core:policy/pipUnsupported',
					severity: 'error',
					scope: { kind: 'core' },
					message: 'Picture-in-picture not supported in this environment.',
				});
			}
			await el.requestPictureInPicture();
		},
		async exit() {
			const doc = document as unknown as PipDocumentLike;
			if (doc.exitPictureInPicture && doc.pictureInPictureElement)
				await doc.exitPictureInPicture();
		},
		isActive() {
			const doc = document as unknown as PipDocumentLike;
			return !!doc.pictureInPictureElement;
		},
		isSupported() {
			if (typeof document === 'undefined')
				return false;
			return !!(document as unknown as PipDocumentLike).exitPictureInPicture;
		},
		subscribe(fn) {
			if (typeof document === 'undefined')
				return () => {};
			const enter = (): void => fn(true);
			const leave = (): void => fn(false);
			document.addEventListener('enterpictureinpicture', enter);
			document.addEventListener('leavepictureinpicture', leave);
			return () => {
				document.removeEventListener('enterpictureinpicture', enter);
				document.removeEventListener('leavepictureinpicture', leave);
			};
		},
	};
}

/**
 * Ready-to-use browser platform. Pass this to `setup()` when targeting a
 * standard web browser — it is the default when `platform` is omitted from
 * the setup call.
 *
 * Each getter constructs a fresh controller instance on access, so partial
 * spreads stay independent:
 *
 * ```ts
 * // Replace only wake-lock; everything else stays browser-native.
 * setup({ platform: { ...browserPlatform, wakeLock: capacitorWakeLock } });
 * ```
 *
 * Every sub-controller degrades gracefully: SSR environments (no `window`,
 * no `document`) never throw — they return safe no-op or `false` values
 * rather than crashing.
 */
export const browserPlatform: IPlatform = {
	get wakeLock() { return browserWakeLock(); },
	get network() { return browserNetworkMonitor(); },
	get visibility() { return browserVisibilityMonitor(); },
	get capabilities() { return browserCapabilitiesProbe(); },
	get fullscreen() { return browserFullscreenController(); },
	get pip() { return browserPipController(); },
};
