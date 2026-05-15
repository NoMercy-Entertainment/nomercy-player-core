import type { CanPlayResult } from '../../types';
import { browserPlatform } from '../../adapters/platform/browser';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: ABR — `bandwidth`, `bandwidthEstimator`, `canPlay`.
// ──────────────────────────────────────────────────────────────────────────

export const abrMethods = {
	/**
	 * Last-known throughput estimate in bits per second. Returns 0 until a
	 * stream is loaded with an estimator wired (consumer or backend).
	 */
	bandwidth(this: Internals): number {
		return this._bandwidthEstimate ?? 0;
	},
	/**
	 * Read or override the bandwidth estimator. Reading returns the current
	 * estimator function (or undefined). Writing replaces it; the new
	 * function is queried by the active stream source on every level decision.
	 */
	bandwidthEstimator(this: Internals, fn?: () => number): (() => number) | void {
		if (fn === undefined)
			return this._bandwidthEstimator;
		this._bandwidthEstimator = fn;
	},
	/**
	 * Probe whether a media profile can be decoded smoothly. Delegates to the
	 * platform's `capabilities.canDecode` bridge. Returns the standard
	 * `MediaCapabilitiesDecodingInfo` shape.
	 */
	async canPlay(this: Internals, profile: { contentType: string; width?: number; height?: number; bitrate?: number; framerate?: number }): Promise<CanPlayResult> {
		const platform = this._platform ?? browserPlatform;
		const result = await platform.capabilities.canDecode(profile);
		return {
			supported: result.supported,
			smooth: result.smooth,
			powerEfficient: result.powerEfficient,
		};
	},
} as const;
