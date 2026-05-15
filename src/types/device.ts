/**
 * Device capability snapshot. Returned by `player.device()`. Aggregates
 * environment detection (`isTv`, `isMobile`, `isDesktop`) with capability
 * probes (`pipSupported`, `autoplayAllowed`, etc.) so plugins and consumers
 * can make a single call to branch on the runtime environment.
 */
export interface DeviceCapabilities {
	/** `true` when the browser is running on an Android TV / smart TV user-agent. */
	isTv: boolean;
	/** `true` when the browser is running on a phone or tablet. */
	isMobile: boolean;
	/** `true` when neither `isTv` nor `isMobile` is true. */
	isDesktop: boolean;
	/** `true` when the Picture-in-Picture API is available in this browser. */
	pipSupported: boolean;
	/** `true` when the Fullscreen API is available in this browser. */
	fullscreenSupported: boolean;
	/** `true` when the Web Locks API is available (used by the wake-lock polyfill). */
	webLocksSupported: boolean;
	/**
	 * Result of the autoplay probe. `true` = silent autoplay permitted;
	 * `false` = blocked; `'unknown'` = probe not yet run or inconclusive.
	 */
	autoplayAllowed: boolean | 'unknown';
	/**
	 * Recommended decode preference for this device. `'smooth'` for
	 * capable machines; `'powerEfficient'` for battery-constrained devices.
	 * Derived from the `MediaCapabilities` API.
	 */
	preferred: 'smooth' | 'powerEfficient';
}
