import type { CueParser } from '../cues/parser-registry';
import type {
	BaseEventMap,
	IPlayer,
	PlayerExperimental,
	PlayerPhase,
	ResolvedUrl,
	Translations,
	UrlCategory,
	UrlResolver,
	UrlResolverContext,
} from '../types';
import { EventEmitter } from '../events';
import { buildResolvedUrl } from '../resolved-url';

/**
 * Minimal `IPlayer` impl for plugin tests. Real enough to drive plugin
 * lifecycles + event subscriptions; not real enough to play media.
 *
 * What it provides:
 *  - `EventEmitter` spine (so `on / off / once / hasListeners / emit` work)
 *  - `phase()` state machine — tests drive transitions via `setPhase()`
 *  - `dispatching()` stack — tests push/pop via `pushDispatch()` / `popDispatch()`
 *  - Translation surface that mutates an in-memory bundle table
 *  - Cue parser registry that records registrations
 *  - Stubbed `audioContext()` / `baseUrl()` accessors
 *  - `experimental.override` no-op surface
 *
 * What it does NOT provide (and tests should not rely on):
 *  - Plugin registration — `addPlugin` is wired by `describePlugin` directly
 *    so the stub doesn't have to track plugin state. Tests calling
 *    `player.addPlugin` from inside a plugin's `use()` should mock that
 *    individually if needed.
 *  - Stream resolution
 *  - Backend lifecycle
 *  - Auth fetch (use `Plugin.fetch` overrides in tests instead)
 *
 * Use this for **plugin** tests. For player-class tests, instantiate the
 * actual `NMMusicPlayer` / `NMVideoPlayer` and let `describePlayer` drive it.
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
	private _audioContext: AudioContext | undefined;
	private _language: string = 'en';
	private _translations: Translations = { en: {} };
	private _registeredParsers: CueParser[] = [];
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

	// ── Phase machine ──

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

	dispatching(): ReadonlyArray<string> {
		// Return a snapshot so callers that hold the reference don't observe
		// the stack mutate after the current dispatch completes.
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

	// ── Base URL ──

	baseUrl(): string | undefined;
	baseUrl(url: string): void;
	baseUrl(url?: string): string | undefined | void {
		if (url === undefined)
			return this._baseUrl;
		this._baseUrl = url;
	}

	// ── AudioContext ──

	audioContext(): AudioContext | undefined {
		return this._audioContext;
	}

	/** Test-only: inject a (mock) AudioContext for plugins that need one. */
	setAudioContext(ctx: AudioContext | undefined): void {
		this._audioContext = ctx;
	}

	// ── URL resolution ──

	private _urlResolver: UrlResolver | undefined;

	async resolveUrl(url: string, category?: UrlCategory): Promise<ResolvedUrl> {
		const defaultResolve = async (raw: string) => buildResolvedUrl(raw, raw, this._baseUrl);
		const resolver = this._urlResolver;
		if (!resolver)
			return defaultResolve(url);
		const ctx: UrlResolverContext = {
			auth: undefined,
			baseUrl: this._baseUrl,
			category: category ?? 'media',
			defaultResolve,
		};
		const out = await resolver(url, ctx);
		if (!out || typeof (out as { href?: string }).href !== 'string')
			return defaultResolve(url);
		return out;
	}

	urlResolver(): UrlResolver | undefined;
	urlResolver(resolver: UrlResolver | undefined): void;
	urlResolver(resolver?: UrlResolver | undefined): UrlResolver | undefined | void {
		if (arguments.length === 0)
			return this._urlResolver;
		this._urlResolver = resolver;
	}

	// ── i18n ──

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

	// ── Auth ──

	private _authConfig: import('../types').AuthConfig | undefined;

	auth(): Readonly<import('../types').AuthConfig> | undefined;
	auth(config: import('../types').AuthConfig): void;
	auth(partial: Partial<import('../types').AuthConfig>): void;
	auth(configOrPartial?: import('../types').AuthConfig | Partial<import('../types').AuthConfig>): Readonly<import('../types').AuthConfig> | undefined | void {
		if (configOrPartial === undefined) {
			if (!this._authConfig) return undefined;
			return Object.freeze({ ...this._authConfig }) as Readonly<import('../types').AuthConfig>;
		}
		this._authConfig = { ...(this._authConfig ?? {}), ...configOrPartial };
	}

	// ── Track / quality selections ──

	private _currentSubtitleIdx: number | null = null;
	private _currentAudioTrackIdx: number | null = null;
	private _currentQualityIdx: number | 'auto' = 'auto';

	currentSubtitle(): number | null;
	currentSubtitle(idx: number | null): void;
	currentSubtitle(idx?: number | null): number | null | void {
		if (idx === undefined) return this._currentSubtitleIdx;
		this._currentSubtitleIdx = idx;
	}

	currentAudioTrack(): number | null;
	currentAudioTrack(idx: number): void;
	currentAudioTrack(idx?: number): number | null | void {
		if (idx === undefined) return this._currentAudioTrackIdx;
		this._currentAudioTrackIdx = idx;
	}

	currentQuality(): number | 'auto';
	currentQuality(idx: number | 'auto'): void;
	currentQuality(idx?: number | 'auto'): number | 'auto' | void {
		if (idx === undefined) return this._currentQualityIdx;
		this._currentQualityIdx = idx;
	}

	currentChapter(): import('../types').Chapter | null;
	currentChapter(idx: number): void;
	currentChapter(_idx?: number): import('../types').Chapter | null | void {
		if (_idx === undefined) return null;
	}

	async currentAudioOutput(): Promise<string | null>;
	async currentAudioOutput(deviceId: string): Promise<void>;
	async currentAudioOutput(_deviceId?: string): Promise<string | null | void> {
		if (_deviceId === undefined) return null;
	}

	// ── Cue parsers ──

	registerCueParser(parser: CueParser, prepend?: boolean): void {
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

	/** Test-only: introspect registered parsers without going through `resolve()`. */
	cueParsers(): ReadonlyArray<CueParser> {
		return this._registeredParsers;
	}

	// ── Experimental override surface ──

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

	// ── DOM construction helpers (no-op stubs — tests don't need real DOM builders) ──

	createElement<K extends keyof HTMLElementTagNameMap>(
		type: K,
		_id: string,
		_unique?: boolean,
	): import('../dom').CreateElement<HTMLElementTagNameMap[K]> {
		return { el: document.createElement(type) } as unknown as import('../dom').CreateElement<HTMLElementTagNameMap[K]>;
	}

	createButton(_id: string, _label: string, _onClick: (e: Event) => void): HTMLButtonElement {
		return document.createElement('button');
	}

	createSVG(_id: string, _viewBox: string): SVGSVGElement {
		return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	}

	addClasses<T extends Element>(el: T, _names: string[]): import('../dom').AddClasses<T> {
		return el as unknown as import('../dom').AddClasses<T>;
	}

	removeClasses<T extends Element>(el: T, _names: string[]): T {
		return el;
	}

	// ── Test-only helpers ──

	/**
	 * Reset the stub to a known starting state. Useful in `beforeEach`
	 * blocks where the same player instance is reused across tests.
	 */
	reset(): void {
		this.off('all');
		this._phase = 'idle';
		this._dispatchStack.length = 0;
		this._baseUrl = undefined;
		this._audioContext = undefined;
		this._language = 'en';
		this._translations = { en: {} };
		this._registeredParsers.length = 0;
		this._overrides.clear();
	}
}
