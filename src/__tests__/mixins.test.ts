/**
 * composeMixins() tests — prototype merge used to glue per-feature mixin
 * modules onto a Player class.
 *
 * Test groups:
 *  - Basic merge of plain methods
 *  - Multiple mixins compose
 *  - Later mixin overrides earlier on key collision
 *  - Getters/setters preserved as descriptors (not triggered)
 */

import { describe, expect, it } from 'vitest';
import { composeMixins } from '../core/compose';

describe('composeMixins()', () => {
	it('copies method properties onto the prototype', () => {
		class Target {}
		const mixin = {
			greet() { return 'hello'; },
		};
		composeMixins(Target.prototype, mixin);
		const instance = new Target() as Target & { greet: () => string };
		expect(instance.greet()).toBe('hello');
	});

	it('composes multiple mixins', () => {
		class Target {}
		composeMixins(
			Target.prototype,
			{ a() { return 'a'; } },
			{ b() { return 'b'; } },
			{ c() { return 'c'; } },
		);
		const instance = new Target() as Target & { a: () => string; b: () => string; c: () => string };
		expect(instance.a()).toBe('a');
		expect(instance.b()).toBe('b');
		expect(instance.c()).toBe('c');
	});

	it('later mixin overrides earlier on key collision', () => {
		class Target {}
		composeMixins(
			Target.prototype,
			{ method() { return 'first'; } },
			{ method() { return 'second'; } },
		);
		const instance = new Target() as Target & { method: () => string };
		expect(instance.method()).toBe('second');
	});

	it('preserves getters as descriptors (does not trigger them)', () => {
		class Target {}
		let triggered = 0;
		const mixin = {
			get value() {
				triggered += 1;
				return 'computed';
			},
		};
		composeMixins(Target.prototype, mixin);
		// composeMixins must not have invoked the getter yet
		expect(triggered).toBe(0);

		const instance = new Target() as Target & { value: string };
		expect(instance.value).toBe('computed');
		expect(triggered).toBe(1);
	});

	it('preserves setters', () => {
		class Target {
			_x = '';
		}
		const mixin = {
			set value(v: string) { (this as any)._x = `set:${v}`; },
		};
		composeMixins(Target.prototype, mixin);
		const instance = new Target() as Target & { value: string };
		instance.value = 'foo';
		expect(instance._x).toBe('set:foo');
	});

	it('handles empty mixin list', () => {
		class Target {}
		expect(() => composeMixins(Target.prototype)).not.toThrow();
	});

	it('handles empty mixin objects', () => {
		class Target {}
		expect(() => composeMixins(Target.prototype, {})).not.toThrow();
	});

	it('subclass inherits composed methods via prototype chain', () => {
		class Base {}
		composeMixins(Base.prototype, {
			greet() {
				return 'base';
			},
		});
		class Sub extends Base {}
		const instance = new Sub() as Sub & { greet: () => string };
		expect(instance.greet()).toBe('base');
	});
});
