/**
 * Structural base-style injection tests.
 *
 * `ensureBaseStyles` must:
 *   - Inject the stylesheet into the container's document head.
 *   - Cover the structural rules (container context, video fill).
 *   - Be idempotent — one sheet per document regardless of player count.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { ensureBaseStyles } from '../core/base-styles';

describe('ensureBaseStyles()', () => {
	beforeEach(() => {
		document.getElementById('nmplayer-base-styles')?.remove();
	});

	it('injects the structural stylesheet into the document head', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);

		ensureBaseStyles(container);

		const sheet = document.getElementById('nmplayer-base-styles');
		expect(sheet).not.toBeNull();
		expect(sheet!.tagName).toBe('STYLE');
		expect(sheet!.textContent).toContain('.nomercyplayer video');
		expect(sheet!.textContent).toContain('object-fit: contain');
		expect(sheet!.textContent).toContain('position: relative');
	});

	it('is idempotent — a second player does not duplicate the sheet', () => {
		const first = document.createElement('div');
		const second = document.createElement('div');
		document.body.append(first, second);

		ensureBaseStyles(first);
		ensureBaseStyles(second);

		expect(document.querySelectorAll('#nmplayer-base-styles')).toHaveLength(1);
	});
});
