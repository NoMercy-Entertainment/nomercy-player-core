import type { ICueParser } from '../adapters/cue-parser/ICueParser';
import type { AddClasses, CreateElement } from '../adapters/element-factory';
import type {
	ActionOptions,
	AuthConfig,
	BaseEventMap,
	Chapter,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	IPlayer,
	IUrlResolver,
	PlayerExperimental,
	PlayerPhase,
	PluginCtorWithId,
	ResolvedUrl,
	Translations,
	UrlCategory,
	UrlResolverContext,
} from '../types';
import { EventEmitter } from '../adapters/event-bus/default';
import { buildResolvedUrl } from '../core/resolved-url';
import {
	AudioTrackState,
	BufferState,
	NetworkState,
	QualityState,
	VisibilityState,
} from '../types';

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
	private _imageBasePath: string | undefined;
	private _audioContext: AudioContext | undefined;
	private _language: string = 'en';
	private _translations: Translations = { en: {} };
	private _registeredParsers: ICueParser[] = [];
	private _overrides = new Map<string, { fn: (...args: any[]) => any; by: string }>();

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

	imageBasePath(): string | undefined;
	imageBasePath(path: string): void;
	imageBasePath(path?: string): string | undefined | void {
		if (path === undefined)
			return this._imageBasePath;
		this._imageBasePath = path;
	}

	async resolveUrl(url: string, category?: UrlCategory): Promise<ResolvedUrl> {
		const resolvedCategory = category ?? 'media';
		const isArtworkCategory = resolvedCategory === 'poster' || resolvedCategory === 'cast';

		const defaultResolve = async (raw: string): Promise<ResolvedUrl> => {
			if (isArtworkCategory && this._imageBasePath) {
				const isAbsolute = /^[a-z][a-z\d+\-.]*:/iu.test(raw);
				if (!isAbsolute)
					return buildResolvedUrl(raw, this._imageBasePath + raw);
			}
			return buildResolvedUrl(raw, raw, this._baseUrl);
		};

		const resolver = this._urlResolver;
		if (!resolver)
			return defaultResolve(url);

		const ctxBaseUrl = (isArtworkCategory && this._imageBasePath) ? this._imageBasePath : this._baseUrl;
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
			return Object.freeze({ ...this._authConfig }) as Readonly<AuthConfig>;
		}
		this._authConfig = {
			...(this._authConfig ?? {}),
			...configOrPartial,
		};
	}

	private _currentSubtitleIdx: number | null = null;
	private _currentAudioTrackIdx: number | null = null;
	private _currentQualityIdx: number | 'auto' = 'auto';

	currentSubtitle(): CurrentSubtitleSelection | null;
	currentSubtitle(idx: number | null): void;
	currentSubtitle(idx?: number | null): CurrentSubtitleSelection | null | void {
		if (idx === undefined)
			return null;
		this._currentSubtitleIdx = idx;
	}

	currentAudioTrack(): CurrentAudioTrackSelection | null;
	currentAudioTrack(idx: number): void;
	currentAudioTrack(idx?: number): CurrentAudioTrackSelection | null | void {
		if (idx === undefined)
			return null;
		this._currentAudioTrackIdx = idx;
	}

	currentQuality(): CurrentQualitySelection | 'auto';
	currentQuality(idx: number | 'auto'): void;
	currentQuality(idx?: number | 'auto'): CurrentQualitySelection | 'auto' | void {
		if (idx === undefined)
			return 'auto';
		this._currentQualityIdx = idx;
	}

	chapters(): ReadonlyArray<Chapter> {
		return [];
	}

	currentChapter(): Chapter | null;
	currentChapter(idx: number): void;
	currentChapter(_idx?: number): Chapter | null | void {
		if (_idx === undefined)
			return null;
	}

	async currentAudioOutput(): Promise<string | null>;
	async currentAudioOutput(deviceId: string): Promise<void>;
	async currentAudioOutput(_deviceId?: string): Promise<string | null | void> {
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
	qualityState(): QualityState;
	qualityState(target: number | 'auto'): void;
	qualityState(target?: number | 'auto'): QualityState | void {
		if (target === undefined)
			return this._qualityState;
		this._qualityState = target === 'auto' ? QualityState.AUTO : QualityState.MANUAL;
	}

	private _audioTrackState: AudioTrackState = AudioTrackState.DEFAULT;
	audioTrackState(): AudioTrackState;
	audioTrackState(idx: number): void;
	audioTrackState(idx?: number): AudioTrackState | void {
		if (idx === undefined)
			return this._audioTrackState;
		this._audioTrackState = AudioTrackState.MANUAL;
	}

	/**
	 * No-op in the stub — duration is always 0, so the real impl exits early
	 * anyway. Tests that need a real seek should use `currentTime()` directly.
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
			override: <K extends string>(method: K, fn: (...args: any[]) => any): (() => void) => {
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

	/** Pass-through — returns the element unchanged with the fluent type. */
	addClasses<T extends Element>(el: T, _names: string[]): AddClasses<T> {
		return el as unknown as AddClasses<T>;
	}

	/** Pass-through — returns the element unchanged. */
	removeClasses<T extends Element>(el: T, _names: string[]): T {
		return el;
	}

	/**
	 * Reset the stub to a known starting state. Call in `beforeEach` when
	 * reusing the same instance across tests to avoid cross-test pollution.
	 */
	reset(): void {
		this.off('all');
		this._phase = 'idle';
		this._dispatchStack.length = 0;
		this._baseUrl = undefined;
		this._imageBasePath = undefined;
		this._audioContext = undefined;
		this._language = 'en';
		this._translations = { en: {} };
		this._registeredParsers.length = 0;
		this._overrides.clear();
		this._qualityState = QualityState.AUTO;
		this._audioTrackState = AudioTrackState.DEFAULT;
	}
}
