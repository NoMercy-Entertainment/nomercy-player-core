// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

const TAG_RE = /(<\/?([ibu])>)/gi;

/**
 * Build a `DocumentFragment` from a `VTTSubtitlePayload.markup` string.
 *
 * Recognised inline tags — `<i>`, `<b>`, `<u>` with arbitrary nesting — are
 * turned into real DOM elements. Everything else becomes a text node, so cue
 * payloads cannot inject arbitrary HTML.
 *
 * All subtitle overlays and debug renderers should call this function so they
 * produce an identical DOM tree from the same parsed cue.
 *
 * Browser-only: `document` must exist. Server-side consumers should use
 * `payload.text` directly.
 */
export function buildSubtitleFragment(markup: string): DocumentFragment {
	const fragment = document.createDocumentFragment();
	if (!markup)
		return fragment;

	const stack: (DocumentFragment | HTMLElement)[] = [fragment];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	TAG_RE.lastIndex = 0;
	match = TAG_RE.exec(markup);
	while (match !== null) {
		const before = markup.slice(lastIndex, match.index);
		if (before)
			stack[stack.length - 1]!.appendChild(document.createTextNode(before));

		const fullTag = match[1]!;
		const tagName = match[2]!.toLowerCase();
		const isClosing = fullTag.startsWith('</');

		if (!isClosing) {
			const el = document.createElement(tagName);
			stack[stack.length - 1]!.appendChild(el);
			stack.push(el);
		}
		else {
			// Pop back to the matching open tag; unmatched closers are ignored
			// gracefully — a malformed cue still renders, just without that pair.
			for (let i = stack.length - 1; i > 0; i--) {
				const top = stack[i];
				if (top instanceof HTMLElement && top.tagName.toLowerCase() === tagName) {
					stack.splice(i, 1);
					break;
				}
			}
		}
		lastIndex = match.index + fullTag.length;
		match = TAG_RE.exec(markup);
	}

	const tail = markup.slice(lastIndex);
	if (tail)
		stack[stack.length - 1]!.appendChild(document.createTextNode(tail));

	return fragment;
}
