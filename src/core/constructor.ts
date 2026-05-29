import { resourceError, stateError } from '../errors';

/**
 * Discriminated result from {@link resolvePlayerConstructor}.
 *
 * `existing` — a player with the requested identity is already registered.
 * `C` is the concrete player class; callers narrow on `kind` before reading
 * `instance`.
 *
 * `mount` — no registered player matched; the DOM element is present and ready
 * to receive a new instance. Callers receive the raw `HTMLDivElement` so they
 * can construct and register the player themselves.
 */
export type PlayerCtorResolution<C>
	= | { kind: 'existing'; instance: C }
		| { kind: 'mount'; id: string; div: HTMLDivElement };

function _isHTMLDivElement(el: Element): el is HTMLDivElement {
	return el.tagName === 'DIV';
}

/**
 * Three-form factory entry point shared by `NMMusicPlayer` and `NMVideoPlayer`.
 *
 * Callers pass whatever the user handed to the static constructor — a string
 * id, a numeric index into the registry, or `undefined` — and get back a
 * typed {@link PlayerCtorResolution} telling them whether to reuse an existing
 * player or mount a fresh one on the located `<div>`.
 *
 * **`id === undefined`** — returns the first registered player. Throws
 * `core:player/no-element` when the registry is empty (nothing has been
 * mounted yet).
 *
 * **`id` is a number** — treats the value as a zero-based index into the
 * registry's insertion order. Throws `core:player/not-found` when the index
 * is out of range.
 *
 * **`id` is a string** — checks the registry for an existing player keyed by
 * that string. If found, returns it as `existing`. If not found, calls
 * `document.getElementById(id)` and requires a `<div>`: throws
 * `core:player/element-missing` when no element exists, and
 * `core:player/element-not-div` when the element is any other tag.
 *
 * SSR-safe: the `document.getElementById` call is guarded behind a
 * `typeof document !== 'undefined'` check.
 */
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
