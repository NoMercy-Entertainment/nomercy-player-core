import { resourceError, stateError } from '../errors';


// ──────────────────────────────────────────────────────────────────────────
// Three-form constructor resolution
// ──────────────────────────────────────────────────────────────────────────

export type PlayerCtorResolution<C>
	= | { kind: 'existing'; instance: C }
		| { kind: 'mount'; id: string; div: HTMLDivElement };

function _isHTMLDivElement(el: Element): el is HTMLDivElement {
	return el.tagName === 'DIV';
}

export function resolvePlayerConstructor<C>(
	id: string | number | undefined,
	instances: Map<string, C>,
	className: string,
): PlayerCtorResolution<C> {
	if (id === undefined) {
		if (instances.size === 0) {
			throw stateError('core:player/no-element', `No ${className} instance has been created yet. Pass a div id first.`);
		}
		const first = instances.values().next().value;
		if (!first)
			throw stateError('core:player/no-element', 'Registry empty.');
		return {
			kind: 'existing',
			instance: first,
		};
	}

	if (typeof id === 'number') {
		const list = Array.from(instances.values());
		const target = list[id];
		if (!target) {
			throw stateError('core:player/not-found', `No ${className} instance at index ${id} (registry size: ${list.length}).`);
		}
		return {
			kind: 'existing',
			instance: target,
		};
	}

	if (typeof id !== 'string') {
		throw stateError('core:player/invalid-id-type', `Player id must be a string or number; got ${typeof id}.`);
	}

	const existing = instances.get(id);
	if (existing) {
		return {
			kind: 'existing',
			instance: existing,
		};
	}

	const element = typeof document !== 'undefined' ? document.getElementById(id) : null;
	if (!element) {
		throw resourceError('core:player/element-missing', `No element found with id "${id}".`);
	}
	if (!_isHTMLDivElement(element)) {
		throw stateError('core:player/element-not-div', `Element with id "${id}" is a <${element.tagName.toLowerCase()}>, not a <div>.`);
	}

	return {
		kind: 'mount',
		id,
		div: element,
	};
}
