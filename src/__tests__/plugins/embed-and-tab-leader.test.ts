/**
 * Smoke tests for the EmbedPlugin and TabLeaderPlugin pure helpers.
 * Mirrors the conventions in `tier1-features.test.ts` — self-contained
 * MockPlayer built on the kit's shared mixins.
 */

import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { EmbedPlugin } from '../../plugins/embed';
import { TabLeaderPlugin } from '../../plugins/tab-leader';

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
	declare phase: () => string;
	declare addPlugin: (PluginClass: any, opts?: any) => this;
	declare getPlugin: <P extends object>(PluginClass: { id: string; new(): P }) => P | undefined;
	declare getPluginById: <P extends object = object>(id: string) => P | undefined;
	declare removePlugin: (PluginClass: any) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<any>;
	declare enabledPlugins: () => ReadonlyArray<any>;
	declare play: (opts?: any) => Promise<void>;
	declare pause: (opts?: any) => Promise<void>;
	declare stop: (opts?: any) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare currentTime: { (): number; (t: number, opts?: any): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: any;

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

describe('EmbedPlugin and TabLeaderPlugin', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('EmbedPlugin', () => {
		it('inIframe() returns false in JSDOM (window.top === window.self)', async () => {
			const p = makePlayer('embed-1').setup({});
			p.addPlugin(EmbedPlugin);
			await p.ready();
			const inst = p.getPluginById<EmbedPlugin>('embed')!;
			expect((inst as any).inIframe()).toBe(false);
		});

		it('isOriginAllowed() rejects origins not in the list', async () => {
			const p = makePlayer('embed-2').setup({});
			p.addPlugin(EmbedPlugin, { allowedOrigins: ['https://trusted.example.com'] });
			await p.ready();
			const inst = p.getPluginById<EmbedPlugin>('embed')!;
			// Surface the internal allow-list so the helper has data to compare against.
			inst.allowedOrigins(['https://trusted.example.com']);
			expect((inst as any).isOriginAllowed('https://trusted.example.com')).toBe(true);
			expect((inst as any).isOriginAllowed('https://evil.example.com')).toBe(false);
			expect((inst as any).isOriginAllowed('')).toBe(false);
		});

		it('formatEvent("play", {}) returns { type: "nm:event", name: "play", data: {} }', async () => {
			const p = makePlayer('embed-3').setup({});
			p.addPlugin(EmbedPlugin);
			await p.ready();
			const inst = p.getPluginById<EmbedPlugin>('embed')!;
			const msg = (inst as any).formatEvent('play', {});
			expect(msg).toEqual({ type: 'nm:event', name: 'play', data: {} });
		});
	});

	describe('TabLeaderPlugin', () => {
		it('isLeader() returns a boolean (Web Locks may or may not be available in JSDOM)', async () => {
			const p = makePlayer('lock-1').setup({});
			p.addPlugin(TabLeaderPlugin);
			await p.ready();
			const inst = p.getPluginById<TabLeaderPlugin>('tab-leader')!;
			expect(typeof inst.isLeader()).toBe('boolean');
		});

		it('getLockKey() returns the default "nomercy-player-leader"', async () => {
			const p = makePlayer('lock-2').setup({});
			p.addPlugin(TabLeaderPlugin);
			await p.ready();
			const inst = p.getPluginById<TabLeaderPlugin>('tab-leader')!;
			expect((inst as any).getLockKey()).toBe('nomercy-player-leader');
		});

		it('getLockKey() returns the custom key from opts.getLockKey when provided', async () => {
			const p = makePlayer('lock-3').setup({});
			p.addPlugin(TabLeaderPlugin, { getLockKey: () => 'custom-key' });
			await p.ready();
			const inst = p.getPluginById<TabLeaderPlugin>('tab-leader')!;
			expect((inst as any).getLockKey()).toBe('custom-key');
		});

		it('onLost reads the LIVE opts — changing onLost after use() takes effect on the next leader-lost', async () => {
			// JSDOM lacks Web Locks — stub navigator.locks so use() doesn't bail early.
			const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks');
			const lockRequestFn = vi.fn((_key: string, cb: (lock: unknown) => Promise<void>) =>
				cb({}).then(() => {}));
			Object.defineProperty(navigator, 'locks', {
				configurable: true,
				get: () => ({ request: lockRequestFn }),
			});

			const p = makePlayer('lock-4').setup({});

			// Inject own-property transport stubs BEFORE addPlugin so use() sees them.
			const pauseCalls: unknown[] = [];
			const muteCalls: unknown[] = [];
			Object.defineProperty(p, 'pause', { value: (): void => { pauseCalls.push(true); }, configurable: true, writable: true });
			Object.defineProperty(p, 'mute', { value: (): void => { muteCalls.push(true); }, configurable: true, writable: true });

			p.addPlugin(TabLeaderPlugin, { onLost: 'pause' });
			await p.ready();
			const inst = p.getPluginById<TabLeaderPlugin>('tab-leader')!;

			// Restore navigator.locks after setup.
			if (originalLocks) {
				Object.defineProperty(navigator, 'locks', originalLocks);
			}
			else {
				// @ts-expect-error — deleting a property from navigator for cleanup
				delete (navigator as Record<string, unknown>).locks;
			}

			// Simulate losing leadership with current opt = 'pause'
			p.emit('plugin:tab-leader:leader-lost' as any, { reason: 'request' });
			expect(pauseCalls).toHaveLength(1);
			expect(muteCalls).toHaveLength(0);

			// Mutate opt to 'mute' and simulate losing again
			inst.options({ onLost: 'mute' });
			p.emit('plugin:tab-leader:leader-lost' as any, { reason: 'request' });
			expect(muteCalls).toHaveLength(1);
			expect(pauseCalls).toHaveLength(1);
		});
	});
});
