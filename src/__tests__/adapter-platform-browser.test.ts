// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * browserPlatform behavioral tests.
 *
 * Covers: wake lock acquire/release/isHeld/isSupported, network monitor
 * (isOnline/type/downlinkMbps/rttMs/subscribe callback wiring), visibility
 * monitor (isVisible/subscribe), fullscreen controller (enter/exit/isActive/
 * isSupported/subscribe), pip controller (enter/exit/isActive/isSupported/
 * subscribe), capabilities.canDecode.
 *
 * Note: capabilities.supportedCodecs() is already covered in
 * platform-capabilities.test.ts — not duplicated.
 *
 * All browser APIs absent in happy-dom are mocked minimally so the REAL
 * adapter code runs and we assert it called the right methods.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPolicyError } from '../errors';
import { browserPlatform } from '../adapters/platform/browser';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
// Wake lock
// ─────────────────────────────────────────────────────────────────────────────

describe('browserPlatform.wakeLock', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		// Clean up any navigator.wakeLock we installed
		if (Object.getOwnPropertyDescriptor(navigator, 'wakeLock')) {
			try {
				Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true, writable: true });
			}
			catch { /* ignore */ }
		}
	});

	it('isSupported() returns false when navigator.wakeLock is absent', () => {
		Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true, writable: true });
		const wl = browserPlatform.wakeLock;
		expect(wl.isSupported()).toBe(false);
	});

	it('isSupported() returns true when navigator.wakeLock is present', () => {
		Object.defineProperty(navigator, 'wakeLock', {
			value: { request: vi.fn() },
			configurable: true,
			writable: true,
		});
		const wl = browserPlatform.wakeLock;
		expect(wl.isSupported()).toBe(true);
	});

	it('acquire() throws BrowserPolicyError when wakeLock not supported', async () => {
		Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true, writable: true });
		const wl = browserPlatform.wakeLock;
		await expect(wl.acquire()).rejects.toBeInstanceOf(BrowserPolicyError);
	});

	it('acquire() throws with code core:policy/wakeLockUnsupported', async () => {
		Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true, writable: true });
		const wl = browserPlatform.wakeLock;
		try {
			await wl.acquire();
		}
		catch (err) {
			expect((err as BrowserPolicyError).code).toBe('core:policy/wakeLockUnsupported');
		}
	});

	it('acquire() calls navigator.wakeLock.request("screen") when supported', async () => {
		const sentinelMock = { released: false, release: vi.fn().mockResolvedValue(undefined) };
		const requestMock = vi.fn().mockResolvedValue(sentinelMock);
		Object.defineProperty(navigator, 'wakeLock', {
			value: { request: requestMock },
			configurable: true,
			writable: true,
		});
		const wl = browserPlatform.wakeLock;
		await wl.acquire();
		expect(requestMock).toHaveBeenCalledWith('screen');
	});

	it('isHeld() returns true after acquire() and false after release()', async () => {
		const sentinelMock = { released: false, release: vi.fn().mockImplementation(async () => { sentinelMock.released = true; }) };
		const requestMock = vi.fn().mockResolvedValue(sentinelMock);
		Object.defineProperty(navigator, 'wakeLock', {
			value: { request: requestMock },
			configurable: true,
			writable: true,
		});
		const wl = browserPlatform.wakeLock;
		await wl.acquire();
		expect(wl.isHeld()).toBe(true);
		await wl.release();
		expect(wl.isHeld()).toBe(false);
	});

	it('release() is a no-op when not held', async () => {
		const wl = browserPlatform.wakeLock;
		await expect(wl.release()).resolves.toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Network monitor
// ─────────────────────────────────────────────────────────────────────────────

describe('browserPlatform.network', () => {
	beforeEach(() => {
		vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('isOnline() returns navigator.onLine', () => {
		const net = browserPlatform.network;
		expect(net.isOnline()).toBe(true);
	});

	it('isOnline() returns false when navigator.onLine is false', () => {
		vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		const net = browserPlatform.network;
		expect(net.isOnline()).toBe(false);
	});

	it('type() returns "unknown" when connection absent', () => {
		const navWithConn = navigator as unknown as AnyRecord;
		const original = navWithConn.connection;
		navWithConn.connection = undefined;
		const net = browserPlatform.network;
		expect(net.type()).toBe('unknown');
		navWithConn.connection = original;
	});

	it('type() maps known connection types', () => {
		const navWithConn = navigator as unknown as AnyRecord;
		const original = navWithConn.connection;

		navWithConn.connection = { type: 'wifi' };
		expect(browserPlatform.network.type()).toBe('wifi');

		navWithConn.connection = { type: 'cellular' };
		expect(browserPlatform.network.type()).toBe('cellular');

		navWithConn.connection = { type: 'ethernet' };
		expect(browserPlatform.network.type()).toBe('ethernet');

		navWithConn.connection = { type: 'none' };
		expect(browserPlatform.network.type()).toBe('none');

		navWithConn.connection = { type: 'bluetooth' };
		expect(browserPlatform.network.type()).toBe('unknown');

		navWithConn.connection = original;
	});

	it('downlinkMbps() returns connection.downlink', () => {
		const navWithConn = navigator as unknown as AnyRecord;
		const original = navWithConn.connection;
		navWithConn.connection = { downlink: 10.5, rtt: 40 };
		expect(browserPlatform.network.downlinkMbps()).toBe(10.5);
		navWithConn.connection = original;
	});

	it('rttMs() returns connection.rtt', () => {
		const navWithConn = navigator as unknown as AnyRecord;
		const original = navWithConn.connection;
		navWithConn.connection = { downlink: 5, rtt: 75 };
		expect(browserPlatform.network.rttMs()).toBe(75);
		navWithConn.connection = original;
	});

	it('subscribe() registers window online/offline listeners and returns unsubscribe', () => {
		const addSpy = vi.spyOn(window, 'addEventListener');
		const removeSpy = vi.spyOn(window, 'removeEventListener');
		const net = browserPlatform.network;

		const fn = vi.fn();
		const unsub = net.subscribe(fn);

		expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

		unsub();
		expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
	});

	it('subscribe() fires callback when online event fires', () => {
		const fn = vi.fn();
		const net = browserPlatform.network;
		const unsub = net.subscribe(fn);

		window.dispatchEvent(new Event('online'));

		expect(fn).toHaveBeenCalledWith(expect.objectContaining({ online: true }));
		unsub();
	});

	it('subscribe() fires callback when offline event fires', () => {
		vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
		const fn = vi.fn();
		const net = browserPlatform.network;
		const unsub = net.subscribe(fn);

		window.dispatchEvent(new Event('offline'));

		expect(fn).toHaveBeenCalledWith(expect.objectContaining({ online: false }));
		unsub();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Visibility monitor
// ─────────────────────────────────────────────────────────────────────────────

describe('browserPlatform.visibility', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('isVisible() returns true when visibilityState is "visible"', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible',
		});
		const vis = browserPlatform.visibility;
		expect(vis.isVisible()).toBe(true);
	});

	it('isVisible() returns false when visibilityState is "hidden"', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'hidden',
		});
		const vis = browserPlatform.visibility;
		expect(vis.isVisible()).toBe(false);
	});

	it('subscribe() registers visibilitychange listener and returns unsubscribe', () => {
		const addSpy = vi.spyOn(document, 'addEventListener');
		const removeSpy = vi.spyOn(document, 'removeEventListener');
		const vis = browserPlatform.visibility;

		const fn = vi.fn();
		const unsub = vis.subscribe(fn);

		expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

		unsub();
		expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
	});

	it('subscribe() fires callback with visible=true when visibility becomes visible', () => {
		Object.defineProperty(document, 'visibilityState', {
			configurable: true,
			get: () => 'visible',
		});
		const fn = vi.fn();
		const vis = browserPlatform.visibility;
		const unsub = vis.subscribe(fn);

		document.dispatchEvent(new Event('visibilitychange'));

		expect(fn).toHaveBeenCalledWith(true);
		unsub();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Fullscreen controller
// ─────────────────────────────────────────────────────────────────────────────

describe('browserPlatform.fullscreen', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('isSupported() returns true when requestFullscreen is available', () => {
		Object.defineProperty(document.documentElement, 'requestFullscreen', {
			configurable: true,
			value: vi.fn(),
		});
		const fs = browserPlatform.fullscreen;
		expect(fs.isSupported()).toBe(true);
	});

	it('isActive() returns false when no fullscreenElement', () => {
		Object.defineProperty(document, 'fullscreenElement', {
			configurable: true,
			get: () => null,
		});
		const fs = browserPlatform.fullscreen;
		expect(fs.isActive()).toBe(false);
	});

	it('isActive() returns true when fullscreenElement is set', () => {
		Object.defineProperty(document, 'fullscreenElement', {
			configurable: true,
			get: () => document.createElement('div'),
		});
		const fs = browserPlatform.fullscreen;
		expect(fs.isActive()).toBe(true);
	});

	it('enter() throws BrowserPolicyError when requestFullscreen is unavailable', async () => {
		const el = document.createElement('div');
		// Remove any requestFullscreen so the error path fires
		Object.defineProperty(el, 'requestFullscreen', { configurable: true, value: undefined });
		Object.defineProperty(el, 'webkitRequestFullscreen', { configurable: true, value: undefined });
		Object.defineProperty(el, 'msRequestFullscreen', { configurable: true, value: undefined });

		const fs = browserPlatform.fullscreen;
		await expect(fs.enter(el)).rejects.toBeInstanceOf(BrowserPolicyError);
	});

	it('enter() throws with code core:policy/fullscreenUnsupported', async () => {
		const el = document.createElement('div');
		Object.defineProperty(el, 'requestFullscreen', { configurable: true, value: undefined });
		Object.defineProperty(el, 'webkitRequestFullscreen', { configurable: true, value: undefined });
		Object.defineProperty(el, 'msRequestFullscreen', { configurable: true, value: undefined });

		const fs = browserPlatform.fullscreen;
		try {
			await fs.enter(el);
		}
		catch (err) {
			expect((err as BrowserPolicyError).code).toBe('core:policy/fullscreenUnsupported');
		}
	});

	it('enter() calls requestFullscreen on the element', async () => {
		const el = document.createElement('div');
		const requestFn = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(el, 'requestFullscreen', { configurable: true, value: requestFn });

		const fs = browserPlatform.fullscreen;
		await fs.enter(el);
		expect(requestFn).toHaveBeenCalledOnce();
	});

	it('subscribe() registers fullscreenchange listener and unsubscribe removes it', () => {
		const addSpy = vi.spyOn(document, 'addEventListener');
		const removeSpy = vi.spyOn(document, 'removeEventListener');
		const fs = browserPlatform.fullscreen;

		const fn = vi.fn();
		const unsub = fs.subscribe(fn);

		expect(addSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));

		unsub();
		expect(removeSpy).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
	});

	it('subscribe() fires callback with fullscreen state when fullscreenchange fires', () => {
		Object.defineProperty(document, 'fullscreenElement', {
			configurable: true,
			get: () => document.createElement('div'),
		});

		const fn = vi.fn();
		const fs = browserPlatform.fullscreen;
		const unsub = fs.subscribe(fn);

		document.dispatchEvent(new Event('fullscreenchange'));

		expect(fn).toHaveBeenCalledWith(true);
		unsub();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// PiP controller
// ─────────────────────────────────────────────────────────────────────────────

describe('browserPlatform.pip', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('isSupported() returns true when exitPictureInPicture is available', () => {
		Object.defineProperty(document, 'exitPictureInPicture', {
			configurable: true,
			value: vi.fn(),
		});
		const pip = browserPlatform.pip;
		expect(pip.isSupported()).toBe(true);
	});

	it('isActive() returns false when no pictureInPictureElement', () => {
		Object.defineProperty(document, 'pictureInPictureElement', {
			configurable: true,
			get: () => null,
		});
		const pip = browserPlatform.pip;
		expect(pip.isActive()).toBe(false);
	});

	it('enter() throws BrowserPolicyError when requestPictureInPicture is absent', async () => {
		const el = document.createElement('video');
		Object.defineProperty(el, 'requestPictureInPicture', { configurable: true, value: undefined });

		const pip = browserPlatform.pip;
		await expect(pip.enter(el)).rejects.toBeInstanceOf(BrowserPolicyError);
	});

	it('enter() throws with code core:policy/pipUnsupported', async () => {
		const el = document.createElement('video');
		Object.defineProperty(el, 'requestPictureInPicture', { configurable: true, value: undefined });

		const pip = browserPlatform.pip;
		try {
			await pip.enter(el);
		}
		catch (err) {
			expect((err as BrowserPolicyError).code).toBe('core:policy/pipUnsupported');
		}
	});

	it('enter() calls requestPictureInPicture on the element', async () => {
		const el = document.createElement('video');
		const requestFn = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(el, 'requestPictureInPicture', { configurable: true, value: requestFn });

		const pip = browserPlatform.pip;
		await pip.enter(el);
		expect(requestFn).toHaveBeenCalledOnce();
	});

	it('exit() no-ops when no pip element is active', async () => {
		Object.defineProperty(document, 'pictureInPictureElement', {
			configurable: true,
			get: () => null,
		});
		const pip = browserPlatform.pip;
		await expect(pip.exit()).resolves.toBeUndefined();
	});

	it('subscribe() registers enter/leave pip event listeners and unsubscribe removes them', () => {
		const addSpy = vi.spyOn(document, 'addEventListener');
		const removeSpy = vi.spyOn(document, 'removeEventListener');
		const pip = browserPlatform.pip;

		const fn = vi.fn();
		const unsub = pip.subscribe(fn);

		expect(addSpy).toHaveBeenCalledWith('enterpictureinpicture', expect.any(Function));
		expect(addSpy).toHaveBeenCalledWith('leavepictureinpicture', expect.any(Function));

		unsub();
		expect(removeSpy).toHaveBeenCalledWith('enterpictureinpicture', expect.any(Function));
		expect(removeSpy).toHaveBeenCalledWith('leavepictureinpicture', expect.any(Function));
	});

	it('subscribe() fires fn(true) on enterpictureinpicture', () => {
		const fn = vi.fn();
		const pip = browserPlatform.pip;
		const unsub = pip.subscribe(fn);

		document.dispatchEvent(new Event('enterpictureinpicture'));

		expect(fn).toHaveBeenCalledWith(true);
		unsub();
	});

	it('subscribe() fires fn(false) on leavepictureinpicture', () => {
		const fn = vi.fn();
		const pip = browserPlatform.pip;
		const unsub = pip.subscribe(fn);

		document.dispatchEvent(new Event('leavepictureinpicture'));

		expect(fn).toHaveBeenCalledWith(false);
		unsub();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// canDecode
// ─────────────────────────────────────────────────────────────────────────────

describe('browserPlatform.capabilities.canDecode()', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('returns { supported: false, smooth: false, powerEfficient: false } when mediaCapabilities absent', async () => {
		const savedMC = navigator.mediaCapabilities;
		Object.defineProperty(navigator, 'mediaCapabilities', {
			configurable: true,
			value: undefined,
		});

		const result = await browserPlatform.capabilities.canDecode({ contentType: 'video/mp4; codecs="avc1.42E01E"' });
		expect(result.supported).toBe(false);
		expect(result.smooth).toBe(false);
		expect(result.powerEfficient).toBe(false);

		Object.defineProperty(navigator, 'mediaCapabilities', { configurable: true, value: savedMC });
	});

	it('returns { supported: false } when decodingInfo throws', async () => {
		Object.defineProperty(navigator, 'mediaCapabilities', {
			configurable: true,
			value: {
				decodingInfo: vi.fn().mockRejectedValue(new Error('decode error')),
			},
		});

		const result = await browserPlatform.capabilities.canDecode({
			contentType: 'video/mp4; codecs="avc1.42E01E"',
			width: 1920,
			height: 1080,
			bitrate: 5000000,
			framerate: 30,
		});
		expect(result.supported).toBe(false);
	});

	it('returns decodingInfo result when available', async () => {
		Object.defineProperty(navigator, 'mediaCapabilities', {
			configurable: true,
			value: {
				decodingInfo: vi.fn().mockResolvedValue({ supported: true, smooth: true, powerEfficient: false }),
			},
		});

		const result = await browserPlatform.capabilities.canDecode({
			contentType: 'video/mp4; codecs="avc1.42E01E"',
			width: 1920,
			height: 1080,
			bitrate: 5000000,
			framerate: 30,
		});
		expect(result.supported).toBe(true);
		expect(result.smooth).toBe(true);
		expect(result.powerEfficient).toBe(false);
	});
});
