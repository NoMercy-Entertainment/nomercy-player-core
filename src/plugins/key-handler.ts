import type { BaseEventMap, IPlayer } from '../types';
import { Plugin } from '../plugin';

/** Map of keyboard combo strings to player action callbacks. */
export type KeyBindings<P> = Record<string, (player: P) => void>;

/** Options for {@link KeyHandlerPlugin}. */
export interface KeyHandlerOptions<P> {
	/** Where to listen — defaults to `document`. */
	scope?: 'document' | 'container' | HTMLElement;
	/** Per-key handlers added at registration. Combined with default group methods. */
	bindings?: KeyBindings<P>;
	/** false → drop default bindings entirely. true → merge defaults + opts.bindings. */
	extend?: boolean;
	/** Predicate that must return true for keys to fire. */
	when?: (e: KeyboardEvent) => boolean;
	/** Cooldown between fires (ms). Default 300. */
	cooldownMs?: number;
}

/** Loose surface for transport methods we read off the player. */
interface PlayerSurface {
	play?: () => unknown;
	pause?: () => unknown;
	togglePlayback?: () => unknown;
	rewind?: (seconds?: number) => unknown;
	forward?: (seconds?: number) => unknown;
	volumeUp?: (step?: number) => unknown;
	volumeDown?: (step?: number) => unknown;
	toggleMute?: () => unknown;
}

/**
 * Keyboard-binding router. Subclasses override the `addX()` group methods to
 * define their own default bindings.
 *
 * Three extension layers:
 *   1. Setup options — `bindings`, `extend`, `scope`, `when`
 *   2. Runtime mutation — `bind`, `unbind`, `replace`, `enable`, `disable`
 *   3. Subclass + override `addX()` group methods
 */
export class KeyHandlerPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, KeyHandlerOptions<P>> {
	static override readonly id: string = 'key-handler';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Keyboard binding router with overridable group methods';

	private _bindings: Map<string, (e: KeyboardEvent) => void> = new Map();
	private lastFireAt: number = 0;

	/**
	 * Parse a combo string like `'shift+ArrowLeft'`, `'ctrl+arrowright'`,
	 * `'alt+arrowleft'`, `'+'`, `'shift++'` into a canonical map key.
	 *
	 * Rules:
	 *  - Modifier prefixes are case-insensitive: `alt+`, `ctrl+`, `shift+`.
	 *  - Modifiers are folded to a stable order in the result: `alt`, `ctrl`, `shift`.
	 *  - The KEY (last segment) is lowercased when length === 1, otherwise kept.
	 *    `'P'` → `'p'`, `'ArrowLeft'` → `'ArrowLeft'`.
	 *  - Trailing `+` is preserved as the key — `'+'` and `'shift++'` parse cleanly.
	 *  - A combo without modifiers fires only when NO modifiers are held — a
	 *    `'shift+ArrowLeft'` and `'ArrowLeft'` are independent bindings.
	 */
	private static readonly COMBO_MOD_RE = /^(alt|ctrl|shift)\+/i;

	private parseCombo(combo: string): { key: string; mods: { alt: boolean; ctrl: boolean; shift: boolean } } {
		const mods = {
			alt: false,
			ctrl: false,
			shift: false,
		};
		let s = combo;
		while (true) {
			const m = KeyHandlerPlugin.COMBO_MOD_RE.exec(s);
			if (!m)
				break;
			const tag = m[1]!.toLowerCase() as 'alt' | 'ctrl' | 'shift';
			mods[tag] = true;
			s = s.slice(m[0]!.length);
		}
		return {
			key: s,
			mods,
		};
	}

	private canonicalKey(key: string, mods: { alt: boolean; ctrl: boolean; shift: boolean }): string {
		const parts: string[] = [];
		if (mods.alt)
			parts.push('alt');
		if (mods.ctrl)
			parts.push('ctrl');
		if (mods.shift)
			parts.push('shift');
		const k = key.length === 1 ? key.toLowerCase() : key;
		return parts.length ? `${parts.join('+')}+${k}` : k;
	}

	/** Registers default bindings, applies options bindings, and attaches the keydown listener. */
	override use(): void {
		this.addDefaults();
		this.applyOptions();

		const target = this.scope();
		this.listen(target, 'keydown', this.handleKeydown as EventListener);
	}

	/** Register a handler for a keyboard combo string (e.g. `'shift+ArrowLeft'`). */
	bind(combo: string, fn: (p: P) => void): void {
		this._bindings.set(this.normalizeCombo(combo), () => fn(this.player));
	}

	/** Remove the handler for the given combo. No-ops when the combo isn't registered. */
	unbind(combo: string): void {
		this._bindings.delete(this.normalizeCombo(combo));
	}

	/** Replace an existing binding. Equivalent to calling `bind` when the combo already exists. */
	replace(combo: string, fn: (p: P) => void): void {
		this.bind(combo, fn);
	}

	/** Current key-binding map, re-shaped to the public `(player) => void` signature. */
	bindings(): ReadonlyMap<string, (p: P) => void> {
		const out = new Map<string, (p: P) => void>();
		for (const key of this._bindings.keys()) {
			out.set(key, (p: P) => {
				const handler = this._bindings.get(key);
				if (handler)
					handler(new KeyboardEvent('keydown', { key }));
				void p;
			});
		}
		return out;
	}

	/** Resolve the EventTarget the keydown listener attaches to. */
	scope(): EventTarget {
		const opt = this.opts?.scope;
		if (opt instanceof EventTarget)
			return opt;
		if (opt === 'container') {
			const container = (this.player as unknown as { container?: HTMLElement }).container;
			if (container)
				return container;
		}
		if (typeof document !== 'undefined')
			return document;
		// Fallback for non-DOM environments — return a noop EventTarget.
		return new EventTarget();
	}

	/** Apply user-supplied options.bindings. Called by `use()`. */
	protected applyOptions(): void {
		const opts = this.opts ?? {};
		if (opts.extend === false)
			this._bindings.clear();
		const userBindings = opts.bindings;
		if (userBindings) {
			for (const [key, fn] of Object.entries(userBindings)) {
				this.bind(key, fn);
			}
		}
	}

	/** Hook for subclasses — calls all addX group methods. */
	protected addDefaults(): void {
		this.addPlaybackKeys();
		this.addNavigationKeys();
		this.addVolumeKeys();
		this.addMediaKeys();
	}

	protected addPlaybackKeys(): void {
		const surface = (): PlayerSurface => this.player as unknown as PlayerSurface;
		this.bind(' ', () => {
			void surface().togglePlayback?.();
		});
	}

	protected addNavigationKeys(): void {
		const surface = (): PlayerSurface => this.player as unknown as PlayerSurface;
		this.bind('ArrowLeft', () => {
			void surface().rewind?.(5);
		});
		this.bind('ArrowRight', () => {
			void surface().forward?.(5);
		});
	}

	protected addVolumeKeys(): void {
		const surface = (): PlayerSurface => this.player as unknown as PlayerSurface;
		this.bind('ArrowUp', () => {
			void surface().volumeUp?.();
		});
		this.bind('ArrowDown', () => {
			void surface().volumeDown?.();
		});
	}

	protected addMediaKeys(): void {
		const surface = (): PlayerSurface => this.player as unknown as PlayerSurface;
		this.bind('m', () => {
			void surface().toggleMute?.();
		});
	}

	/** Default bindings convenience — same as `addDefaults()`. */
	protected defaultBindings(): void {
		this.addDefaults();
	}

	private normalizeCombo(combo: string): string {
		const { key, mods } = this.parseCombo(combo);
		return this.canonicalKey(key, mods);
	}

	private readonly handleKeydown = (e: Event): void => {
		const ev = e as KeyboardEvent;
		if (!this.enabled())
			return;
		if (this.isTypingTarget(ev.target))
			return;

		// Optional `when` predicate — if it returns false, drop.
		const when = this.opts?.when;
		if (typeof when === 'function' && !when(ev))
			return;

		// Cooldown — skip if fired too recently.
		const cooldown = this.opts?.cooldownMs ?? 300;
		const now = Date.now();
		if (cooldown > 0 && now - this.lastFireAt < cooldown) {
			// Cooldowns are intentionally permissive — only fire if outside the window.
			return;
		}

		const canonical = this.canonicalKey(ev.key, {
			alt: ev.altKey,
			ctrl: ev.ctrlKey,
			shift: ev.shiftKey,
		});
		const handler = this._bindings.get(canonical);
		if (!handler)
			return;
		this.lastFireAt = now;
		handler(ev);
	};

	private isTypingTarget(target: EventTarget | null): boolean {
		if (!target || !(target instanceof Element))
			return false;
		const tag = target.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
			return true;
		if ((target as HTMLElement).isContentEditable)
			return true;
		return false;
	}
}

/** Plugin alias for {@link KeyHandlerPlugin}. Pass to `addPlugin(keyHandlerPlugin)`. */
export const keyHandlerPlugin = KeyHandlerPlugin;
