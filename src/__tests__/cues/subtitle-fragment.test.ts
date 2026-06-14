// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Tests for `buildSubtitleFragment` — the kit-side helper renderers use to
 * convert a `VTTSubtitlePayload.markup` string into a `DocumentFragment`
 * with safe DOM nodes. Inline `<i>`, `<b>`, `<u>` are honoured; everything
 * else is treated as plain text via `createTextNode`.
 */
import { describe, expect, it } from 'vitest';

import { buildSubtitleFragment } from '../../adapters/subtitle-renderer/dom';

// happy-dom is wired via vitest.config.ts; `document` is global in the suite.

function render(markup: string): string {
	const fragment = buildSubtitleFragment(markup);
	const host = document.createElement('span');
	host.appendChild(fragment);
	return host.innerHTML;
}

describe('buildSubtitleFragment', () => {
	it('returns an empty fragment for empty input', () => {
		expect(render('')).toBe('');
	});

	it('renders plain text via text nodes', () => {
		expect(render('Hello world')).toBe('Hello world');
	});

	it('renders <i> as italic element', () => {
		expect(render('<i>italic</i>')).toBe('<i>italic</i>');
	});

	it('renders <b> as bold element', () => {
		expect(render('<b>bold</b>')).toBe('<b>bold</b>');
	});

	it('renders <u> as underline element', () => {
		expect(render('<u>under</u>')).toBe('<u>under</u>');
	});

	it('renders nested <b><i>...</i></b> as nested DOM', () => {
		expect(render('<b><i>x</i></b>')).toBe('<b><i>x</i></b>');
	});

	it('handles overlapping safe + unsafe pairs by ignoring unmatched closers', () => {
		// `</span>` isn't recognised so it stays as literal text — `<b>` opens,
		// `</b>` closes correctly.
		expect(render('<b>x</b></span>')).toBe('<b>x</b>&lt;/span&gt;');
	});

	it('does NOT execute injected scripts (createTextNode escapes)', () => {
		const markup = '<script>alert(1)</script>Hello';
		const out = render(markup);
		// `<script>` is not in the whitelist, so it falls through to the text
		// node path and gets HTML-escaped via DOM serialisation.
		expect(out).toContain('&lt;script&gt;');
		expect(out).not.toContain('<script>');
	});

	it('preserves whitespace and punctuation between tags', () => {
		expect(render('<b>A</b>, <i>B</i>!')).toBe('<b>A</b>, <i>B</i>!');
	});

	it('handles multi-line text via newlines', () => {
		expect(render('line one\nline two')).toBe('line one\nline two');
	});
});
