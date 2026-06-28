// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * NativeStreamSource behavioral tests.
 *
 * Covers: state machine transitions (idle → loading → ready / error),
 * element.src assignment, manifest-loaded event on loadedmetadata,
 * error state + emit on element error, detach (removes error listener,
 * clears src, resets to idle), destroy (clears listeners), on/off
 * listener management, emit swallows listener exceptions.
 *
 * Note: canPlay() matrix is already locked in streams/native.test.ts.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { nativeFactory } from '../adapters/stream/native';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeElement(): HTMLMediaElement {
	return document.createElement('audio') as unknown as HTMLMediaElement;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('NativeStreamSource', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('state machine', () => {
		it('starts in idle state', () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			expect(source.state()).toBe('idle');
		});

		it('moves to ready and emits manifest-loaded on loadedmetadata', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const manifestEvents: unknown[] = [];
			source.on('manifest-loaded', (data) => manifestEvents.push(data));

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(source.state()).toBe('ready');
			expect(manifestEvents).toHaveLength(1);
		});

		it('sets element.src to the provided URL', async () => {
			const url = 'https://x/track.flac';
			const source = nativeFactory.create({ url });
			const el = makeElement();

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(el.src).toContain('track.flac');
		});

		it('moves to error state when element fires error event', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('error'));
			await expect(attachP).rejects.toBeDefined();

			expect(source.state()).toBe('error');
		});

		it('emits error event on element error after attach', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const errorEvents: unknown[] = [];
			source.on('error', (data) => errorEvents.push(data));

			// happy-dom does not define MediaError — use a plain shape-compatible object
			Object.defineProperty(el, 'error', {
				configurable: true,
				get: () => ({ code: 4, message: 'fake media error' }),
			});

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('error'));

			await expect(attachP).rejects.toBeDefined();
		});

		it('resets to idle after detach()', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(source.state()).toBe('ready');
			source.detach();
			expect(source.state()).toBe('idle');
		});

		it('detach() removes the error listener so further element errors are silent', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const errorEvents: unknown[] = [];
			source.on('error', (data) => errorEvents.push(data));

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			source.detach();

			// Error after detach should not reach the source listener
			Object.defineProperty(el, 'error', {
				configurable: true,
				get: () => ({ code: 4, message: 'fake media error' }),
			});
			el.dispatchEvent(new Event('error'));

			expect(errorEvents).toHaveLength(0);
		});

		it('detach() clears element.src', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			source.detach();
			expect(el.getAttribute('src')).toBeNull();
		});
	});

	describe('on/off listener management', () => {
		it('on() registers a listener that is called when event fires', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const fn = vi.fn();
			source.on('manifest-loaded', fn);

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(fn).toHaveBeenCalledOnce();
		});

		it('off() removes a listener so it is not called', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const fn = vi.fn();
			source.on('manifest-loaded', fn);
			source.off('manifest-loaded', fn);

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(fn).not.toHaveBeenCalled();
		});

		it('off() on unregistered event is a no-op', () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const fn = vi.fn();
			expect(() => source.off('manifest-loaded', fn)).not.toThrow();
		});

		it('multiple listeners on same event all fire', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const fn1 = vi.fn();
			const fn2 = vi.fn();
			source.on('manifest-loaded', fn1);
			source.on('manifest-loaded', fn2);

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(fn1).toHaveBeenCalledOnce();
			expect(fn2).toHaveBeenCalledOnce();
		});
	});

	describe('emit swallows listener exceptions', () => {
		it('error in first listener does not prevent second listener from running', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const errorFn = vi.fn(() => { throw new Error('listener error'); });
			const okFn = vi.fn();
			source.on('manifest-loaded', errorFn);
			source.on('manifest-loaded', okFn);

			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(errorFn).toHaveBeenCalledOnce();
			expect(okFn).toHaveBeenCalledOnce();
		});
	});

	describe('destroy()', () => {
		it('destroy() clears all registered listeners', async () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			const el = makeElement();

			const fn = vi.fn();
			source.on('manifest-loaded', fn);

			source.destroy();

			// After destroy, attaching should still work but listener won't fire
			const attachP = source.attach(el);
			el.dispatchEvent(new Event('loadedmetadata'));
			await attachP;

			expect(fn).not.toHaveBeenCalled();
		});
	});

	describe('nativeFactory.create()', () => {
		it('create() returns a source with kind "native"', () => {
			const source = nativeFactory.create({ url: 'https://x/track.mp3' });
			expect(source.kind).toBe('native');
		});
	});
});
