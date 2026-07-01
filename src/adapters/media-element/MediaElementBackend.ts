// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BackendId, DomBridgeHandler, HlsHandle } from './helpers';

import { perceptualGain } from '../../core/volume-curve';
import { EventEmitter } from '../event-bus/default';
import {
	attachDomBridgesTo,
	captureStreamFromElement,
	getMediaKeysFromElement,
	getSinkIdFromElement,
	setMediaKeysOnElement,
	setSinkIdOnElement,
} from './helpers';

/**
 * Minimum event map the base class needs in order to bridge DOM events.
 *
 * Does not carry an index signature so closed per-library `BackendEventPayload`
 * types satisfy this constraint without needing `[key: string]: unknown`.
 */
export interface MinimalBackendEventPayload {
	loadstart: unknown;
	loadedmetadata: unknown;
	canplay: unknown;
	play: unknown;
	playing: unknown;
	pause: unknown;
	ended: unknown;
	timeupdate: unknown;
	waiting: unknown;
	stalled: unknown;
	ratechange: unknown;
	encrypted: unknown;
	error: unknown;
}

/** Loader state literals — mirrors the per-package `BackendLoaderState` types. */
export type BaseLoaderState = 'running' | 'paused';

/** Provider function shape stored on every backend for auth-header resolution. */
export type AuthHeaderProvider = () =>
  string | undefined | Promise<string | undefined>;

/**
 * Abstract substrate for every `HTMLMediaElement`-backed backend.
 *
 * Owns the concerns that are word-for-word identical across
 * `Html5VideoBackend`, `AudioElementBackend`, and `WebAudioBackend`:
 *
 *   - Auth-header provider field + setter (C08)
 *   - `play` / `pause` / `stop` element forwarding (C24–C25)
 *   - `currentTime` / `duration` / `bufferedRanges` / `seekable` /
 *     `playbackRate` getters/setters (C18–C21)
 *   - `volume` base write path via `perceptualGain` (C22)
 *   - `mute` / `unmute` base element action (C23)
 *   - `domHandlers` field + `attachDomBridges` / `detachDomBridges` helpers (C11)
 *   - `hlsInstance` field + `pauseLoader` / `resumeLoader` / `loaderState` (C31)
 *   - `disposed` guard (C32)
 *   - `captureStream`, `setSinkId`, `getSinkId`, `mediaKeys`,
 *     `setMediaKeys`, `mediaElement` — delegates to core helpers (C26–C29)
 *
 * The base does NOT implement `IVideoBackend` or `IAudioBackend` — it is a
 * substrate, not a public contract. Per-library backends implement their own
 * interface; the base provides the shared implementation layer under it.
 *
 * Subclass responsibilities:
 *   - Call `super(element, ownsElement, backendId)`.
 *   - Wire DOM events via `this.attachDomBridges(onStateChange, getState)` or
 *     a custom wiring that populates `this.domHandlers` for teardown.
 *   - Override `play()` when extra work precedes element play (e.g.
 *     `WebAudioBackend` resumes its `AudioContext` first).
 *   - Override `volume()` setter when additional tracking is needed (e.g.
 *     `AudioElementBackend` tracks `prevVolume`; `WebAudioBackend` uses a
 *     `GainNode` ramp when the graph is live).
 *   - Override `mute()` when state beyond `element.muted` must be saved.
 *   - Implement all interface-required methods not provided here (`load`,
 *     `unload`, `dispose`, `state`, `buffered`, `outputProtectionState`,
 *     and the audio/video domain-specific surface).
 */
export abstract class MediaElementBackend<
	TEl extends HTMLMediaElement,
	TPayload extends MinimalBackendEventPayload,
> extends EventEmitter<TPayload> {
	protected readonly backendId: BackendId;
	protected element: TEl;
	protected ownsElement: boolean;

	protected domHandlers: DomBridgeHandler[] = [];
	protected hlsInstance: HlsHandle | undefined;
	protected loaderRunning: BaseLoaderState = 'running';
	protected disposed: boolean = false;

	protected _authHeaderProvider: AuthHeaderProvider | undefined;

	constructor(element: TEl, ownsElement: boolean, backendId: BackendId) {
		super();
		this.element = element;
		this.ownsElement = ownsElement;
		this.backendId = backendId;
	}

	// ── Auth ──────────────────────────────────────────────────────────────────

	/**
	 * Wire the provider whose return value goes into the `Authorization`
	 * header of every hls.js manifest/segment request. Called by the player
	 * at backend init from the `auth` config.
	 */
	setAuthHeaderProvider(provider: AuthHeaderProvider): void {
		this._authHeaderProvider = provider;
	}

	// ── DOM-bridge helpers ────────────────────────────────────────────────────

	/**
	 * Attach the standard set of DOM → backend event bridges onto
	 * `this.element`. Populates `this.domHandlers` for clean removal on
	 * dispose/element-swap.
	 *
	 * Subclasses that need additional events beyond the standard 13 (e.g.
	 * `resize`, `emptied`, custom error-code mapping) call this first, then
	 * push their extra `DomBridgeHandler` entries onto `this.domHandlers`.
	 *
	 * @param onStateChange - Called whenever the bridge maps a DOM event to a
	 *   backend state transition. Subclass writes the value to its own
	 *   `currentState` field.
	 * @param getState - Returns the subclass's current backend state. Used by
	 *   the pause handler to guard against resetting an already-idle or error
	 *   state.
	 */
	protected attachDomBridges(
		onStateChange: (state: string) => void,
		getState: () => string,
	): void {
		this.domHandlers = attachDomBridgesTo(
			this.element,
			(event: string, data: unknown) =>
				this.emit(event as keyof TPayload, data as TPayload[keyof TPayload]),
			onStateChange,
			getState,
		);
	}

	/**
	 * Remove all tracked DOM listeners from `el` and clear `this.domHandlers`.
	 * Pass a different element when the backend is swapping its primary element
	 * (crossfade promotion) — the listeners were attached to the OLD element.
	 */
	protected detachDomBridges(el: HTMLMediaElement = this.element): void {
		for (const { event, handler } of this.domHandlers) {
			el.removeEventListener(event, handler);
		}
		this.domHandlers = [];
	}

	// ── Transport ─────────────────────────────────────────────────────────────

	/**
	 * Call `element.play()` and normalise the return to `Promise<void>`.
	 *
	 * Older browsers return `undefined` from `play()` rather than a `Promise`;
	 * the guard makes callers safe to `await` regardless of engine vintage.
	 *
	 * `WebAudioBackend` overrides this to resume its `AudioContext` before
	 * forwarding to the element — the context resume MUST precede the element
	 * call to satisfy browser autoplay policy.
	 */
	play(): Promise<void> {
		const result = this.element.play();
		return result instanceof Promise ? result : Promise.resolve();
	}

	pause(): void {
		this.element.pause();
	}

	stop(): void {
		this.element.pause();
		try {
			this.element.currentTime = 0;
		}
		catch {
			/* element not ready — best effort */
		}
	}

	// ── Time / position ───────────────────────────────────────────────────────

	currentTime(): number;
	currentTime(t: number): void;
	currentTime(t?: number): number | void {
		if (t === undefined) {
			return this.element.currentTime;
		}
		try {
			this.element.currentTime = t;
		}
		catch {
			/* element not seekable yet — best effort */
		}
	}

	duration(): number {
		const d = this.element.duration;
		return Number.isFinite(d) ? d : 0;
	}

	bufferedRanges(): TimeRanges {
		return this.element.buffered;
	}

	seekable(): TimeRanges {
		return this.element.seekable;
	}

	playbackRate(): number;
	playbackRate(rate: number): void;
	playbackRate(rate?: number): number | void {
		if (rate === undefined) {
			return this.element.playbackRate;
		}
		this.element.playbackRate = rate;
	}

	// ── Volume ────────────────────────────────────────────────────────────────

	/**
	 * Get the current element volume (perceptual-gain curved amplitude, not
	 * the 0..1 slider position). The player mixin owns the slider position in
	 * `_internalVolume`.
	 *
	 * Setter clamps to [0, 1], applies `perceptualGain`, and writes to
	 * `element.volume`. Subclasses that need additional tracking (e.g.
	 * `prevVolume` bookkeeping for crossfade restore, or GainNode ramping)
	 * override the setter arm.
	 */
	volume(): number;
	volume(value: number): void;
	volume(value?: number): number | void {
		if (value === undefined) {
			return this.element.volume;
		}
		const clamped = Math.max(0, Math.min(1, value));
		this.element.volume = perceptualGain(clamped);
	}

	/**
	 * Mute element output. Subclasses that need to save `prevVolume` before
	 * muting (audio backends, for crossfade / restore) override this.
	 */
	mute(): void {
		this.element.muted = true;
	}

	unmute(): void {
		this.element.muted = false;
	}

	// ── Loader backpressure ───────────────────────────────────────────────────

	/**
	 * Pause the HLS fetch pipeline. No-op when no HLS instance is active
	 * (native HLS / progressive MP4 have no public throttle hook). State is
	 * always updated for symmetry with `loaderState()`.
	 */
	pauseLoader(): void {
		this.hlsInstance?.stopLoad();
		this.loaderRunning = 'paused';
	}

	resumeLoader(): void {
		this.hlsInstance?.startLoad();
		this.loaderRunning = 'running';
	}

	loaderState(): BaseLoaderState {
		return this.loaderRunning;
	}

	// ── Capability delegates ──────────────────────────────────────────────────

	captureStream(): MediaStream {
		return captureStreamFromElement(this.element, this.backendId);
	}

	async setSinkId(deviceId: string): Promise<void> {
		await setSinkIdOnElement(this.element, deviceId, this.backendId);
	}

	getSinkId(): string {
		return getSinkIdFromElement(this.element);
	}

	mediaKeys(): MediaKeys | undefined {
		return getMediaKeysFromElement(this.element);
	}

	async setMediaKeys(keys: MediaKeys): Promise<void> {
		await setMediaKeysOnElement(this.element, keys, this.backendId);
	}

	mediaElement(): TEl {
		return this.element;
	}
}
