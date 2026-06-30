// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Slice 03 — consequence-pinning tests for `domMethods`.
 *
 * Pinned consequences:
 *  6. `createElement('div', 'x')` creates a `<div>` and `.appendTo(parent)` attaches it
 *     as a child of the parent element.
 *  7. `addClasses(el, ['a','b'])` adds both classes; `removeClasses(el, ['a'])` removes
 *     only 'a' while 'b' remains.
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};

	get id(): string {
		return this.playerId;
	}

	declare options: any;
	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare createElement: <K extends keyof HTMLElementTagNameMap>(type: K, id: string, unique?: boolean) => { get: () => HTMLElementTagNameMap[K]; appendTo: (parent: Element) => { get: () => HTMLElementTagNameMap[K] }; addClasses: (names: string[]) => any };
	declare addClasses: <T extends Element>(el: T, names: string[]) => { get: () => T };
	declare removeClasses: <T extends Element>(el: T, names: string[]) => T;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

describe('domMethods (slice 03)', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('createElement("div", "x") creates a <div> and appendTo(parent) attaches it as a child', () => {
		const player = makePlayer('dom-1');
		const parent = document.createElement('div');
		document.body.appendChild(parent);

		const builder = player.createElement('div', 'x');
		builder.appendTo(parent);

		const element = builder.get();

		expect(element.tagName.toLowerCase()).toBe('div');
		expect(element.id).toBe('x');
		expect(parent.contains(element)).toBe(true);
	});

	it('addClasses(el, ["a","b"]) adds both; removeClasses(el, ["a"]) removes only "a", "b" stays', () => {
		const player = makePlayer('dom-2');
		const el = document.createElement('span');

		player.addClasses(el, ['a', 'b']);

		expect(el.classList.contains('a')).toBe(true);
		expect(el.classList.contains('b')).toBe(true);

		player.removeClasses(el, ['a']);

		expect(el.classList.contains('a')).toBe(false);
		expect(el.classList.contains('b')).toBe(true);
	});
});
