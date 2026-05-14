import type { AddClasses } from '../../dom';
import {
	addClasses as domAddClasses,
	createButton as domCreateButton,
	createElement as domCreateElement,
	createSVG as domCreateSVG,
	removeClasses as domRemoveClasses,
} from '../../dom';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: DOM construction helpers — re-exposes the dom.ts builder functions
// on the player so plugins/UI authors can chain via `this.player.createElement(...)`
// matching the v1 ergonomics. Pure delegations; no extra state.
// ──────────────────────────────────────────────────────────────────────────

export const domMethods = {
	createElement<K extends keyof HTMLElementTagNameMap>(
		this: Internals,
		type: K,
		id: string,
		unique?: boolean,
	): ReturnType<typeof domCreateElement<K>> {
		return domCreateElement(type, id, unique);
	},
	createButton(this: Internals, id: string, label: string, onClick: (e: Event) => void): HTMLButtonElement {
		return domCreateButton(id, label, onClick);
	},
	createSVG(this: Internals, id: string, viewBox: string): SVGSVGElement {
		return domCreateSVG(id, viewBox);
	},
	addClasses<T extends Element>(this: Internals, el: T, names: string[]): AddClasses<T> {
		return domAddClasses(el, names);
	},
	removeClasses<T extends Element>(this: Internals, el: T, names: string[]): T {
		return domRemoveClasses(el, names);
	},
} as const;
