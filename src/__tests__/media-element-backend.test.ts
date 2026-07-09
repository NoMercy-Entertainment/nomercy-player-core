// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * `MediaElementBackend` — the shared substrate under every
 * `HTMLMediaElement`-backed backend.
 *
 * Tested through a minimal concrete subclass (the class is abstract by
 * design; it has no abstract members, only a subclass contract). happy-dom
 * provides a real `HTMLMediaElement` including `captureStream`, `setSinkId`,
 * `sinkId`, `mediaKeys`, and `setMediaKeys`.
 *
 * Test groups:
 *  - construction — element / ownsElement / backendId storage
 *  - transport — play / pause / stop element forwarding
 *  - time — currentTime / duration / bufferedRanges / seekable / playbackRate
 *  - volume — perceptual-gain write path, clamp, mute / unmute
 *  - loader backpressure — pauseLoader / resumeLoader / loaderState
 *  - capability delegates — captureStream / sinkId / mediaKeys (+ policy errors)
 *  - auth — setAuthHeaderProvider storage
 *  - DOM bridges — attachDomBridges event forwarding + state transitions,
 *    detachDomBridges teardown
 */

import type { BackendState } from '../adapters/media-element/backend-state';
import type { BackendId, HlsHandle } from '../adapters/media-element/helpers';
import type { AuthHeaderProvider, MinimalBackendEventPayload } from '../adapters/media-element/MediaElementBackend';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_STATE } from '../adapters/media-element/backend-state';
import { MediaElementBackend } from '../adapters/media-element/MediaElementBackend';
import { BrowserPolicyError } from '../errors';

class TestBackend extends MediaElementBackend<HTMLMediaElement, MinimalBackendEventPayload> {
	constructor(element: HTMLMediaElement, ownsElement: boolean = true, backendId: BackendId = 'html5') {
		super(element, ownsElement, backendId);
	}

	// ── Public passthroughs to the protected surface for testing ──
	elementRef(): HTMLMediaElement {
		return this.element;
	}

	ownsElementFlag(): boolean {
		return this.ownsElement;
	}

	backendIdValue(): BackendId {
		return this.backendId;
	}

	authHeaderProvider(): AuthHeaderProvider | undefined {
		return this._authHeaderProvider;
	}

	setHlsInstance(handle: HlsHandle | undefined): void {
		this.hlsInstance = handle;
	}

	domHandlerCount(): number {
		return this.domHandlers.length;
	}

	publicAttachDomBridges(
		onStateChange: (state: BackendState) => void,
		getState: () => BackendState,
	): void {
		this.attachDomBridges(onStateChange, getState);
	}

	publicDetachDomBridges(el?: HTMLMediaElement): void {
		this.detachDomBridges(el);
	}
}

function createBackend(): { backend: TestBackend; element: HTMLMediaElement } {
	const element = document.createElement('video');
	const backend = new TestBackend(element);
	return {
		backend,
		element,
	};
}

describe('MediaElementBackend', () => {
	let backend: TestBackend;
	let element: HTMLMediaElement;

	beforeEach(() => {
		({ backend, element } = createBackend());
	});

	// ─────────────────────────────────────────────────────────────────────
	// Construction
	// ─────────────────────────────────────────────────────────────────────

	describe('construction', () => {
		it('stores the element and returns it via mediaElement()', () => {
			expect(backend.elementRef()).toBe(element);
			expect(backend.mediaElement()).toBe(element);
		});

		it('records ownership when the backend created the element', () => {
			const owned = new TestBackend(element, true);
			expect(owned.ownsElementFlag()).toBe(true);
		});

		it('records adoption when the element came from the consumer', () => {
			const adopted = new TestBackend(element, false);
			expect(adopted.ownsElementFlag()).toBe(false);
		});

		it('stores the backend id used for error scoping', () => {
			const audioBackend = new TestBackend(element, true, 'audio-element');
			expect(audioBackend.backendIdValue()).toBe('audio-element');
		});

		it('starts with the loader running, no HLS instance, and no DOM handlers', () => {
			expect(backend.loaderState()).toBe('running');
			expect(backend.domHandlerCount()).toBe(0);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Auth
	// ─────────────────────────────────────────────────────────────────────

	describe('setAuthHeaderProvider()', () => {
		it('starts with no provider', () => {
			expect(backend.authHeaderProvider()).toBeUndefined();
		});

		it('stores the exact provider function for the loader to consume', async () => {
			const provider: AuthHeaderProvider = () => 'Bearer tok-99';
			backend.setAuthHeaderProvider(provider);
			expect(backend.authHeaderProvider()).toBe(provider);
			await expect(Promise.resolve(backend.authHeaderProvider()!())).resolves.toBe('Bearer tok-99');
		});

		it('replaces a previously set provider', () => {
			const first: AuthHeaderProvider = () => 'first';
			const second: AuthHeaderProvider = () => 'second';
			backend.setAuthHeaderProvider(first);
			backend.setAuthHeaderProvider(second);
			expect(backend.authHeaderProvider()).toBe(second);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Transport
	// ─────────────────────────────────────────────────────────────────────

	describe('play() / pause() / stop()', () => {
		it('play() forwards to element.play() and returns its promise', async () => {
			const playSpy = vi.spyOn(element, 'play');
			await expect(backend.play()).resolves.toBeUndefined();
			expect(playSpy).toHaveBeenCalledTimes(1);
		});

		it('play() normalises a non-Promise return (older engines) to a resolved Promise', async () => {
			element.play = ((): undefined => undefined) as unknown as typeof element.play;
			const result = backend.play();
			expect(result).toBeInstanceOf(Promise);
			await expect(result).resolves.toBeUndefined();
		});

		it('pause() forwards to element.pause()', () => {
			const pauseSpy = vi.spyOn(element, 'pause');
			backend.pause();
			expect(pauseSpy).toHaveBeenCalledTimes(1);
		});

		it('stop() pauses and rewinds to zero', () => {
			const pauseSpy = vi.spyOn(element, 'pause');
			element.currentTime = 42;
			backend.stop();
			expect(pauseSpy).toHaveBeenCalledTimes(1);
			expect(element.currentTime).toBe(0);
		});

		it('stop() swallows a currentTime write failure (element not ready)', () => {
			Object.defineProperty(element, 'currentTime', {
				configurable: true,
				get: () => 7,
				set: () => {
					throw new Error('not seekable yet');
				},
			});
			expect(() => backend.stop()).not.toThrow();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Time / position
	// ─────────────────────────────────────────────────────────────────────

	describe('currentTime()', () => {
		it('getter reads element.currentTime', () => {
			element.currentTime = 12.5;
			expect(backend.currentTime()).toBe(12.5);
		});

		it('setter writes element.currentTime', () => {
			backend.currentTime(33);
			expect(element.currentTime).toBe(33);
		});

		it('setter swallows a write failure (element not seekable yet)', () => {
			Object.defineProperty(element, 'currentTime', {
				configurable: true,
				get: () => 0,
				set: () => {
					throw new Error('not seekable yet');
				},
			});
			expect(() => backend.currentTime(10)).not.toThrow();
		});
	});

	describe('duration()', () => {
		it('returns 0 for a fresh element (duration NaN)', () => {
			expect(backend.duration()).toBe(0);
		});

		it('returns the element duration when finite', () => {
			Object.defineProperty(element, 'duration', {
				configurable: true,
				get: () => 321.5,
			});
			expect(backend.duration()).toBe(321.5);
		});

		it('returns 0 for an infinite duration (live stream)', () => {
			Object.defineProperty(element, 'duration', {
				configurable: true,
				get: () => Number.POSITIVE_INFINITY,
			});
			expect(backend.duration()).toBe(0);
		});
	});

	describe('bufferedRanges() / seekable()', () => {
		it('bufferedRanges() returns the element buffered ranges', () => {
			expect(backend.bufferedRanges()).toBe(element.buffered);
		});

		it('seekable() returns the element seekable ranges', () => {
			expect(backend.seekable()).toBe(element.seekable);
		});
	});

	describe('playbackRate()', () => {
		it('getter reads element.playbackRate', () => {
			expect(backend.playbackRate()).toBe(1);
		});

		it('setter writes element.playbackRate', () => {
			backend.playbackRate(1.5);
			expect(element.playbackRate).toBe(1.5);
			expect(backend.playbackRate()).toBe(1.5);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Volume
	// ─────────────────────────────────────────────────────────────────────

	describe('volume() / mute() / unmute()', () => {
		it('getter reads element.volume', () => {
			element.volume = 0.42;
			expect(backend.volume()).toBe(0.42);
		});

		it('setter applies the perceptual gain curve (position squared)', () => {
			backend.volume(0.5);
			expect(element.volume).toBe(0.25);
		});

		it('setter maps the range extremes exactly', () => {
			backend.volume(0);
			expect(element.volume).toBe(0);
			backend.volume(1);
			expect(element.volume).toBe(1);
		});

		it('setter clamps values outside [0, 1] before applying the curve', () => {
			backend.volume(2);
			expect(element.volume).toBe(1);
			backend.volume(-1);
			expect(element.volume).toBe(0);
		});

		it('mute() sets element.muted, unmute() clears it', () => {
			backend.mute();
			expect(element.muted).toBe(true);
			backend.unmute();
			expect(element.muted).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Loader backpressure
	// ─────────────────────────────────────────────────────────────────────

	describe('pauseLoader() / resumeLoader() / loaderState()', () => {
		it('starts in the running state', () => {
			expect(backend.loaderState()).toBe('running');
		});

		it('pauseLoader() stops the HLS pipeline and flips the state', () => {
			const handle: HlsHandle = {
				destroy: vi.fn(),
				stopLoad: vi.fn(),
				startLoad: vi.fn(),
			};
			backend.setHlsInstance(handle);
			backend.pauseLoader();
			expect(handle.stopLoad).toHaveBeenCalledTimes(1);
			expect(backend.loaderState()).toBe('paused');
		});

		it('resumeLoader() restarts the HLS pipeline and flips the state back', () => {
			const handle: HlsHandle = {
				destroy: vi.fn(),
				stopLoad: vi.fn(),
				startLoad: vi.fn(),
			};
			backend.setHlsInstance(handle);
			backend.pauseLoader();
			backend.resumeLoader();
			expect(handle.startLoad).toHaveBeenCalledTimes(1);
			expect(backend.loaderState()).toBe('running');
		});

		it('tracks state symmetrically even without an HLS instance (native / progressive)', () => {
			backend.pauseLoader();
			expect(backend.loaderState()).toBe('paused');
			backend.resumeLoader();
			expect(backend.loaderState()).toBe('running');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Capability delegates
	// ─────────────────────────────────────────────────────────────────────

	describe('captureStream()', () => {
		it('returns a MediaStream from the element', () => {
			const stream = backend.captureStream();
			expect(stream).toBeInstanceOf(MediaStream);
		});

		it('throws BrowserPolicyError with the backend id in scope when unsupported', () => {
			(element as HTMLMediaElement & { captureStream?: unknown }).captureStream = undefined;
			let caught: unknown;
			try {
				backend.captureStream();
			}
			catch (err) {
				caught = err;
			}
			expect(caught).toBeInstanceOf(BrowserPolicyError);
			expect((caught as BrowserPolicyError).code).toBe('core:policy/captureStreamUnsupported');
			expect((caught as BrowserPolicyError).scope).toEqual({
				kind: 'backend',
				id: 'html5',
			});
		});
	});

	describe('setSinkId() / getSinkId()', () => {
		it('getSinkId() defaults to the empty string (default output device)', () => {
			expect(backend.getSinkId()).toBe('');
		});

		it('setSinkId() round-trips through the element', async () => {
			await backend.setSinkId('device-1');
			expect(backend.getSinkId()).toBe('device-1');
		});

		it('setSinkId() rejects with BrowserPolicyError when the API is absent', async () => {
			(element as unknown as { setSinkId?: unknown }).setSinkId = undefined;
			await expect(backend.setSinkId('device-1')).rejects.toBeInstanceOf(BrowserPolicyError);
			await expect(backend.setSinkId('device-1')).rejects.toMatchObject({
				code: 'core:policy/setSinkIdUnsupported',
			});
		});
	});

	describe('mediaKeys() / setMediaKeys()', () => {
		it('mediaKeys() normalises the null default to undefined', () => {
			expect(backend.mediaKeys()).toBeUndefined();
		});

		it('setMediaKeys() round-trips through the element', async () => {
			const keys = { fake: 'media-keys' } as unknown as MediaKeys;
			await backend.setMediaKeys(keys);
			expect(backend.mediaKeys()).toBe(keys);
		});

		it('setMediaKeys() rejects with BrowserPolicyError when EME is absent', async () => {
			(element as unknown as { setMediaKeys?: unknown }).setMediaKeys = undefined;
			const keys = {} as unknown as MediaKeys;
			await expect(backend.setMediaKeys(keys)).rejects.toBeInstanceOf(BrowserPolicyError);
			await expect(backend.setMediaKeys(keys)).rejects.toMatchObject({
				code: 'core:policy/emeUnsupported',
			});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// DOM bridges
	// ─────────────────────────────────────────────────────────────────────

	describe('attachDomBridges() / detachDomBridges()', () => {
		let states: BackendState[];
		let currentState: BackendState;

		beforeEach(() => {
			states = [];
			currentState = BACKEND_STATE.IDLE;
			backend.publicAttachDomBridges(
				(state) => {
					currentState = state;
					states.push(state);
				},
				() => currentState,
			);
		});

		it('tracks every attached handler for later removal', () => {
			expect(backend.domHandlerCount()).toBeGreaterThan(0);
		});

		it('forwards DOM events as backend events', () => {
			const received: string[] = [];
			backend.on('loadstart', () => received.push('loadstart'));
			backend.on('timeupdate', () => received.push('timeupdate'));
			backend.on('ratechange', () => received.push('ratechange'));

			element.dispatchEvent(new Event('loadstart'));
			element.dispatchEvent(new Event('timeupdate'));
			element.dispatchEvent(new Event('ratechange'));

			expect(received).toEqual([
				'loadstart',
				'timeupdate',
				'ratechange',
			]);
		});

		it('maps loadstart → loading, loadedmetadata → ready, play → playing', () => {
			element.dispatchEvent(new Event('loadstart'));
			element.dispatchEvent(new Event('loadedmetadata'));
			element.dispatchEvent(new Event('play'));

			expect(states).toEqual([
				BACKEND_STATE.LOADING,
				BACKEND_STATE.READY,
				BACKEND_STATE.PLAYING,
			]);
		});

		it('maps pause → paused only when not idle and not errored', () => {
			element.dispatchEvent(new Event('play'));
			element.dispatchEvent(new Event('pause'));
			expect(currentState).toBe(BACKEND_STATE.PAUSED);
		});

		it('pause does NOT reset an idle state', () => {
			element.dispatchEvent(new Event('pause'));
			expect(currentState).toBe(BACKEND_STATE.IDLE);
			expect(states).toEqual([]);
		});

		it('pause does NOT reset an error state', () => {
			element.dispatchEvent(new Event('error'));
			expect(currentState).toBe(BACKEND_STATE.ERROR);
			element.dispatchEvent(new Event('pause'));
			expect(currentState).toBe(BACKEND_STATE.ERROR);
		});

		it('maps ended → paused and error → error', () => {
			element.dispatchEvent(new Event('play'));
			element.dispatchEvent(new Event('ended'));
			expect(currentState).toBe(BACKEND_STATE.PAUSED);

			element.dispatchEvent(new Event('error'));
			expect(currentState).toBe(BACKEND_STATE.ERROR);
		});

		it('detachDomBridges() removes every listener and clears the handler list', () => {
			const received: string[] = [];
			backend.on('loadstart', () => received.push('loadstart'));

			backend.publicDetachDomBridges();
			expect(backend.domHandlerCount()).toBe(0);

			element.dispatchEvent(new Event('loadstart'));
			element.dispatchEvent(new Event('play'));

			expect(received).toEqual([]);
			expect(currentState).toBe(BACKEND_STATE.IDLE);
		});
	});
});
