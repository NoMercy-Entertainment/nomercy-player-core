import { BrowserPolicyError } from './errors';

/**
 * Platform abstraction. Bundles every primitive the kit hardcodes against
 * browser APIs so native-shell consumers (Capacitor, Tauri, Electron) inject
 * native equivalents in one swap.
 *
 * Default `browserPlatform` ships with the kit. Adapter packages live outside:
 *  - `@nomercy/platform-capacitor`
 *  - `@nomercy/platform-tauri`
 *  - `@nomercy/platform-electron`
 *
 * Partial overrides compose:
 *
 * ```ts
 * setup({ platform: { ...browserPlatform, wakeLock: capacitorWakeLock } });
 * ```
 *
 * Video-only controllers (`fullscreen`, `pip`) are optional on the bundle —
 * the audio player ignores them; the video player throws a descriptive error
 * if a missing controller is invoked (rather than silently failing).
 */
export interface IPlatform {
	wakeLock: IWakeLock;
	network: INetworkMonitor;
	visibility: IVisibilityMonitor;
	capabilities: ICapabilitiesProbe;
	/** Video player only. Required when wiring a video player. */
	fullscreen?: IFullscreenController;
	/** Video player only. Required when wiring a video player. */
	pip?: IPipController;
}

// ─────────────────────────────────────────────────────────────────────────
// Wake-lock
// ─────────────────────────────────────────────────────────────────────────

export interface IWakeLock {
	acquire(): Promise<void>;
	release(): Promise<void>;
	isHeld(): boolean;
	isSupported?(): boolean | Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────
// Network monitor
// ─────────────────────────────────────────────────────────────────────────

export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

export interface INetworkMonitor {
	isOnline(): boolean;
	type(): NetworkType;
	downlinkMbps(): number | undefined;
	rttMs(): number | undefined;
	subscribe(fn: (state: { online: boolean; type: NetworkType }) => void): () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Visibility monitor
// ─────────────────────────────────────────────────────────────────────────

export interface IVisibilityMonitor {
	isVisible(): boolean;
	subscribe(fn: (visible: boolean) => void): () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Capabilities probe
// ─────────────────────────────────────────────────────────────────────────

export interface DecodeProfile {
	contentType: string;
	width?: number;
	height?: number;
	bitrate?: number;
	framerate?: number;
}

export interface DecodeCapability {
	supported: boolean;
	smooth: boolean;
	powerEfficient: boolean;
}

export interface ICapabilitiesProbe {
	canDecode(profile: DecodeProfile): Promise<DecodeCapability>;
	supportedCodecs?(): readonly string[] | Promise<readonly string[]>;
}

// ─────────────────────────────────────────────────────────────────────────
// Fullscreen + PiP (video only)
// ─────────────────────────────────────────────────────────────────────────

export interface IFullscreenController {
	enter(target: HTMLElement): Promise<void>;
	exit(): Promise<void>;
	isActive(): boolean;
	isSupported(): boolean;
	subscribe(fn: (active: boolean) => void): () => void;
}

export interface IPipController {
	enter(element: HTMLVideoElement): Promise<void>;
	exit(): Promise<void>;
	isActive(): boolean;
	isSupported(): boolean;
	subscribe(fn: (active: boolean) => void): () => void;
}

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
 * Default browser-API-backed platform. Used when `setup({ platform })` is
 * omitted. Each sub-controller is a thin wrapper around the corresponding
 * browser API with defensive fallbacks for environments where the API is
 * absent (older browsers, SSR).
 */
export const browserPlatform: IPlatform = {
	get wakeLock() { return browserWakeLock(); },
	get network() { return browserNetworkMonitor(); },
	get visibility() { return browserVisibilityMonitor(); },
	get capabilities() { return browserCapabilitiesProbe(); },
	get fullscreen() { return browserFullscreenController(); },
	get pip() { return browserPipController(); },
};
