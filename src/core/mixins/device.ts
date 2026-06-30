// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { DeviceCapabilities } from '../../types';
import type { Internals } from '../state';

import { browserPlatform } from '../../adapters/platform/browser';

// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by deviceMethods
// ──────────────────────────────────────────────────────────────────────────

interface DetectedDevice {
	isTv: boolean;
	isMobile: boolean;
	isDesktop: boolean;
	os: 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown';
}

let _cachedDevice: DetectedDevice | undefined;

/**
 * UA-based device classification. Order matters: TV detection runs FIRST so
 * "Smart-TV running Android" is classified as TV, not Mobile. Mobile second.
 * Desktop is the catch-all.
 *
 * Result is cached after the first call — UA does not change at runtime.
 * Detection is best-effort — UA strings lie. Consumers needing better signals
 * should swap `platform.capabilities` with a probe-based bridge.
 */
function _detectDevice(): DetectedDevice {
	if (_cachedDevice !== undefined)
		return _cachedDevice;

	if (typeof navigator === 'undefined') {
		_cachedDevice = {
			isTv: false,
			isMobile: false,
			isDesktop: true,
			os: 'unknown',
		};
		return _cachedDevice;
	}

	const ua = navigator.userAgent || '';
	const tvHints = /\b(?:SmartTV|GoogleTV|AppleTV|HbbTV|NetCast|WebOS|Tizen|VIDAA|BRAVIA|AFTS|AFTM|AFTB|AFTT|AFTN|FireTV|Crkey|PlayStation|Xbox)\b/i;
	const isTv = tvHints.test(ua);
	const mobileHints = /\b(?:Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|Opera Mini)\b/i;
	const isMobile = !isTv && mobileHints.test(ua);
	const isDesktop = !isTv && !isMobile;

	let os: DetectedDevice['os'] = 'unknown';
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

	_cachedDevice = {
		isTv,
		isMobile,
		isDesktop,
		os,
	};
	return _cachedDevice;
}

// ──────────────────────────────────────────────────────────────────────────
// Mixin: device capabilities — `isTv`, `isMobile`, `isDesktop`, `device`.
// ──────────────────────────────────────────────────────────────────────────

export const deviceMethods = {
	/**
	 * Whether the current environment appears to be a Smart TV or set-top
	 * box. Detection is UA-based and best-effort — see `_detectDevice` for
	 * the full list of UA hints consulted.
	 */
	isTv(this: Internals): boolean {
		return _detectDevice().isTv;
	},

	/**
	 * Whether the current environment appears to be a mobile phone or
	 * tablet. Returns `false` on TV environments even when the OS is
	 * Android — TV detection takes priority.
	 */
	isMobile(this: Internals): boolean {
		return _detectDevice().isMobile;
	},

	/**
	 * Whether the current environment is classified as desktop — the
	 * catch-all when neither TV nor mobile hints are detected in the UA.
	 */
	isDesktop(this: Internals): boolean {
		return _detectDevice().isDesktop;
	},

	/**
	 * Full device capabilities snapshot. Combines UA-based device
	 * classification with platform API probes:
	 * - `fullscreenSupported` — from the platform's fullscreen bridge.
	 * - `pipSupported` — from the platform's PiP bridge.
	 * - `webLocksSupported` — `'locks' in navigator` probe.
	 * - `autoplayAllowed` — always `'unknown'`; synchronous detection is
	 *   unreliable. The real answer emerges when the player attempts
	 *   autoplay and handles a NotAllowedError from the backend.
	 * - `preferred` — `'powerEfficient'` on TV and mobile, `'smooth'` on
	 *   desktop; used by quality selection heuristics.
	 */
	device(this: Internals): DeviceCapabilities {
		const detected = _detectDevice();
		const platform = this._platform ?? browserPlatform;
		const fullscreenSupported = platform.fullscreen?.isSupported() ?? false;
		const pipSupported = platform.pip?.isSupported() ?? false;
		const webLocksSupported = typeof navigator !== 'undefined' && 'locks' in navigator;
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
