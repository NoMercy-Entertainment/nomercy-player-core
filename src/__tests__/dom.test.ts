/**
 * DOM helper tests — createElement (chainable), addClasses, removeClasses,
 * createSVG, createButton.
 *
 * Test groups:
 *  - createElement — fresh element, unique-reuse path, chain methods
 *  - addClasses / removeClasses — class manipulation, ignores empty strings
 *  - createSVG — namespaced + viewBox + id
 *  - createButton — type=button + aria-label + click handler
 *  - Chain composition — addClasses → appendTo → addClasses
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { addClasses, createButton, createElement, createSVG, removeClasses } from '../dom';

afterEach(() => {
	document.body.innerHTML = '';
});

describe('createElement()', () => {
	it('creates a fresh element of the given tag', () => {
		const el = createElement('div', 'my-id').get();
		expect(el).toBeInstanceOf(HTMLDivElement);
	});

	it('assigns the id when not already set', () => {
		const el = createElement('div', 'my-id').get();
		expect(el.id).toBe('my-id');
	});

	it('reuses an existing element when unique=true and one exists with that id', () => {
		const existing = document.createElement('div');
		existing.id = 'existing';
		document.body.appendChild(existing);

		const el = createElement('div', 'existing', true).get();
		expect(el).toBe(existing);
	});

	it('creates a fresh element when unique=true but no existing element matches', () => {
		const el = createElement('div', 'absent', true).get();
		expect(el).toBeInstanceOf(HTMLDivElement);
		expect(el.id).toBe('absent');
	});

	it('creates a new element when unique=false even if one exists', () => {
		const existing = document.createElement('div');
		existing.id = 'collide';
		document.body.appendChild(existing);

		const el = createElement('div', 'collide').get();
		expect(el).not.toBe(existing);
	});

	describe('chainable interface', () => {
		it('addClasses returns AddClasses surface with appendTo', () => {
			const el = createElement('div', 'x')
				.addClasses(['foo', 'bar'])
				.get();
			expect(el.classList.contains('foo')).toBe(true);
			expect(el.classList.contains('bar')).toBe(true);
		});

		it('addClasses ignores empty strings', () => {
			const el = createElement('div', 'x')
				.addClasses(['foo', '', 'bar'])
				.get();
			expect(el.classList.length).toBe(2);
		});

		it('appendTo adds element to parent', () => {
			const parent = document.createElement('section');
			document.body.appendChild(parent);
			createElement('div', 'child').appendTo(parent);
			expect(parent.firstChild).toBeInstanceOf(HTMLDivElement);
		});

		it('prependTo inserts as first child', () => {
			const parent = document.createElement('section');
			parent.appendChild(document.createElement('span'));
			createElement('div', 'first').prependTo(parent);
			expect(parent.firstChild).toBeInstanceOf(HTMLDivElement);
		});

		it('chains addClasses → appendTo → addClasses', () => {
			const parent = document.createElement('section');
			document.body.appendChild(parent);
			const el = createElement('div', 'chained')
				.addClasses(['a', 'b'])
				.appendTo(parent)
				.addClasses(['c', 'd'])
				.get();
			expect(el.classList.contains('a')).toBe(true);
			expect(el.classList.contains('d')).toBe(true);
			expect(parent.contains(el)).toBe(true);
		});
	});
});

describe('addClasses()', () => {
	it('adds all given classes to the element', () => {
		const el = document.createElement('div');
		addClasses(el, ['x', 'y']);
		expect(el.classList.contains('x')).toBe(true);
		expect(el.classList.contains('y')).toBe(true);
	});

	it('skips empty strings', () => {
		const el = document.createElement('div');
		addClasses(el, ['', 'real']);
		expect(el.classList.length).toBe(1);
	});

	it('returns a chainable AddClasses surface', () => {
		const el = document.createElement('div');
		const chain = addClasses(el, ['x']);
		expect(typeof chain.appendTo).toBe('function');
		expect(typeof chain.addClasses).toBe('function');
		expect(chain.get()).toBe(el);
	});
});

describe('removeClasses()', () => {
	it('removes given classes', () => {
		const el = document.createElement('div');
		el.classList.add('keep', 'drop');
		removeClasses(el, ['drop']);
		expect(el.classList.contains('keep')).toBe(true);
		expect(el.classList.contains('drop')).toBe(false);
	});

	it('skips empty strings', () => {
		const el = document.createElement('div');
		el.classList.add('a');
		expect(() => removeClasses(el, [''])).not.toThrow();
	});

	it('returns the element for chaining', () => {
		const el = document.createElement('div');
		expect(removeClasses(el, ['x'])).toBe(el);
	});
});

describe('createSVG()', () => {
	it('creates an SVG element with the SVG namespace', () => {
		const svg = createSVG('icon', '0 0 24 24');
		expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
	});

	it('sets the id', () => {
		const svg = createSVG('icon', '0 0 24 24');
		expect(svg.getAttribute('id')).toBe('icon');
	});

	it('sets the viewBox', () => {
		const svg = createSVG('icon', '0 0 24 24');
		expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
	});

	it('sets xmlns attribute for inline SVG safety', () => {
		const svg = createSVG('icon', '0 0 24 24');
		expect(svg.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
	});
});

describe('createButton()', () => {
	it('creates a <button type="button">', () => {
		const btn = createButton('btn-id', 'Play', () => {});
		expect(btn.type).toBe('button');
	});

	it('sets the id', () => {
		const btn = createButton('btn-id', 'Play', () => {});
		expect(btn.id).toBe('btn-id');
	});

	it('sets aria-label and title from the label', () => {
		const btn = createButton('btn-id', 'Play', () => {});
		expect(btn.getAttribute('aria-label')).toBe('Play');
		expect(btn.title).toBe('Play');
	});

	it('attaches click handler', () => {
		const handler = vi.fn();
		const btn = createButton('btn-id', 'Play', handler);
		btn.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it('handler receives the click Event', () => {
		const handler = vi.fn();
		const btn = createButton('btn-id', 'Play', handler);
		btn.click();
		expect(handler.mock.calls[0]![0]).toBeInstanceOf(Event);
	});
});
