import type { DeviceCapabilities } from '../../types';
import { browserPlatform } from '../../platform';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by deviceMethods
// ──────────────────────────────────────────────────────────────────────────

/**
 * UA-based device classification. Order matters: TV detection runs FIRST so
 * "Smart-TV running Android" is classified as TV, not Mobile. Mobile second.
 * Desktop is the catch-all.
 *
 * Detection is best-effort — UA strings lie. Consumers needing better signals
 * should swap `platform.capabilities` with a probe-based bridge.
 */
function _detectDevice(): { isTv: boolean; isMobile: boolean; isDesktop: boolean; os: 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown' } {
	if (typeof navigator === 'undefined') {
		return {
			isTv: false,
			isMobile: false,
			isDesktop: true,
			os: 'unknown',
		};
	}
	const ua = navigator.userAgent || '';
	const tvHints = /\b(SmartTV|GoogleTV|AppleTV|HbbTV|NetCast|WebOS|Tizen|VIDAA|BRAVIA|AFTS|AFTM|AFTB|AFTT|AFTN|FireTV|Crkey|PlayStation|Xbox)\b/i;
	const isTv = tvHints.test(ua);
	const mobileHints = /\b(Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|Opera Mini)\b/i;
	const isMobile = !isTv && mobileHints.test(ua);
	const isDesktop = !isTv && !isMobile;

	let os: 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown' = 'unknown';
	if (/Android/i.test(ua))
		os = 'android';
	else if (/iPhone|iPad|iPod/i.test(ua))
		os = 'ios';
	else if (/Mac OS X/i.test(ua))
		os = 'macos';
	else if (/Windows/i.test(ua))
		os = 'windows';
	else if (/Linux/i.test(ua))
		os = 'linux';

	return {
		isTv,
		isMobile,
		isDesktop,
		os,
	};
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: device capabilities — `isTv`, `isMobile`, `isDesktop`, `device`.
// ──────────────────────────────────────────────────────────────────────────

export const deviceMethods = {
	isTv(this: Internals): boolean {
		return _detectDevice().isTv;
	},
	isMobile(this: Internals): boolean {
		return _detectDevice().isMobile;
	},
	isDesktop(this: Internals): boolean {
		return _detectDevice().isDesktop;
	},
	device(this: Internals): DeviceCapabilities {
		const detected = _detectDevice();
		const platform = this._platform ?? browserPlatform;
		const fullscreenSupported = platform.fullscreen?.isSupported() ?? false;
		const pipSupported = platform.pip?.isSupported() ?? false;
		const webLocksSupported = typeof navigator !== 'undefined' && 'locks' in navigator;
		// Autoplay policy is hard to detect synchronously — flag unknown.
		// Experimental, see: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getAutoplayPolicy
		// Real probe lands when the player tries autoplay and catches the rejection.
		return {
			isTv: detected.isTv,
			isMobile: detected.isMobile,
			isDesktop: detected.isDesktop,
			pipSupported,
			fullscreenSupported,
			webLocksSupported,
			autoplayAllowed: 'unknown',
			preferred: detected.isTv || detected.isMobile ? 'powerEfficient' : 'smooth',
		};
	},
} as const;
