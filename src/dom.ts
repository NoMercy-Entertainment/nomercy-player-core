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
 * Create or reuse an element by id with chainable post-creation helpers.
 *
 * If `unique` is true and an element with that id already exists in the
 * document, it's returned and reused (idempotent — useful for plugins that
 * may re-init without disposal). Otherwise a fresh element is created.
 *
 * Chained methods all return the same element wrapped in a different surface
 * so callers can fluently build up a tree:
 *
 * ```ts
 * createElement('div', 'my-overlay')
 *   .addClasses(['overlay', 'visible'])
 *   .appendTo(player.container);
 * ```
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

export function addClasses<T extends Element>(el: T, names: string[]): AddClasses<T> {
	for (const name of names) {
		if (name)
			el.classList.add(name);
	}
	return makeAddClasses(el);
}

export function removeClasses<T extends Element>(el: T, names: string[]): T {
	for (const name of names) {
		if (name)
			el.classList.remove(name);
	}
	return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function createSVG(id: string, viewBox: string): SVGSVGElement {
	const svg = document.createElementNS(SVG_NS, 'svg');
	svg.setAttribute('id', id);
	svg.setAttribute('viewBox', viewBox);
	svg.setAttribute('xmlns', SVG_NS);
	return svg;
}

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
