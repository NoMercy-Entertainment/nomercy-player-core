/**
 * Subtitle DOM fragment builder.
 *
 * Turns a `VTTSubtitlePayload.markup` string into a `DocumentFragment` with
 * real DOM nodes — `<i>`, `<b>`, `<u>` are honoured (with arbitrary
 * nesting); everything else is treated as plain text. Cue payloads can never
 * inject HTML because text content always goes through `createTextNode`.
 *
 * Port of v1's `subtitles.ts:buildSubtitleFragment` (see
 * `nomercy-video-player/src/player/subtitles.ts:172`). Lives kit-side so
 * every overlay / chrome / debug renderer produces an identical DOM tree
 * from the same parsed cue.
 *
 * Browser-only: `document` must exist. Server-side renderers should use
 * `payload.text` directly.
 */
const TAG_RE = /(<\/?(i|b|u)>)/gi;

export function buildSubtitleFragment(markup: string): DocumentFragment {
	const fragment = document.createDocumentFragment();
	if (!markup)
		return fragment;

	const stack: (DocumentFragment | HTMLElement)[] = [fragment];
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	TAG_RE.lastIndex = 0;
	while ((match = TAG_RE.exec(markup)) !== null) {
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
				const top = stack[i] as HTMLElement;
				if (top.tagName && top.tagName.toLowerCase() === tagName) {
					stack.splice(i, 1);
					break;
				}
			}
		}
		lastIndex = match.index + fullTag.length;
	}

	const tail = markup.slice(lastIndex);
	if (tail)
		stack[stack.length - 1]!.appendChild(document.createTextNode(tail));

	return fragment;
}
