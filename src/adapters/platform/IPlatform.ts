/**
 * Platform abstraction. Bundles every primitive the kit hardcodes against
 * browser APIs so native-shell consumers (Capacitor, Tauri, Electron) inject
 * native equivalents in one swap.
 *
 * The default `browserPlatform` ships with the kit and works in any modern
 * browser. Adapter packages live outside the kit:
 *  - `@nomercy/platform-capacitor`
 *  - `@nomercy/platform-tauri`
 *  - `@nomercy/platform-electron`
 *
 * Partial overrides compose cleanly — spread `browserPlatform` and replace
 * only the controllers you need to swap:
 *
 * ```ts
 * setup({ platform: { ...browserPlatform, wakeLock: capacitorWakeLock } });
 * ```
 *
 * `fullscreen` and `pip` are video-only. The audio player never touches them.
 * The video player throws a descriptive `BrowserPolicyError` if either is
 * invoked when the field was not supplied.
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

/**
 * Prevents the device display from sleeping while media is playing.
 *
 * `acquire()` throws `BrowserPolicyError('core:policy/wakeLockUnsupported')`
 * when the environment does not support the Screen Wake Lock API. Call
 * `isSupported()` first if you need to gate the feature.
 *
 * Native-shell adapters (Capacitor, Tauri) replace this with a platform
 * keep-awake call rather than the browser API.
 */
export interface IWakeLock {
	acquire(): Promise<void>;
	release(): Promise<void>;
	isHeld(): boolean;
	isSupported?(): boolean | Promise<boolean>;
}

// ─────────────────────────────────────────────────────────────────────────
// Network monitor
// ─────────────────────────────────────────────────────────────────────────

/** Canonical network connection type reported by `INetworkMonitor.type()`. */
export type NetworkType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';

/**
 * Read-only view of the host device's network state.
 *
 * `subscribe()` fires whenever online/offline status or connection type
 * changes. The returned function tears down the subscription — always call
 * it when the consumer is disposed to avoid leaks.
 *
 * `downlinkMbps()` and `rttMs()` return `undefined` on browsers where the
 * Network Information API is absent (Firefox, Safari as of 2025).
 */
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

/**
 * Tracks whether the browser tab (or app window) is currently visible to
 * the user.
 *
 * The player uses this to pause or reduce quality when the tab is hidden
 * and resume when it comes back. `subscribe()` returns a teardown function.
 */
export interface IVisibilityMonitor {
	isVisible(): boolean;
	subscribe(fn: (visible: boolean) => void): () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Capabilities probe
// ─────────────────────────────────────────────────────────────────────────

/**
 * Describes a decode scenario to test with `ICapabilitiesProbe.canDecode()`.
 *
 * Supply `width`, `height`, `bitrate`, and `framerate` for a video probe.
 * Omit all four for an audio-only probe — `contentType` alone is enough.
 */
export interface DecodeProfile {
	contentType: string;
	width?: number;
	height?: number;
	bitrate?: number;
	framerate?: number;
}

/**
 * Result returned by `ICapabilitiesProbe.canDecode()`.
 *
 * `supported` — the browser can decode the content at all.
 * `smooth` — decoding is expected to stay smooth (no dropped frames).
 * `powerEfficient` — hardware acceleration is available for this profile.
 */
export interface DecodeCapability {
	supported: boolean;
	smooth: boolean;
	powerEfficient: boolean;
}

/**
 * Queries the runtime for hardware decode capabilities before committing to
 * a stream variant.
 *
 * The ABR logic calls `canDecode()` to skip variants the device can't handle
 * smoothly before they're selected. Adapters for native shells can route this
 * to platform-native capability APIs instead of `MediaCapabilities`.
 */
export interface ICapabilitiesProbe {
	canDecode(profile: DecodeProfile): Promise<DecodeCapability>;
	supportedCodecs?(): Promise<readonly string[]>;
}

// ─────────────────────────────────────────────────────────────────────────
// Fullscreen + PiP (video only)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Controls browser fullscreen for a target element.
 *
 * `enter(target)` throws `BrowserPolicyError('core:policy/fullscreenUnsupported')`
 * when the Fullscreen API is absent. Check `isSupported()` before offering the
 * control to the user.
 *
 * `subscribe()` fires on every enter/exit transition and returns a teardown
 * function. The video player uses this to sync the `fullscreen` state class
 * on the player container.
 */
export interface IFullscreenController {
	enter(target: HTMLElement): Promise<void>;
	exit(): Promise<void>;
	isActive(): boolean;
	isSupported(): boolean;
	subscribe(fn: (active: boolean) => void): () => void;
}

/**
 * Controls Picture-in-Picture for a `<video>` element.
 *
 * `enter(element)` throws `BrowserPolicyError('core:policy/pipUnsupported')`
 * when the API is absent. Check `isSupported()` before offering the control.
 *
 * `subscribe()` fires on enter/leave and returns a teardown function.
 */
export interface IPipController {
	enter(element: HTMLVideoElement): Promise<void>;
	exit(): Promise<void>;
	isActive(): boolean;
	isSupported(): boolean;
	subscribe(fn: (active: boolean) => void): () => void;
}
