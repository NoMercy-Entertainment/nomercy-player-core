// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ICueParser } from '../adapters/cue-parser/ICueParser';
import type { AddClasses, CreateElement } from '../adapters/element-factory';
import type { IPlatform } from '../adapters/platform/browser';
import type { IStreamFactory } from '../adapters/stream/IStreamSource';
import type { Plugin } from '../core/plugin';
import type {
	ActionOptions,
	AriaLiveLevel,
	AudioTrack,
	AuthConfig,
	BaseEventMap,
	BasePlaylistItem,
	CanPlayResult,
	CastState,
	CastTarget,
	Chapter,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	DeviceCapabilities,
	IPlayer,
	IUrlResolver,
	LoadOptions,
	PlaybackMetrics,
	PlayerExperimental,
	PlayerPhase,
	PluginCtorWithId,
	QualityLevel,
	ResolvedUrl,
	SubtitleTrack,
	TimeState,
	Translations,
	UrlCategory,
	UrlResolverContext,
} from '../types';
import { EventEmitter } from '../adapters/event-bus/default';
import { browserPlatform } from '../adapters/platform/browser';
import { RepeatState, ShuffleState } from '../core/mixins/state-mutators';
import { buildResolvedUrl } from '../core/resolved-url';
import {
	AudioTrackState,
	BufferState,
	NetworkState,
	QualityState,
	SetupState,
	VisibilityState,
} from '../types';
import { PlayState, VolumeState } from '../types/state';

/**
 * Lightweight `IPlayer` test double for plugin and unit tests. It is real
 * enough to drive plugin lifecycles and event subscriptions without needing a
 * real browser, a media element, or a network stack.
 *
 * **What it fills.** jsdom has no `<audio>` / `<video>` implementation and no
 * `MediaSource` or `AudioContext`. A real player cannot be constructed in that
 * environment. `StubPlayer` gives plugin tests a fully-typed, in-process
 * `IPlayer` surface so they can exercise `use()` / `dispose()` / event wiring
 * without touching the DOM at all.
 *
 * **Provided surface:**
 *  - `EventEmitter` spine — `on / off / once / hasListeners / emit` are real
 *  - `phase()` state machine — advance via `setPhase()` in test bodies
 *  - `dispatching()` stack — driven via `pushDispatch()` / `popDispatch()`
 *  - Full i18n surface backed by an in-memory bundle table
 *  - Cue parser registry with real register/unregister/resolve logic
 *  - Overloaded `baseUrl()` and `audioContext()` accessors
 *  - `experimental.override` surface wired to an in-memory map
 *  - `reset()` to clear all state between tests without creating a new instance
 *
 * **What it does not provide** (tests must not rely on these):
 *  - Plugin registration — `describePlugin` wires `addPlugin` itself so the
 *    stub doesn't track plugin state. Mock it per-test if a plugin's `use()`
 *    calls `player.addPlugin` internally.
 *  - Stream resolution or backend lifecycle
 *  - Auth-gated fetch (use `Plugin.fetch` overrides in tests instead)
 *
 * Use `StubPlayer` for plugin tests and kit unit tests. For player-class
 * tests, instantiate the real `NMMusicPlayer` or `NMVideoPlayer` and let
 * `runIPlayerContract` or `describePluginAgainst` drive it.
 */
export class StubPlayer extends EventEmitter<BaseEventMap> implements IPlayer<BaseEventMap> {
	readonly playerId: string;
	readonly container: HTMLElement;

	/** Reads back the id passed to the constructor. Alias for `playerId`. */
	get id(): string {
		return this.playerId;
	}

	private _phase: PlayerPhase = 'idle';
	private _dispatchStack: string[] = [];
	private _baseUrl: string | undefined;
	private _baseImageUrl: string | undefined;
	private _audioContext: AudioContext | undefined;
	private _language: string = 'en';
	private _translations: Translations = { en: {} };
	private _registeredParsers: ICueParser[] = [];
	private _overrides = new Map<string, { fn: (...args: unknown[]) => unknown; by: string }>();

	constructor(opts?: { id?: string; container?: HTMLElement; phase?: PlayerPhase; translations?: Translations }) {
		super();
		this.playerId = opts?.id ?? 'stub-player';
		this.container = opts?.container ?? (typeof document !== 'undefined' ? document.createElement('div') : ({} as HTMLElement));
		if (opts?.phase)
			this._phase = opts.phase;
		if (opts?.translations)
			this._translations = { ...opts.translations };
	}

	phase(): PlayerPhase {
		return this._phase;
	}

	/**
	 * Test-only: drive phase transitions without going through the real
	 * lifecycle. Emits `phase` event so plugins listening see the change.
	 */
	setPhase(next: PlayerPhase): void {
		const from = this._phase;
		if (from === next)
			return;
		this._phase = next;
		this.emit('phase', {
			from,
			to: next,
		});
	}

	/**
	 * Returns a snapshot of the current dispatch stack. Callers that hold the
	 * reference won't observe the stack mutate after the current dispatch ends.
	 */
	dispatching(): ReadonlyArray<string> {
		return [...this._dispatchStack];
	}

	/**
	 * Returns `browserPlatform` — the stub does not need injectable platform
	 * overrides. Tests that need custom platform behaviour should use the real
	 * `NMMusicPlayer` / `NMVideoPlayer` with `setup({ platform: ... })`.
	 */
	platform(): IPlatform {
		return browserPlatform;
	}

	/**
	 * Returns `SetupState.READY` when the phase is `'ready'` or later;
	 * `NOT_SETUP` when still `'idle'`; `SETTING_UP` when `'setup'`;
	 * `DISPOSED` when `'disposed'`.
	 */
	setupState(): SetupState {
		switch (this._phase) {
			case 'idle': return SetupState.NOT_SETUP;
			case 'setup': return SetupState.SETTING_UP;
			case 'disposed': return SetupState.DISPOSED;
			default: return SetupState.READY;
		}
	}

	/** Test-only: push a dispatching event name onto the stack. */
	pushDispatch(name: string): void {
		this._dispatchStack.push(name);
	}

	/** Test-only: pop the innermost dispatching event name. */
	popDispatch(): string | undefined {
		return this._dispatchStack.pop();
	}

	baseUrl(): string | undefined;
	baseUrl(url: string): void;
	baseUrl(url?: string): string | undefined | void {
		if (url === undefined)
			return this._baseUrl;
		this._baseUrl = url;
	}

	audioContext(): AudioContext | undefined {
		return this._audioContext;
	}

	/** Test-only: inject a (mock) AudioContext for plugins that need one. */
	setAudioContext(ctx: AudioContext | undefined): void {
		this._audioContext = ctx;
	}

	private _urlResolver: IUrlResolver | undefined;

	baseImageUrl(): string | undefined;
	baseImageUrl(path: string): void;
	baseImageUrl(path?: string): string | undefined | void {
		if (path === undefined)
			return this._baseImageUrl;
		this._baseImageUrl = path;
	}

	async resolveUrl(url: string, category?: UrlCategory): Promise<ResolvedUrl> {
		const resolvedCategory = category ?? 'media';
		const isArtworkCategory = resolvedCategory === 'poster' || resolvedCategory === 'cast';

		const defaultResolve = async (raw: string): Promise<ResolvedUrl> => {
			if (isArtworkCategory && this._baseImageUrl) {
				const isAbsolute = /^[a-z][a-z\d+\-.]*:/iu.test(raw);
				if (!isAbsolute)
					return buildResolvedUrl(raw, this._baseImageUrl + raw);
			}
			return buildResolvedUrl(raw, raw, this._baseUrl);
		};

		const resolver = this._urlResolver;
		if (!resolver)
			return defaultResolve(url);

		const ctxBaseUrl = (isArtworkCategory && this._baseImageUrl) ? this._baseImageUrl : this._baseUrl;
		const ctx: UrlResolverContext = {
			auth: undefined,
			baseUrl: ctxBaseUrl,
			category: resolvedCategory,
			defaultResolve,
		};
		const out = await resolver(url, ctx);
		if (!out || typeof (out as { href?: string }).href !== 'string')
			return defaultResolve(url);
		return out;
	}

	urlResolver(): IUrlResolver | undefined;
	urlResolver(resolver: IUrlResolver | undefined): void;
	urlResolver(resolver?: IUrlResolver | undefined): IUrlResolver | undefined | void {
		if (arguments.length === 0)
			return this._urlResolver;
		this._urlResolver = resolver;
	}

	t(key: string, vars?: Record<string, string>): string {
		const bundle = this._translations[this._language];
		const raw = bundle?.[key] ?? key;
		if (!vars)
			return raw;
		return raw.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? `{${name}}`);
	}

	language(): string;
	language(lang: string): Promise<void>;
	language(lang?: string): string | Promise<void> {
		if (lang === undefined)
			return this._language;
		return (async () => {
			this._language = lang;
			if (!this._translations[lang])
				this._translations[lang] = {};
		})();
	}

	addTranslations(bundle: Translations): void {
		for (const [lang, keys] of Object.entries(bundle)) {
			this._translations[lang] = {
				...(this._translations[lang] ?? {}),
				...keys,
			};
		}
	}

	translation(lang: string, key: string): string | undefined;
	translation(lang: string, key: string, value: string): void;
	translation(lang: string, key: string, value?: string): string | undefined | void {
		if (value === undefined)
			return this._translations[lang]?.[key];
		if (!this._translations[lang])
			this._translations[lang] = {};
		this._translations[lang]![key] = value;
	}

	removeTranslations(prefix: string, lang?: string): void {
		const langs = lang ? [lang] : Object.keys(this._translations);
		for (const l of langs) {
			const bundle = this._translations[l];
			if (!bundle)
				continue;
			for (const k of Object.keys(bundle)) {
				if (k.startsWith(prefix))
					delete bundle[k];
			}
		}
	}

	private _authConfig: AuthConfig | undefined;

	auth(): Readonly<AuthConfig> | undefined;
	auth(config: AuthConfig): void;
	auth(partial: Partial<AuthConfig>): void;
	auth(configOrPartial?: AuthConfig | Partial<AuthConfig>): Readonly<AuthConfig> | undefined | void {
		if (configOrPartial === undefined) {
			if (!this._authConfig)
				return undefined;
			const { bearerToken: _b, ...safe } = this._authConfig;
			return Object.freeze(safe) as Readonly<AuthConfig>;
		}
		this._authConfig = {
			...(this._authConfig ?? {}),
			...configOrPartial,
		};
	}

	_rawAuth(): AuthConfig | undefined {
		return this._authConfig;
	}

	private _currentSubtitleIdx: number | null = null;
	private _currentAudioTrackIdx: number | null = null;
	private _currentQualityIdx: number | 'auto' = 'auto';

	subtitle(): CurrentSubtitleSelection | null;
	subtitle(idx: number | null): void;
	subtitle(idx?: number | null): CurrentSubtitleSelection | null | void {
		if (idx === undefined)
			return null;
		this._currentSubtitleIdx = idx;
	}

	audioTrack(): CurrentAudioTrackSelection | null;
	audioTrack(idx: number): void;
	audioTrack(idx?: number): CurrentAudioTrackSelection | null | void {
		if (idx === undefined)
			return null;
		this._currentAudioTrackIdx = idx;
	}

	quality(): CurrentQualitySelection | 'auto';
	quality(idx: number | 'auto'): void;
	quality(idx?: number | 'auto'): CurrentQualitySelection | 'auto' | void {
		if (idx === undefined)
			return 'auto';
		this._currentQualityIdx = idx;
	}

	chapters(): ReadonlyArray<Chapter> {
		return [];
	}

	chapter(): Chapter | null;
	chapter(idx: number): void;
	chapter(_idx?: number): Chapter | null | void {
		if (_idx === undefined)
			return null;
	}

	async audioOutput(): Promise<string | null>;
	async audioOutput(deviceId: string): Promise<void>;
	async audioOutput(_deviceId?: string): Promise<string | null | void> {
		if (_deviceId === undefined)
			return null;
	}

	bufferState(): BufferState {
		return BufferState.IDLE;
	}

	networkState(): NetworkState {
		return NetworkState.ONLINE;
	}

	streamState(): string {
		return 'idle';
	}

	visibilityState(): VisibilityState {
		return VisibilityState.VISIBLE;
	}

	private _qualityState: QualityState = QualityState.AUTO;
	qualityMode(): QualityState;
	qualityMode(target: number | 'auto'): void;
	qualityMode(target?: number | 'auto'): QualityState | void {
		if (target === undefined)
			return this._qualityState;
		this._qualityState = target === 'auto' ? QualityState.AUTO : QualityState.MANUAL;
	}

	private _audioTrackState: AudioTrackState = AudioTrackState.DEFAULT;
	audioTrackMode(): AudioTrackState;
	audioTrackMode(idx: number): void;
	audioTrackMode(idx?: number): AudioTrackState | void {
		if (idx === undefined)
			return this._audioTrackState;
		this._audioTrackState = AudioTrackState.MANUAL;
	}

	/**
	 * No-op in the stub — duration is always 0, so the real impl exits early
	 * anyway. Tests that need a real seek should use `time()` directly.
	 */
	seekByPercentage(_pct: number, _opts?: ActionOptions): void {}

	registerCueParser(parser: ICueParser, prepend?: boolean): void {
		const existing = this._registeredParsers.findIndex(p => p.id === parser.id);
		if (existing >= 0)
			this._registeredParsers.splice(existing, 1);
		if (prepend)
			this._registeredParsers.unshift(parser);
		else this._registeredParsers.push(parser);
	}

	unregisterCueParser(id: string): void {
		const idx = this._registeredParsers.findIndex(p => p.id === id);
		if (idx >= 0)
			this._registeredParsers.splice(idx, 1);
	}

	resolveCueParser(url: string): ICueParser | undefined {
		return this._registeredParsers.find(p => p.canParse(url));
	}

	/** Test-only: introspect registered parsers without going through `resolve()`. */
	cueParsers(): ReadonlyArray<ICueParser> {
		return this._registeredParsers;
	}

	get experimental(): PlayerExperimental {
		const overrides = this._overrides;
		return {
			override: <K extends string>(method: K, fn: (...args: unknown[]) => unknown): (() => void) => {
				overrides.set(method, {
					fn,
					by: 'consumer',
				});
				return () => overrides.delete(method);
			},
			restore: (method: string): void => {
				overrides.delete(method);
			},
			overrides: (): Array<{ method: string; by: string | 'consumer' }> => {
				return Array.from(overrides.entries()).map(([method, { by }]) => ({
					method,
					by,
				}));
			},
		};
	}

	/**
	 * Returns a real jsdom element so plugins that call `createElement` during
	 * `use()` get a valid DOM node without needing a real browser environment.
	 */
	createElement<K extends keyof HTMLElementTagNameMap>(
		type: K,
		_id: string,
		_unique?: boolean,
	): CreateElement<HTMLElementTagNameMap[K]> {
		return { el: document.createElement(type) } as unknown as CreateElement<HTMLElementTagNameMap[K]>;
	}

	/** Returns a real jsdom `<button>` — same rationale as `createElement`. */
	createButton(_id: string, _label: string, _onClick: (e: Event) => void): HTMLButtonElement {
		return document.createElement('button');
	}

	/** Returns a real jsdom `<svg>` — same rationale as `createElement`. */
	createSVG(_id: string, _viewBox: string): SVGSVGElement {
		return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	}

	/**
	 * Always returns `undefined`. The stub does not track plugin registrations;
	 * `describePlugin` wires the plugin directly. Mock this per-test if a
	 * plugin's `use()` calls `player.getPlugin()` internally.
	 */
	getPlugin<P extends object>(_PluginClass: PluginCtorWithId & (new () => P)): P | undefined {
		return undefined;
	}

	/** Always returns `undefined` — see `getPlugin` for the rationale. */
	getPluginById<P extends object = object>(_id: string): P | undefined {
		return undefined;
	}

	/**
	 * Returns a zeroed-out metrics snapshot. Tests that need specific values
	 * should use `experimental.override('metrics', () => ({ ... }))`.
	 */
	metrics(): PlaybackMetrics {
		return {
			ttfb: null,
			ttff: 0,
			rebufferRatio: 0,
			avgBitrate: null,
			droppedFrames: null,
			decoderStalls: null,
			joinTime: 0,
			sessionDurationMs: 0,
		};
	}

	/** Pass-through — returns the element unchanged with the fluent type. */
	addClasses<T extends Element>(el: T, _names: string[]): AddClasses<T> {
		return el as unknown as AddClasses<T>;
	}

	/** Pass-through — returns the element unchanged. */
	removeClasses<T extends Element>(el: T, _names: string[]): T {
		return el;
	}

	// ── Lifecycle ──

	setup(_config: Record<string, unknown>): this {
		return this;
	}

	ready(): Promise<void> {
		return Promise.resolve();
	}

	dispose(): void {}

	// ── Transport ──

	play(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	pause(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	stop(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	togglePlayback(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	rewind(_seconds?: number, _opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	forward(_seconds?: number, _opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	restart(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	next(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	previous(_opts?: ActionOptions): Promise<void> {
		return Promise.resolve();
	}

	// ── Volume ──

	private _volume: number = 100;
	private _muted: boolean = false;

	volume(): number;
	volume(level: number): void;
	volume(level?: number): number | void {
		if (level === undefined)
			return this._muted ? 0 : this._volume;
		this._volume = Math.max(0, Math.min(100, level));
		this._muted = false;
	}

	volumeUp(_step?: number): void {}

	volumeDown(_step?: number): void {}

	mute(): void {
		this._muted = true;
	}

	unmute(): void {
		this._muted = false;
	}

	toggleMute(): void {
		this._muted = !this._muted;
	}

	// ── Time ──

	private _time: number = 0;
	private _duration: number = 0;
	private _playbackRate: number = 1;

	time(): number;
	time(seconds: number, opts?: ActionOptions): Promise<void>;
	time(seconds?: number, _opts?: ActionOptions): number | Promise<void> {
		if (seconds === undefined)
			return this._time;
		this._time = seconds;
		return Promise.resolve();
	}

	duration(): number {
		return this._duration;
	}

	timeData(): TimeState {
		return {
			position: this._time,
			duration: this._duration,
			buffered: 0,
			remaining: Math.max(0, this._duration - this._time),
			percentage: this._duration > 0 ? (this._time / this._duration) * 100 : 0,
		};
	}

	playbackRates(): number[] {
		return [0.5, 0.75, 1, 1.25, 1.5, 2];
	}

	playbackRate(): number;
	playbackRate(rate: number): void;
	playbackRate(rate?: number): number | void {
		if (rate === undefined)
			return this._playbackRate;
		this._playbackRate = rate;
	}

	// ── Queue ──

	private _queue: ReadonlyArray<BasePlaylistItem> = [];
	private _backlog: ReadonlyArray<BasePlaylistItem> = [];
	private _repeatState: RepeatState = RepeatState.OFF;
	private _shuffleState: ShuffleState = ShuffleState.OFF;

	queue(): ReadonlyArray<BasePlaylistItem>;
	queue(items: BasePlaylistItem[], opts?: ActionOptions): void;
	queue(items?: BasePlaylistItem[], _opts?: ActionOptions): ReadonlyArray<BasePlaylistItem> | void {
		if (items === undefined)
			return this._queue;
		this._queue = items;
	}

	queueAppend(_item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {}

	queueSort(_compare: (a: BasePlaylistItem, b: BasePlaylistItem) => number, _opts?: ActionOptions): void {}

	backlog(): ReadonlyArray<BasePlaylistItem>;
	backlog(items: BasePlaylistItem[]): void;
	backlog(items?: BasePlaylistItem[]): ReadonlyArray<BasePlaylistItem> | void {
		if (items === undefined)
			return this._backlog;
		this._backlog = items;
	}

	backlogAppend(_item: BasePlaylistItem | BasePlaylistItem[]): void {}

	loadQueue(_url: string, _parser?: (raw: string) => BasePlaylistItem[]): Promise<void> {
		return Promise.resolve();
	}

	seekToIndex(_position: number, _opts?: ActionOptions): void {}

	playItem(
		_target: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		_opts?: LoadOptions,
	): void {}

	playNow(
		_items: BasePlaylistItem[],
		_start?: BasePlaylistItem | string | number | ((item: BasePlaylistItem) => boolean),
		_opts?: LoadOptions,
	): void {}

	repeatState(): RepeatState;
	repeatState(state: RepeatState): void;
	repeatState(state?: RepeatState): RepeatState | void {
		if (state === undefined)
			return this._repeatState;
		this._repeatState = state;
	}

	shuffleState(): ShuffleState;
	shuffleState(state: ShuffleState | boolean): void;
	shuffleState(state?: ShuffleState | boolean): ShuffleState | void {
		if (state === undefined)
			return this._shuffleState;
		if (typeof state === 'boolean') {
			this._shuffleState = state ? ShuffleState.ON : ShuffleState.OFF;
			return;
		}
		this._shuffleState = state;
	}

	// ── Load ──

	load(_item: BasePlaylistItem, _opts?: LoadOptions): Promise<void> {
		return Promise.resolve();
	}

	// ── Media tracks ──

	subtitles(): ReadonlyArray<SubtitleTrack> {
		return [];
	}

	qualityLevels(): ReadonlyArray<QualityLevel>;
	qualityLevels(opts: { includeUnsupported: true }): ReadonlyArray<QualityLevel>;
	qualityLevels(_opts?: { includeUnsupported: true }): ReadonlyArray<QualityLevel> {
		return [];
	}

	audioTracks(): ReadonlyArray<AudioTrack> {
		return [];
	}

	// ── Audio output ──

	audioOutputs(): Promise<MediaDeviceInfo[]> {
		return Promise.resolve([]);
	}

	selectAudioOutput(): Promise<MediaDeviceInfo | null> {
		return Promise.resolve(null);
	}

	// ── Cast / handoff ──

	castState(): CastState {
		return 'unavailable' as CastState;
	}

	transferTo(_target: CastTarget): Promise<void> {
		return Promise.resolve();
	}

	// ── Plugins ──

	addPlugin<P extends Plugin<any, any, any>>(
		_PluginClass: PluginCtorWithId & (new () => P),
		_opts?: P['opts'],
	): this {
		return this;
	}

	// ── Stream registration ──

	registerStream(_factory: IStreamFactory, _prepend?: boolean): this {
		return this;
	}

	// ── Device / ABR ──

	device(): DeviceCapabilities {
		return {} as DeviceCapabilities;
	}

	bandwidth(): number {
		return 0;
	}

	bandwidthEstimator(): (() => number) | undefined;
	bandwidthEstimator(fn: () => number): void;
	bandwidthEstimator(_fn?: () => number): ((() => number) | undefined) | void {
		if (_fn === undefined)
			return undefined;
	}

	canPlay(_profile: { contentType: string; width?: number; height?: number; bitrate?: number; framerate?: number }): Promise<CanPlayResult> {
		return Promise.resolve({
			supported: true,
			smooth: true,
			powerEfficient: true,
		});
	}

	// ── Accessibility ──

	announce(_text: string, _level?: AriaLiveLevel): void {}

	// ── Metrics / clock ──

	recordMetric(_name: string, _value: number): void {}

	now(): number {
		return Date.now();
	}

	// ── Buffered / seekable ranges ──

	buffered(): number {
		return 0;
	}

	bufferedRanges(): TimeRanges {
		return {
			length: 0,
			start: (_index: number) => 0,
			end: (_index: number) => 0,
		} as unknown as TimeRanges;
	}

	seekable(): TimeRanges {
		return {
			length: 0,
			start: (_index: number) => 0,
			end: (_index: number) => 0,
		} as unknown as TimeRanges;
	}

	// ── Coarse state tokens ──

	playState(): PlayState {
		return PlayState.IDLE;
	}

	volumeState(): VolumeState {
		return VolumeState.UNMUTED;
	}

	// ── Chapter navigation ──

	seekToChapter(_idx: number, _opts?: ActionOptions): void {}

	nextChapter(_opts?: ActionOptions): void {}

	previousChapter(_opts?: ActionOptions): void {}

	// ── Queue mutations (additive) ──

	queuePrepend(_item: BasePlaylistItem | BasePlaylistItem[], _opts?: ActionOptions): void {}

	queueInsert(_item: BasePlaylistItem | BasePlaylistItem[], _index: number, _opts?: ActionOptions): void {}

	queueRemove(_id: string | number, _opts?: ActionOptions): void {}

	queueRemoveAt(_index: number, _opts?: ActionOptions): void {}

	queueMove(_from: number, _to: number, _opts?: ActionOptions): void {}

	queueClear(_opts?: ActionOptions): void {}

	queueShuffle(_opts?: ActionOptions): void {}

	peekNext(): BasePlaylistItem | undefined {
		return undefined;
	}

	peekPrevious(): BasePlaylistItem | undefined {
		return undefined;
	}

	queueLength(): number {
		return this._queue.length;
	}

	queueIndexOf(_id: string | number): number {
		return -1;
	}

	index(): number {
		return -1;
	}

	// ── Backlog mutations ──

	backlogRemove(_id: string | number): void {}

	backlogClear(): void {}

	/**
	 * Reset the stub to a known starting state. Call in `beforeEach` when
	 * reusing the same instance across tests to avoid cross-test pollution.
	 */
	reset(): void {
		this.off('all');
		this._phase = 'idle';
		this._dispatchStack.length = 0;
		this._baseUrl = undefined;
		this._baseImageUrl = undefined;
		this._audioContext = undefined;
		this._language = 'en';
		this._translations = { en: {} };
		this._registeredParsers.length = 0;
		this._overrides.clear();
		this._qualityState = QualityState.AUTO;
		this._audioTrackState = AudioTrackState.DEFAULT;
	}
}

/**
 * Convenience factory for `StubPlayer`. Equivalent to `new StubPlayer(opts)` but
 * reads more naturally in test setup blocks:
 *
 * ```ts
 * const player = createStubPlayer({ id: 'my-player' });
 * ```
 */
export function createStubPlayer(
	opts?: ConstructorParameters<typeof StubPlayer>[0],
): StubPlayer {
	return new StubPlayer(opts);
}
