/**
 * Plugin base class tests — every method that has a real body. Stubs
 * (`mount`, `t`, `dispatchBefore`, `websocket`, `loadTranslations`, `derive`,
 * `clone`, `export`) are tested only at the throw-shape level since their
 * bodies land later.
 *
 * Test groups:
 *  - Static metadata defaults
 *  - initialize() — wires player/opts/lifecycle
 *  - enabled() / enable() / disable() — emits plugin:enabled / plugin:disabled
 *  - enabled() registry truth — use()-failed plugin is NOT returned by plugins()
 *  - state() — id, version, enabled, opts, runtime
 *  - getRuntimeState() — default empty, override hook
 *  - options() — shallow merge + plugin:opts:changed event
 *  - Two-form on/off/once/hasListeners — string AND class form
 *  - emit() — auto-namespaces under plugin:<id>:
 *  - throw() — surfaces PlayerError on the matching severity channel + plugin:error/warning
 *  - report() — same but does NOT abort flow
 *  - fetch() — wires authFetch with auth config + plugin scope
 *  - lifecycle delegates: listen / timeout / interval / abortable / frame
 *  - Stub methods throw "not implemented" (locked surface)
 */

import type { PluginAdvisory } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../adapters/lifecycle-registry/default';
import { PlayerError } from '../errors';
import { Plugin } from '../plugin';
import { StubPlayer } from '../testing/stub-player';

interface Options {
	value: number;
	mode?: string;
}

/**
 * Test subclass that exposes the protected methods publicly. The Plugin base
 * class is meant to be subclassed; the protected surface is what plugin
 * authors interact with from inside their subclass body.
 */
class TestPlugin extends Plugin<StubPlayer, Options> {
	static override readonly id: string = 'test';
	static override readonly version: string = '1.2.3';
	static override readonly description: string = 'Test plugin';

	runtimeState: Record<string, unknown> = { custom: 'value' };

	override use(): void {
		// no-op
	}

	override dispose(): void {
		// no-op
	}

	protected override getRuntimeState(): Record<string, unknown> {
		return this.runtimeState;
	}

	// ── Public passthroughs to protected surface for testing ──
	publicEmit(event: any, data?: any): void {
		return this.emit(event, data);
	}

	publicOn(...args: any[]): void {
		return (this as any).on(...args);
	}

	publicOnce(...args: any[]): void {
		return (this as any).once(...args);
	}

	publicOff(...args: any[]): void {
		return (this as any).off(...args);
	}

	publicHasListeners(...args: any[]): boolean {
		return (this as any).hasListeners(...args);
	}

	publicThrow(payload: any): never {
		(this as any).throw(payload);
		throw new Error('unreachable');
	}

	publicReport(payload: any): void {
		return this.report(payload);
	}

	publicFetch(url: string, options?: any): Promise<any> {
		return this.fetch(url, options);
	}

	publicListen(target: EventTarget, event: string, handler: EventListener): void {
		return this.listen(target, event, handler);
	}

	publicTimeout(fn: () => void, ms: number): number { return this.timeout(fn, ms); }
	publicInterval(fn: () => void, ms: number): number { return this.interval(fn, ms); }
	publicFrame(fn: any): void { return this.frame(fn); }
	publicAbortable(): AbortController { return this.abortable(); }
	publicMount(name: string): HTMLDivElement { return this.mount(name); }
	publicT(key: string, vars?: Record<string, string>): string { return this.t(key, vars); }
	publicDispatchBefore(name: string, data: any, opts?: any): Promise<any> { return this.dispatchBefore(name, data, opts); }
	publicWebsocket(url: string, opts?: any): unknown { return this.websocket(url, opts); }
}

class OtherPlugin extends Plugin<StubPlayer, unknown, { ping: { count: number } }> {
	static override readonly id: string = 'other';
	static override readonly version: string = '0.1.0';
}

function setupPlugin<P extends Plugin<any, any, any>>(
	PluginClass: new () => P,
	opts: P['opts'] | unknown,
): { plugin: P; player: StubPlayer; lifecycle: LifecycleRegistry } {
	const player = new StubPlayer();
	const lifecycle = new LifecycleRegistry();
	const plugin = new PluginClass();
	plugin.initialize(player as any, opts as P['opts'], lifecycle);
	return { plugin, player, lifecycle };
}

describe('Plugin base class', () => {
	let player: StubPlayer;
	let lifecycle: LifecycleRegistry;
	let plugin: TestPlugin;

	beforeEach(() => {
		({ plugin, player, lifecycle } = setupPlugin(TestPlugin, { value: 10 }));
	});

	afterEach(() => {
		lifecycle.dispose();
		player.reset();
	});

	// ─────────────────────────────────────────────────────────────────────
	// Static metadata
	// ─────────────────────────────────────────────────────────────────────

	describe('static metadata', () => {
		it('id, version, description on the class are accessible', () => {
			expect(TestPlugin.id).toBe('test');
			expect(TestPlugin.version).toBe('1.2.3');
			expect(TestPlugin.description).toBe('Test plugin');
		});

		it('base Plugin class defines neutral defaults', () => {
			expect(Plugin.id).toBe('plugin');
			expect(Plugin.version).toBe('0.0.0');
			expect(Plugin.description).toBe('');
		});

		it('static optional fields are undefined by default', () => {
			expect(Plugin.requires).toBeUndefined();
			expect(Plugin.replaces).toBeUndefined();
			expect(Plugin.advisories).toBeUndefined();
			expect(Plugin.translations).toBeUndefined();
			expect(Plugin.minCoreVersion).toBeUndefined();
			expect(Plugin.onError).toBeUndefined();
		});

		it('subclass can declare advisories', () => {
			class Advised extends Plugin {
				static override readonly id: string = 'advised';
				static override readonly advisories: ReadonlyArray<PluginAdvisory> = [
					{
						method: 'volume',
						duringPhase: ['playing'],
						severity: 'warning',
						reason: 'volume-during-playback',
						message: 'Adjusting volume mid-playback may cause artifacts.',
					},
				];
			}
			expect(Advised.advisories).toHaveLength(1);
		});

		it('instance.id returns the same value as the static id', () => {
			expect(plugin.id).toBe(TestPlugin.id);
			expect(plugin.id).toBe('test');
		});

		it('instance.id works for the base Plugin class', () => {
			const base = new Plugin();
			expect(base.id).toBe(Plugin.id);
			expect(base.id).toBe('plugin');
		});

		it('instance.id works for a second-level subclass', () => {
			class LayerOne extends Plugin {
				static override readonly id: string = 'layer-one';
			}
			class LayerTwo extends LayerOne {
				static override readonly id: string = 'layer-two';
			}
			const instance = new LayerTwo();
			expect(instance.id).toBe('layer-two');
			expect(instance.id).toBe(LayerTwo.id);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// initialize()
	// ─────────────────────────────────────────────────────────────────────

	describe('initialize()', () => {
		it('stores the player', () => {
			expect((plugin as any).player).toBe(player);
		});

		it('stores the options', () => {
			expect(plugin.opts).toEqual({ value: 10 });
		});

		it('stores the lifecycle', () => {
			expect((plugin as any).lifecycle).toBe(lifecycle);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// enabled / enable / disable
	// ─────────────────────────────────────────────────────────────────────

	describe('enabled() / enable() / disable()', () => {
		it('starts enabled', () => {
			expect(plugin.enabled()).toBe(true);
		});

		it('disable() sets enabled false', () => {
			plugin.disable();
			expect(plugin.enabled()).toBe(false);
		});

		it('enable() sets enabled true', () => {
			plugin.disable();
			plugin.enable();
			expect(plugin.enabled()).toBe(true);
		});

		it('disable() emits plugin:disabled with id + reason', () => {
			const handler = vi.fn();
			player.on('plugin:disabled' as any, handler);
			plugin.disable('test reason');
			expect(handler).toHaveBeenCalledWith({ id: 'test', reason: 'test reason' });
		});

		it('disable() emits plugin:disabled with id + undefined reason', () => {
			const handler = vi.fn();
			player.on('plugin:disabled' as any, handler);
			plugin.disable();
			expect(handler).toHaveBeenCalledWith({ id: 'test', reason: undefined });
		});

		it('enable() emits plugin:enabled with id', () => {
			plugin.disable();
			const handler = vi.fn();
			player.on('plugin:enabled' as any, handler);
			plugin.enable();
			expect(handler).toHaveBeenCalledWith({ id: 'test' });
		});

		it('enable() is idempotent — second call emits no event', () => {
			const handler = vi.fn();
			player.on('plugin:enabled' as any, handler);
			plugin.enable(); // already enabled
			expect(handler).not.toHaveBeenCalled();
		});

		it('disable() is idempotent — second call emits no event', () => {
			plugin.disable();
			const handler = vi.fn();
			player.on('plugin:disabled' as any, handler);
			plugin.disable();
			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// state()
	// ─────────────────────────────────────────────────────────────────────

	describe('state()', () => {
		it('returns id, version, enabled, opts, runtime', () => {
			const state = plugin.state();
			expect(state.id).toBe('test');
			expect(state.version).toBe('1.2.3');
			expect(state.enabled).toBe(true);
			expect(state.opts).toEqual({ value: 10 });
			expect(state.runtime).toEqual({ custom: 'value' });
		});

		it('reflects disabled state', () => {
			plugin.disable();
			expect(plugin.state().enabled).toBe(false);
		});

		it('reflects updated options', () => {
			plugin.options({ value: 99 });
			expect(plugin.state().opts).toEqual({ value: 99 });
		});

		it('reflects subclass getRuntimeState() override', () => {
			plugin.runtimeState = { dynamic: 42 };
			expect(plugin.state().runtime).toEqual({ dynamic: 42 });
		});

		it('default getRuntimeState returns empty object on base', () => {
			class Bare extends Plugin {
				static override readonly id: string = 'bare';
			}
			const { plugin: bare } = setupPlugin(Bare as unknown as typeof TestPlugin, undefined);
			expect(bare.state().runtime).toEqual({});
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// setOptions / getOptions
	// ─────────────────────────────────────────────────────────────────────

	describe('options() / options()', () => {
		it('options returns the current options', () => {
			expect(plugin.options()).toEqual({ value: 10 });
		});

		it('options shallow-merges into existing opts', () => {
			plugin.options({ mode: 'fast' });
			expect(plugin.options()).toEqual({ value: 10, mode: 'fast' });
		});

		it('options overwrites primitive fields', () => {
			plugin.options({ value: 99 });
			expect(plugin.options().value).toBe(99);
		});

		it('emits plugin:opts:changed on the player with id + new opts', () => {
			const handler = vi.fn();
			player.on('plugin:opts:changed' as any, handler);
			plugin.options({ value: 42 });
			expect(handler).toHaveBeenCalledWith({ id: 'test', opts: { value: 42 } });
		});

		it('emits plugin-scoped opts:changed via emit()', () => {
			const handler = vi.fn();
			player.on('plugin:test:opts:changed' as any, handler);
			plugin.options({ value: 99 });
			expect(handler).toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Event surface — string form (player events)
	// ─────────────────────────────────────────────────────────────────────

	describe('on() / off() / once() / hasListeners() — string form', () => {
		it('on(event, fn) listens to a player event', () => {
			const handler = vi.fn();
			plugin.publicOn('time' as any, handler);
			player.emit('time', { time: 5 });
			expect(handler).toHaveBeenCalledWith({ time: 5 });
		});

		it('on() registers cleanup with lifecycle so dispose removes the listener', () => {
			const handler = vi.fn();
			plugin.publicOn('time' as any, handler);
			lifecycle.dispose();
			player.emit('time', { time: 5 });
			expect(handler).not.toHaveBeenCalled();
		});

		it('once(event, fn) fires once', () => {
			const handler = vi.fn();
			plugin.publicOnce('time' as any, handler);
			player.emit('time', { time: 1 });
			player.emit('time', { time: 2 });
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('off(event, fn) detaches early', () => {
			const handler = vi.fn();
			plugin.publicOn('time' as any, handler);
			plugin.publicOff('time' as any, handler);
			player.emit('time', { time: 5 });
			expect(handler).not.toHaveBeenCalled();
		});

		it('hasListeners(event) reflects current state', () => {
			expect(plugin.publicHasListeners('time' as any)).toBe(false);
			plugin.publicOn('time' as any, () => {});
			expect(plugin.publicHasListeners('time' as any)).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Event surface — class form (plugin-scoped events)
	// ─────────────────────────────────────────────────────────────────────

	describe('on() / off() / once() / hasListeners() — class form', () => {
		it('on(Class, event, fn) listens under plugin:<id>: namespace', () => {
			const handler = vi.fn();
			plugin.publicOn(OtherPlugin, 'ping', handler);
			// Simulate the other plugin emitting its event
			player.emit('plugin:other:ping' as any, { count: 5 });
			expect(handler).toHaveBeenCalledWith({ count: 5 });
		});

		it('class form registers cleanup with lifecycle', () => {
			const handler = vi.fn();
			plugin.publicOn(OtherPlugin, 'ping', handler);
			lifecycle.dispose();
			player.emit('plugin:other:ping' as any, { count: 5 });
			expect(handler).not.toHaveBeenCalled();
		});

		it('once(Class, event, fn) fires once under namespace', () => {
			const handler = vi.fn();
			plugin.publicOnce(OtherPlugin, 'ping', handler);
			player.emit('plugin:other:ping' as any, { count: 1 });
			player.emit('plugin:other:ping' as any, { count: 2 });
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('off(Class, event, fn) detaches under namespace', () => {
			const handler = vi.fn();
			plugin.publicOn(OtherPlugin, 'ping', handler);
			plugin.publicOff(OtherPlugin, 'ping', handler);
			player.emit('plugin:other:ping' as any, { count: 5 });
			expect(handler).not.toHaveBeenCalled();
		});

		it('hasListeners(Class, event) checks the namespaced channel', () => {
			expect(plugin.publicHasListeners(OtherPlugin, 'ping')).toBe(false);
			plugin.publicOn(OtherPlugin, 'ping', () => {});
			expect(plugin.publicHasListeners(OtherPlugin, 'ping')).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// emit()
	// ─────────────────────────────────────────────────────────────────────

	describe('emit()', () => {
		it('emits under plugin:<this.id>: namespace', () => {
			const handler = vi.fn();
			player.on('plugin:test:custom' as any, handler);
			plugin.publicEmit('custom', { foo: 'bar' });
			expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
		});

		it('void payload events emit correctly', () => {
			const handler = vi.fn();
			player.on('plugin:test:noop' as any, handler);
			plugin.publicEmit('noop');
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('does NOT emit on the bare event name (always namespaced)', () => {
			const handler = vi.fn();
			player.on('custom' as any, handler);
			plugin.publicEmit('custom', { foo: 'bar' });
			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// throw() / report()
	// ─────────────────────────────────────────────────────────────────────

	describe('throw()', () => {
		it('throws a PlayerError', () => {
			expect(() => plugin.publicThrow({ code: 'plugin:test/boom' })).toThrow(PlayerError);
		});

		it('throw default severity is "error"', () => {
			try {
				plugin.publicThrow({ code: 'plugin:test/boom' });
			}
			catch (e) {
				expect((e as PlayerError).severity).toBe('error');
			}
		});

		it('honors explicit severity', () => {
			try {
				plugin.publicThrow({ code: 'plugin:test/fatal', severity: 'fatal' });
			}
			catch (e) {
				expect((e as PlayerError).severity).toBe('fatal');
			}
		});

		it('emits on the matching severity channel before throwing', () => {
			const handler = vi.fn();
			player.on('error', handler);
			expect(() => plugin.publicThrow({ code: 'plugin:test/boom' })).toThrow();
			expect(handler).toHaveBeenCalled();
			expect((handler.mock.calls[0]![0] as any).error).toBeInstanceOf(PlayerError);
		});

		it('emits on plugin:error for error severity', () => {
			const handler = vi.fn();
			player.on('plugin:error' as any, handler);
			expect(() => plugin.publicThrow({ code: 'plugin:test/boom' })).toThrow();
			expect(handler).toHaveBeenCalled();
		});

		it('thrown error has scope { kind: "plugin", id: <this.id> }', () => {
			try {
				plugin.publicThrow({ code: 'plugin:test/boom' });
			}
			catch (e) {
				expect((e as PlayerError).scope).toEqual({ kind: 'plugin', id: 'test' });
			}
		});

		it('passes context, cause, suggestion through', () => {
			const cause = new Error('inner');
			try {
				plugin.publicThrow({
					code: 'plugin:test/x',
					message: 'human',
					cause,
					context: { url: 'https://x' },
					suggestion: 'try again',
				});
			}
			catch (e) {
				const err = e as PlayerError;
				expect(err.message).toBe('human');
				expect(err.cause).toBe(cause);
				expect(err.context).toEqual({ url: 'https://x' });
				expect(err.suggestion).toBe('try again');
			}
		});
	});

	describe('report()', () => {
		it('does NOT throw', () => {
			expect(() => plugin.publicReport({ code: 'plugin:test/warn' })).not.toThrow();
		});

		it('default severity is "warning"', () => {
			const handler = vi.fn();
			player.on('warning', handler);
			plugin.publicReport({ code: 'plugin:test/warn' });
			expect(handler).toHaveBeenCalled();
		});

		it('emits on plugin:warning for warning severity', () => {
			const handler = vi.fn();
			player.on('plugin:warning' as any, handler);
			plugin.publicReport({ code: 'plugin:test/warn' });
			expect(handler).toHaveBeenCalled();
		});

		it('emits info severity to the info channel', () => {
			const handler = vi.fn();
			player.on('info', handler);
			plugin.publicReport({ code: 'plugin:test/info', severity: 'info' });
			expect(handler).toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// fetch()
	// ─────────────────────────────────────────────────────────────────────

	describe('fetch()', () => {
		let fetchSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 })) as ReturnType<typeof vi.spyOn>;
			// Plugin.fetch reads `(player as any).options?.auth`. StubPlayer doesn't
			// expose options by default; inject it for these tests.
			(player as any).options = { auth: { bearerToken: 'tok' } };
		});

		afterEach(() => {
			fetchSpy.mockRestore();
		});

		it('uses the player options auth', async () => {
			await plugin.publicFetch('https://x/y');
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer tok');
		});

		it('reads the LIVE auth config via auth() — refreshes propagate', async () => {
			// setup-time options.auth says 'old', but auth() returns a refreshed
			// token. Plugin.fetch must use the refreshed one.
			(player as any).options = { auth: { bearerToken: 'old-tok' } };
			(player as any).auth = (): { bearerToken: string } => ({ bearerToken: 'fresh-tok' });
			await plugin.publicFetch('https://x/y');
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer fresh-tok');
		});

		it('falls back to options.auth when auth() is absent or returns undefined', async () => {
			(player as any).options = { auth: { bearerToken: 'setup-tok' } };
			(player as any).auth = (): undefined => undefined;
			await plugin.publicFetch('https://x/y');
			const req = fetchSpy.mock.calls[0]![0] as Request;
			expect(req.headers.get('Authorization')).toBe('Bearer setup-tok');
		});

		it('runs the parser when provided', async () => {
			(fetchSpy as any).mockResolvedValueOnce(new Response('{"x":1}', { status: 200 }));
			const result = await plugin.publicFetch('https://x', { parser: (raw: string) => JSON.parse(raw) });
			expect(result).toEqual({ x: 1 });
		});

		it('default scope is "plugin" → emits on plugin:<id>:fetch:* channel', async () => {
			const events: string[] = [];
			player.on('plugin:test:fetch:start' as any, () => events.push('start'));
			player.on('plugin:test:fetch:complete' as any, () => events.push('complete'));
			await plugin.publicFetch('https://x');
			expect(events).toContain('start');
			expect(events).toContain('complete');
		});

		it('scope: "player" emits on player-global channel', async () => {
			const events: string[] = [];
			player.on('fetch:start' as any, () => events.push('start'));
			await plugin.publicFetch('https://x', { scope: 'player' });
			expect(events).toContain('start');
		});

		it('scope: "silent" emits nothing', async () => {
			const events: string[] = [];
			player.on('fetch:start' as any, () => events.push('player'));
			player.on('plugin:test:fetch:start' as any, () => events.push('plugin'));
			await plugin.publicFetch('https://x', { scope: 'silent' });
			expect(events).toEqual([]);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Plugin.fetch identity injection
	// ─────────────────────────────────────────────────────────────────────

	describe('Plugin.fetch identity injection', () => {
		let fetchSpy: ReturnType<typeof vi.spyOn>;

		beforeEach(() => {
			fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{}', { status: 200 })) as ReturnType<typeof vi.spyOn>;
			(player as any).options = { auth: { bearerToken: 'tok' } };
		});

		afterEach(() => {
			fetchSpy.mockRestore();
		});

		it('always forwards pluginId matching the static id', async () => {
			const emitted: { event: string; data: any }[] = [];
			(player as any).emit = (event: string, data: any) => {
				emitted.push({ event, data });
				(player as any).__originalEmit?.(event, data);
			};
			await plugin.publicFetch('https://x');
			const startEvent = emitted.find(ev => ev.event.startsWith('plugin:test:fetch:'));
			expect(startEvent).toBeDefined();
			expect(emitted.some(ev => ev.event === 'plugin:test:fetch:start')).toBe(true);
		});

		it('always defaults scope to "plugin" regardless of options', async () => {
			const emitted: string[] = [];
			player.on('fetch:start' as any, () => emitted.push('player-global'));
			player.on('plugin:test:fetch:start' as any, () => emitted.push('plugin-scoped'));
			await plugin.publicFetch('https://x');
			expect(emitted).toContain('plugin-scoped');
			expect(emitted).not.toContain('player-global');
		});

		it('forwards responseType: json to authFetch', async () => {
			(fetchSpy as any).mockResolvedValueOnce(new Response('{"z":9}', { status: 200 }));
			const result = await plugin.publicFetch('https://x', { responseType: 'json' });
			expect(result).toEqual({ z: 9 });
		});

		it('forwards responseType: arrayBuffer to authFetch', async () => {
			const buf = new Uint8Array([10, 20]).buffer;
			(fetchSpy as any).mockResolvedValueOnce(new Response(buf, { status: 200 }));
			const result = await plugin.publicFetch('https://x', { responseType: 'arrayBuffer' });
			expect(result).toBeInstanceOf(ArrayBuffer);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Lifecycle delegates
	// ─────────────────────────────────────────────────────────────────────

	describe('lifecycle delegates', () => {
		it('listen() registers via lifecycle.listen', () => {
			const target = new EventTarget();
			const handler = vi.fn();
			plugin.publicListen(target, 'click', handler);
			target.dispatchEvent(new Event('click'));
			expect(handler).toHaveBeenCalled();
			lifecycle.dispose();
			target.dispatchEvent(new Event('click'));
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('timeout() returns a defined id (browser: number; Node/happy-dom: Timeout object)', () => {
			const id = plugin.publicTimeout(() => {}, 100);
			expect(id).toBeDefined();
			expect(id).not.toBe(-1);
		});

		it('interval() returns a defined id (browser: number; Node/happy-dom: Timeout object)', () => {
			const id = plugin.publicInterval(() => {}, 100);
			expect(id).toBeDefined();
			expect(id).not.toBe(-1);
		});

		it('abortable() returns an AbortController', () => {
			const ctrl = plugin.publicAbortable();
			expect(ctrl).toBeInstanceOf(AbortController);
		});

		it('abortable() controllers are aborted on lifecycle dispose', () => {
			const ctrl = plugin.publicAbortable();
			lifecycle.dispose();
			expect(ctrl.signal.aborted).toBe(true);
		});

		it('frame() does not throw', () => {
			expect(() => plugin.publicFrame(() => {})).not.toThrow();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// mount()
	// ─────────────────────────────────────────────────────────────────────

	describe('mount()', () => {
		it('returns a div appended to the player container', () => {
			const div = plugin.publicMount('toast');
			expect(div).toBeInstanceOf(HTMLDivElement);
			expect(player.container.contains(div)).toBe(true);
		});

		it('namespaces the className as nmplayer-<plugin-id>-<name>', () => {
			const div = plugin.publicMount('toast');
			expect(div.className).toBe('nmplayer-test-toast');
		});

		it('idempotent: same name returns the SAME element', () => {
			const a = plugin.publicMount('toast');
			const b = plugin.publicMount('toast');
			expect(a).toBe(b);
		});

		it('different names return different elements', () => {
			const a = plugin.publicMount('toast');
			const b = plugin.publicMount('overlay');
			expect(a).not.toBe(b);
		});

		it('mount nodes auto-removed on lifecycle dispose', () => {
			const div = plugin.publicMount('toast');
			expect(player.container.contains(div)).toBe(true);
			lifecycle.dispose();
			expect(player.container.contains(div)).toBe(false);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// t() — i18n delegate
	// ─────────────────────────────────────────────────────────────────────

	describe('t()', () => {
		it('namespaces the key under plugin.<id>.', () => {
			player.translation('en', 'plugin.test.greeting', 'Hello');
			expect(plugin.publicT('greeting')).toBe('Hello');
		});

		it('falls through to the namespaced key when missing (player default)', () => {
			expect(plugin.publicT('missing')).toBe('plugin.test.missing');
		});

		it('returns namespaced key when player exposes no t()', () => {
			const playerWithoutT = { ...player, t: undefined } as any;
			(plugin as any).player = playerWithoutT;
			expect(plugin.publicT('greeting')).toBe('plugin.test.greeting');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// websocket()
	// ─────────────────────────────────────────────────────────────────────

	describe('websocket()', () => {
		let originalWS: typeof WebSocket;

		beforeEach(() => {
			originalWS = globalThis.WebSocket;
			class FakeWS extends EventTarget {
				static OPEN = 1;
				static CLOSED = 3;
				readyState = 0;
				close = vi.fn();
				send = vi.fn();
			}
			globalThis.WebSocket = FakeWS as unknown as typeof WebSocket;
		});

		afterEach(() => {
			globalThis.WebSocket = originalWS;
		});

		it('returns an IRealtimeChannel', () => {
			const ch = plugin.publicWebsocket('wss://x') as any;
			expect(typeof ch.send).toBe('function');
			expect(typeof ch.close).toBe('function');
			expect(typeof ch.on).toBe('function');
			expect(typeof ch.off).toBe('function');
		});

		it('uses per-call factory override when provided', () => {
			const fakeChannel = { send: vi.fn(), close: vi.fn(), on: vi.fn(), off: vi.fn(), readyState: 'open' as const };
			const factory = vi.fn(() => fakeChannel);
			const ch = (plugin.publicWebsocket as any)('wss://x', { factory });
			expect(ch).toBe(fakeChannel);
			expect(factory).toHaveBeenCalled();
		});

		it('uses player.options.websocketFactory when no per-call factory', () => {
			const fakeChannel = { send: vi.fn(), close: vi.fn(), on: vi.fn(), off: vi.fn(), readyState: 'open' as const };
			const factory = vi.fn(() => fakeChannel);
			(player as any).options = { websocketFactory: factory };
			const ch = plugin.publicWebsocket('wss://x');
			expect(ch).toBe(fakeChannel);
		});

		it('auto-closes on lifecycle dispose', () => {
			const close = vi.fn();
			const fakeChannel = { send: vi.fn(), close, on: vi.fn(), off: vi.fn(), readyState: 'open' as const };
			const factory = vi.fn(() => fakeChannel);
			(plugin.publicWebsocket as any)('wss://x', { factory });
			lifecycle.dispose();
			expect(close).toHaveBeenCalled();
		});

		it('does NOT call close() on a channel already in closing/closed state', () => {
			const close = vi.fn();
			const fakeChannel = { send: vi.fn(), close, on: vi.fn(), off: vi.fn(), readyState: 'closed' as const };
			const factory = vi.fn(() => fakeChannel);
			(plugin.publicWebsocket as any)('wss://x', { factory });
			lifecycle.dispose();
			expect(close).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// dispatchBefore() — BeforeEvent contract
	// ─────────────────────────────────────────────────────────────────────

	describe('dispatchBefore()', () => {
		it('returns { data, prevented: false } when no listeners and no prevention', async () => {
			const result = await plugin.publicDispatchBefore('beforeFoo', { x: 1 });
			expect(result.prevented).toBe(false);
			expect(result.data).toEqual({ x: 1 });
		});

		it('listeners receive a BeforeEvent with mutable data', async () => {
			let received: any;
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				received = e;
			});
			await plugin.publicDispatchBefore('beforeFoo', { x: 1 });
			expect(received.data).toEqual({ x: 1 });
			expect(typeof received.preventDefault).toBe('function');
			expect(typeof received.delay).toBe('function');
		});

		it('listener mutating e.data is reflected in result', async () => {
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.data = { x: 99 };
			});
			const result = await plugin.publicDispatchBefore('beforeFoo', { x: 1 });
			expect(result.data).toEqual({ x: 99 });
		});

		it('preventDefault sets prevented=true with reason listener-prevented', async () => {
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.preventDefault();
			});
			const result = await plugin.publicDispatchBefore('beforeFoo', { x: 1 });
			expect(result.prevented).toBe(true);
			expect(result.reason).toBe('listener-prevented');
		});

		it('stopImmediatePropagation skips remaining listeners', async () => {
			const second = vi.fn();
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.stopImmediatePropagation();
			});
			player.on('plugin:test:beforeFoo' as any, second);
			await plugin.publicDispatchBefore('beforeFoo', {});
			expect(second).not.toHaveBeenCalled();
		});

		it('stopImmediatePropagation does NOT prevent default by itself', async () => {
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.stopImmediatePropagation();
			});
			const result = await plugin.publicDispatchBefore('beforeFoo', {});
			expect(result.prevented).toBe(false);
		});

		it('delay(promise) waits for the promise to settle before resolving', async () => {
			let resolveDelay: (() => void) | undefined;
			const delayed = new Promise<void>((r) => { resolveDelay = r; });
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.delay(delayed);
			});

			let dispatchResolved = false;
			const promise = plugin.publicDispatchBefore('beforeFoo', {}).then(() => {
				dispatchResolved = true;
			});
			await new Promise(r => setTimeout(r, 5));
			expect(dispatchResolved).toBe(false);
			resolveDelay!();
			await promise;
			expect(dispatchResolved).toBe(true);
		});

		it('multiple delay() promises compose via Promise.all', async () => {
			const promises = [Promise.resolve(), Promise.resolve(), Promise.resolve()];
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				promises.forEach(p => e.delay(p));
			});
			const result = await plugin.publicDispatchBefore('beforeFoo', {});
			expect(result.prevented).toBe(false);
		});

		it('rejected delay promise becomes prevented with reason delay-rejected', async () => {
			const cause = new Error('async fail');
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.delay(Promise.reject(cause));
			});
			const result = await plugin.publicDispatchBefore('beforeFoo', {});
			expect(result.prevented).toBe(true);
			expect(result.reason).toBe('delay-rejected');
			expect(result.cause).toBe(cause);
		});

		it('delay timeout becomes prevented with reason delay-timeout', async () => {
			const neverResolves = new Promise<void>(() => {});
			player.on('plugin:test:beforeFoo' as any, (e: any) => {
				e.delay(neverResolves);
			});
			const result = await plugin.publicDispatchBefore('beforeFoo', {}, { timeoutMs: 20 });
			expect(result.prevented).toBe(true);
			expect(result.reason).toBe('delay-timeout');
		});

		it('pushes namespaced event onto player.dispatching() during dispatch', async () => {
			let stack: ReadonlyArray<string> = [];
			player.on('plugin:test:beforeFoo' as any, () => {
				stack = player.dispatching();
			});
			await plugin.publicDispatchBefore('beforeFoo', {});
			expect(stack).toContain('plugin:test:beforeFoo');
		});

		it('pops dispatching stack after dispatch completes', async () => {
			player.on('plugin:test:beforeFoo' as any, () => {});
			await plugin.publicDispatchBefore('beforeFoo', {});
			expect(player.dispatching()).toEqual([]);
		});

		it('pops dispatching stack even when listener throws', async () => {
			player.on('plugin:test:beforeFoo' as any, () => { throw new Error('boom'); });
			await plugin.publicDispatchBefore('beforeFoo', {});
			expect(player.dispatching()).toEqual([]);
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Static helpers stubs
	// ─────────────────────────────────────────────────────────────────────

	describe('static derive / clone / export (real impl)', () => {
		it('derive() bakes opts into a subclass; consumer-supplied opts override at initialize()', () => {
			const Derived = TestPlugin.derive({ value: 99 });
			const inst = new Derived();
			const lifecycle = new LifecycleRegistry();
			// No consumer opts → derive defaults flow through
			inst.initialize(player, undefined as any, lifecycle);
			expect((inst as any).opts.value).toBe(99);
			// Consumer opts override the bake
			const inst2 = new Derived();
			inst2.initialize(player, { value: 7 } as any, new LifecycleRegistry());
			expect((inst2 as any).opts.value).toBe(7);
		});

		it('derive(opts, newId) overrides static id', () => {
			const Renamed = TestPlugin.derive({ value: 1 }, 'renamed-test');
			expect((Renamed as any).id).toBe('renamed-test');
		});

		it('clone() returns a derived class with current state baked in', () => {
			plugin.options({ mode: 'cloned' });
			const Clone = plugin.clone();
			const inst = new (Clone as any)();
			inst.initialize(player, undefined, new LifecycleRegistry());
			expect((inst as any).opts.mode).toBe('cloned');
		});

		it('export() returns a serializable JSON snapshot of opts', () => {
			plugin.options({ mode: 'exported' });
			const out = plugin.export();
			expect(out).toEqual({ value: 10, mode: 'exported' });
			// Round-trip through JSON.stringify proves serializability.
			expect(JSON.parse(JSON.stringify(out))).toEqual({ value: 10, mode: 'exported' });
		});
	});

	describe('static onError recovery map', () => {
		it('\'disable\' action calls this.disable() with reason including the error code', () => {
			class DisableOnErrorPlugin extends Plugin<StubPlayer, Options> {
				static override readonly id: string = 'disable-on-error';
				static override readonly version: string = '1.0.0';
				static override readonly description: string = 'Test plugin';
				static override readonly onError = {
					'disable-on-error:load/failed': 'disable',
				} as const;

				override use(): void {}
				publicReport(payload: any): void { this.report(payload); }
			}

			const inst = new DisableOnErrorPlugin();
			inst.initialize(player, { value: 1 }, new LifecycleRegistry());
			expect(inst.enabled()).toBe(true);

			inst.publicReport({ code: 'disable-on-error:load/failed', severity: 'error' });

			expect(inst.enabled()).toBe(false);
		});

		it('\'ignore\' action does nothing beyond emitting the error event', () => {
			class IgnoreOnErrorPlugin extends Plugin<StubPlayer, Options> {
				static override readonly id: string = 'ignore-on-error';
				static override readonly version: string = '1.0.0';
				static override readonly description: string = 'Test plugin';
				static override readonly onError = {
					'ignore-on-error:load/failed': 'ignore',
				} as const;

				override use(): void {}
				publicReport(payload: any): void { this.report(payload); }
			}

			const inst = new IgnoreOnErrorPlugin();
			inst.initialize(player, { value: 1 }, new LifecycleRegistry());
			const errors: unknown[] = [];
			player.on('error', e => errors.push(e));

			inst.publicReport({ code: 'ignore-on-error:load/failed', severity: 'error' });

			expect(inst.enabled()).toBe(true);
			expect(errors).toHaveLength(1);
		});

		it('\'retry-once\' calls retryLastOperation() if defined', () => {
			const retryCalled: string[] = [];

			class RetryOnErrorPlugin extends Plugin<StubPlayer, Options> {
				static override readonly id: string = 'retry-on-error';
				static override readonly version: string = '1.0.0';
				static override readonly description: string = 'Test plugin';
				static override readonly onError = {
					'retry-on-error:load/failed': 'retry-once',
				} as const;

				override use(): void {}
				retryLastOperation(): void {
					retryCalled.push('retry');
				}

				publicReport(payload: any): void { this.report(payload); }
			}

			const inst = new RetryOnErrorPlugin();
			inst.initialize(player, { value: 1 }, new LifecycleRegistry());

			inst.publicReport({ code: 'retry-on-error:load/failed', severity: 'error' });

			expect(retryCalled).toEqual(['retry']);
		});

		it('\'fallback\' calls activateFallback() if defined', () => {
			const fallbackCalled: string[] = [];

			class FallbackOnErrorPlugin extends Plugin<StubPlayer, Options> {
				static override readonly id: string = 'fallback-on-error';
				static override readonly version: string = '1.0.0';
				static override readonly description: string = 'Test plugin';
				static override readonly onError = {
					'fallback-on-error:load/failed': 'fallback',
				} as const;

				override use(): void {}
				activateFallback(): void {
					fallbackCalled.push('fallback');
				}

				publicReport(payload: any): void { this.report(payload); }
			}

			const inst = new FallbackOnErrorPlugin();
			inst.initialize(player, { value: 1 }, new LifecycleRegistry());

			inst.publicReport({ code: 'fallback-on-error:load/failed', severity: 'error' });

			expect(fallbackCalled).toEqual(['fallback']);
		});

		it('does nothing when error code has no entry in onError', () => {
			class NoMatchPlugin extends Plugin<StubPlayer, Options> {
				static override readonly id: string = 'no-match';
				static override readonly version: string = '1.0.0';
				static override readonly description: string = 'Test plugin';
				static override readonly onError = {
					'no-match:other/code': 'disable',
				} as const;

				override use(): void {}
				publicReport(payload: any): void { this.report(payload); }
			}

			const inst = new NoMatchPlugin();
			inst.initialize(player, { value: 1 }, new LifecycleRegistry());

			inst.publicReport({ code: 'no-match:load/failed', severity: 'error' });

			expect(inst.enabled()).toBe(true);
		});
	});
});
