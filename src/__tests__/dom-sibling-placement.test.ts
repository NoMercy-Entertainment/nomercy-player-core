// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';
import { createElement } from '../adapters/element-factory';

type Kids = [HTMLElement, HTMLElement, ...HTMLElement[]];

function parentWith(...ids: string[]): { parent: HTMLElement; kids: Kids } {
	const parent = document.createElement('div');
	const kids = ids.map((id) => {
		const kid = document.createElement('span');
		kid.id = id;
		parent.appendChild(kid);
		return kid;
	});
	return { parent, kids: kids as Kids };
}

const order = (parent: Element): string[] => Array.from(parent.children).map(child => child.id);

describe('createElement() sibling placement', () => {
	it('insertAfter places the element directly after the sibling', () => {
		const { parent, kids } = parentWith('a', 'b');
		createElement('button', 'x').insertAfter(kids[0]);
		expect(order(parent)).toEqual(['a', 'x', 'b']);
	});

	it('insertBefore places the element directly before the sibling', () => {
		const { parent, kids } = parentWith('a', 'b');
		createElement('button', 'x').insertBefore(kids[1]);
		expect(order(parent)).toEqual(['a', 'x', 'b']);
	});

	it('continues the chain like appendTo', () => {
		const { parent, kids } = parentWith('a');
		const el = createElement('div', 'x').insertAfter(kids[0]).addClasses(['skip']).get();
		expect(el.classList.contains('skip')).toBe(true);
		expect(order(parent)).toEqual(['a', 'x']);
	});

	it('works after addClasses and setAttribute steps', () => {
		const { parent, kids } = parentWith('a');
		createElement('div', 'x').addClasses(['c']).insertBefore(kids[0]);
		createElement('div', 'y').setAttribute('role', 'group').insertAfter(kids[0]);
		expect(order(parent)).toEqual(['x', 'a', 'y']);
	});

	it('throws when the sibling has no parent', () => {
		const orphan = document.createElement('div');
		expect(() => createElement('div', 'x').insertAfter(orphan)).toThrow(/parent/);
		expect(() => createElement('div', 'x').insertBefore(orphan)).toThrow(/parent/);
	});
});
