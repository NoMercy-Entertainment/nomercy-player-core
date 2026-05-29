/** Chainable element-creation helper. Both players + plugin authors use these. */
export interface CreateElement<T extends Element> {
	get: () => T;
	addClasses: (names: string[]) => AddClasses<T>;
	appendTo: (parent: Element) => AppendTo<T>;
	prependTo: (parent: Element) => AppendTo<T>;
}

export interface AddClasses<T extends Element> {
	get: () => T;
	appendTo: (parent: Element) => AppendTo<T>;
	prependTo: (parent: Element) => AppendTo<T>;
	addClasses: (names: string[]) => AddClasses<T>;
	setAttribute: (name: string, value: string) => AddClasses<T>;
	setProperty: (name: string, value: string) => AddClasses<T>;
}

export interface AppendTo<T extends Element> {
	get: () => T;
	addClasses: (names: string[]) => AddClasses<T>;
}

/**
 * Standalone DOM element factory. When `unique` is true, an existing element
 * with `id` is reused instead of creating a second one — useful for singleton
 * overlays (progress bar, subtitle container) that plugins may construct in
 * `mount()` and check for on re-mount. Returns a fluent builder.
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
	type: K,
	id: string,
	unique?: boolean,
): CreateElement<HTMLElementTagNameMap[K]> {
	let el: HTMLElementTagNameMap[K];
	if (unique) {
		const existing = document.querySelector<HTMLElementTagNameMap[K]>(`#${CSS.escape(id)}`);
		el = existing ?? document.createElement(type);
	}
	else {
		el = document.createElement(type);
	}
	if (!el.id)
		el.id = id;

	return {
		get: () => el,
		addClasses: (names: string[]) => addClasses(el, names),
		appendTo: (parent: Element) => {
			parent.appendChild(el);
			return makeAppendTo(el);
		},
		prependTo: (parent: Element) => {
			parent.insertBefore(el, parent.firstChild);
			return makeAppendTo(el);
		},
	};
}

/** Add CSS class names to `el`, skipping empty strings. Returns a fluent builder. */
export function addClasses<T extends Element>(el: T, names: string[]): AddClasses<T> {
	for (const name of names) {
		if (name)
			el.classList.add(name);
	}
	return makeAddClasses(el);
}

/** Remove CSS class names from `el`, skipping empty strings. Returns `el` directly. */
export function removeClasses<T extends Element>(el: T, names: string[]): T {
	for (const name of names) {
		if (name)
			el.classList.remove(name);
	}
	return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Create an `<svg>` element in the SVG namespace with `id`, `viewBox`, and
 * `xmlns` set. Caller appends path/symbol/use children directly on the return value.
 */
export function createSVG(id: string, viewBox: string): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('id', id);
	svg.setAttribute('viewBox', viewBox);
	svg.setAttribute('xmlns', SVG_NS);
	return svg;
}

/**
 * Create an accessible `<button>` with `type="button"`, `aria-label`, `title`,
 * and a click listener attached. The returned element is ready to insert — no
 * additional attribute setup is required.
 */
export function createButton(id: string, label: string, onClick: (e: Event) => void): HTMLButtonElement {
	const button = document.createElement('button');
	button.id = id;
	button.type = 'button';
	button.setAttribute('aria-label', label);
	button.title = label;
	button.addEventListener('click', onClick);
	return button;
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

function makeAppendTo<T extends Element>(el: T): AppendTo<T> {
	return {
		get: () => el,
		addClasses: (names: string[]) => addClasses(el, names),
	};
}

function makeAddClasses<T extends Element>(el: T): AddClasses<T> {
	return {
		get: () => el,
		appendTo: (parent: Element) => {
			parent.appendChild(el);
			return makeAppendTo(el);
		},
		prependTo: (parent: Element) => {
			parent.insertBefore(el, parent.firstChild);
			return makeAppendTo(el);
		},
		addClasses: (names: string[]) => addClasses(el, names),
		setAttribute: (name: string, value: string) => {
			el.setAttribute(name, value);
			return makeAddClasses(el);
		},
		setProperty: (name: string, value: string) => {
			if (el instanceof HTMLElement)
				el.style.setProperty(name, value);
			return makeAddClasses(el);
		},
	};
}
