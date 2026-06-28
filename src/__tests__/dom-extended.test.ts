// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended DOM helper coverage — targets the uncovered functions in
 * `src/adapters/element-factory/dom.ts` that the primary dom.test.ts missed:
 *
 *  - createElement.setAttribute chain
 *  - createElement.setProperty chain
 *  - AddClasses.setAttribute chain
 *  - AddClasses.setProperty chain
 *  - AddClasses.prependTo chain
 *  - AppendTo.addClasses chain
 *  - makeAddClasses internal helpers
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createElement } from '../adapters/element-factory/dom';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('createElement() extended chain coverage', () => {
	describe('setAttribute from CreateElement', () => {
		it('sets an attribute on the element and returns AddClasses surface', () => {
			const el = createElement('div', 'attr-test')
				.setAttribute('data-foo', 'bar')
				.get();
			expect(el.getAttribute('data-foo')).toBe('bar');
		});

		it('chained setAttribute then get() returns the same element', () => {
			const builder = createElement('div', 'attr-chain');
			const chain = builder.setAttribute('role', 'presentation');
			const el = chain.get();
			expect(el.getAttribute('role')).toBe('presentation');
		});
	});

	describe('setProperty from CreateElement', () => {
		it('sets a CSS custom property on an HTMLElement', () => {
			const el = createElement('div', 'prop-test')
				.setProperty('--my-color', 'red')
				.get();
			expect(el.style.getPropertyValue('--my-color')).toBe('red');
		});

		it('setProperty on non-HTMLElement is a no-op (does not throw)', () => {
			const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svgEl.id = 'svg-prop';
			document.body.appendChild(svgEl);
			const chain = createElement('circle' as any, 'svg-prop', true);
			expect(() => chain.setProperty('--x', '1px')).not.toThrow();
		});
	});

	describe('AddClasses.setAttribute', () => {
		it('sets attribute after addClasses and returns AddClasses surface', () => {
			const el = createElement('div', 'addcls-attr')
				.addClasses(['my-class'])
				.setAttribute('tabindex', '0')
				.get();
			expect(el.getAttribute('tabindex')).toBe('0');
			expect(el.classList.contains('my-class')).toBe(true);
		});
	});

	describe('AddClasses.setProperty', () => {
		it('sets a CSS property after addClasses', () => {
			const el = createElement('div', 'addcls-prop')
				.addClasses(['x'])
				.setProperty('color', 'blue')
				.get();
			expect(el.style.color).toBe('blue');
		});
	});

	describe('AddClasses.prependTo', () => {
		it('inserts element as first child of parent', () => {
			const parent = document.createElement('section');
			const existing = document.createElement('span');
			parent.appendChild(existing);
			document.body.appendChild(parent);

			const inserted = createElement('div', 'prepend-via-chain')
				.addClasses(['pre'])
				.prependTo(parent)
				.get();
			expect(parent.firstChild).toBe(inserted);
			expect(parent.lastChild).toBe(existing);
		});
	});

	describe('AppendTo.addClasses', () => {
		it('adds classes after appendTo and returns element via get()', () => {
			const parent = document.createElement('section');
			document.body.appendChild(parent);

			const el = createElement('div', 'appendto-chain')
				.appendTo(parent)
				.addClasses(['after-append'])
				.get();
			expect(el.classList.contains('after-append')).toBe(true);
			expect(parent.contains(el)).toBe(true);
		});
	});

	describe('full deep chain', () => {
		it('setAttribute → addClasses → appendTo chain works end to end', () => {
			const parent = document.createElement('nav');
			document.body.appendChild(parent);

			const el = createElement('button', 'deep-chain')
				.setAttribute('type', 'button')
				.addClasses(['primary'])
				.appendTo(parent)
				.addClasses(['active'])
				.get();

			expect(el.getAttribute('type')).toBe('button');
			expect(el.classList.contains('primary')).toBe(true);
			expect(el.classList.contains('active')).toBe(true);
			expect(parent.contains(el)).toBe(true);
		});
	});
});
