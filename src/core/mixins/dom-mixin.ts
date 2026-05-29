import type { AddClasses, CreateElement } from '../../adapters/element-factory';
import type { Internals } from '../state';
import {
	addClasses,
	createButton,
	createElement,
	createSVG,
	removeClasses,
} from '../../adapters/element-factory';

// ──────────────────────────────────────────────────────────────────────────
// Mixin: DOM construction helpers re-exposed on the player so plugins and UI
// authors can call `this.player.createElement(...)` without importing from a
// separate utility path. The helper implementations live in the
// element-factory adapter; this mixin binds them onto the player prototype.
// ──────────────────────────────────────────────────────────────────────────

export const domMethods = {
	/**
	 * Create a DOM element of `type`, assign it `id`, and return a fluent
	 * builder that can add classes, append/prepend to a parent, and retrieve
	 * the element via `.get()`. When `unique` is true, an existing element with
	 * the same id is returned instead of creating a duplicate.
	 */
	createElement<K extends keyof HTMLElementTagNameMap>(
		this: Internals,
		type: K,
		id: string,
		unique?: boolean,
	): CreateElement<HTMLElementTagNameMap[K]> {
		return createElement(type, id, unique);
	},

	/**
	 * Create an accessible `<button>` element pre-wired with `type="button"`,
	 * an `aria-label`, a `title`, and a click handler. Ready to insert — no
	 * additional attribute setup needed.
	 */
	createButton(this: Internals, id: string, label: string, onClick: (e: Event) => void): HTMLButtonElement {
		return createButton(id, label, onClick);
	},

	/**
	 * Create an `<svg>` element in the SVG namespace, setting `id`, `viewBox`,
	 * and `xmlns`. Caller appends path/use children after `.get()`.
	 */
	createSVG(this: Internals, id: string, viewBox: string): SVGSVGElement {
		return createSVG(id, viewBox);
	},

	/**
	 * Add CSS class names to `el` (skips empty strings) and return a fluent
	 * builder for further chaining. Safe to call with an empty array.
	 */
	addClasses<T extends Element>(this: Internals, el: T, names: string[]): AddClasses<T> {
		return addClasses(el, names);
	},

	/**
	 * Remove CSS class names from `el` (skips empty strings) and return the
	 * element itself. No fluent builder — removal is terminal.
	 */
	removeClasses<T extends Element>(this: Internals, el: T, names: string[]): T {
		return removeClasses(el, names);
	},
} as const;
