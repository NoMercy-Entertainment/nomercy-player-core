// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `EmbedPlugin`.
 *
 * The existing embed-and-tab-leader.test.ts covers: inIframe() JSDOM result,
 * isOriginAllowed() accept/reject, formatEvent('play'), applyIframeTweaks,
 * formatEvent('error') structuredClone safety, non-error events structuredClone.
 *
 * This file covers the remaining ~43 uncovered lines:
 *  - handleCommand() for each action: play/pause/stop/seek/volume/mute/unmute/next/previous
 *  - handleCommand() with unknown action logs a warning
 *  - options(partial) runtime update of allowedOrigins live filter
 *  - allowedOrigins() getter and setter
 *  - sendToHost() posts to window.parent with correct target origin
 *  - inbound message dispatching (message event) calls handleCommand when origin is allowed
 *  - inbound message is rejected when origin is not in allow list
 *  - inbound message is ignored when type is not nm:command
 *  - player event forwarding: player.emit('play') → window.parent.postMessage
 *  - dispose() removes all forwarded event listeners
 *  - opts.forwardEvents customises which events are forwarded
 *  - isOriginAllowed with wildcard '*' accepts any origin
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

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string { return this.playerId; }

	declare options: (config?: unknown) => unknown;
	declare setup: (config: unknown) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare addPlugin: (PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: <P extends object>(PluginClass: { id: string; new(): P }) => P | undefined;
	declare getPluginById: <P extends object = object>(id: string) => P | undefined;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare t: (key: string, vars?: Record<string, string>) => string;
	declare time: { (): number; (t: number, opts?: unknown): Promise<void> };
	declare volume: { (): number; (v: number): void };
	declare experimental: unknown;

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayer' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing')
			return resolved.instance as unknown as this;
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _reset(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function makePlayer(divId: string): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId);
}

// ─── window.parent stub ───────────────────────────────────────────────────────

function stubWindowParent(): { postMessage: ReturnType<typeof vi.fn>; restore: () => void } {
	const postMessageFn = vi.fn();
	const fakeParent = { postMessage: postMessageFn };
	const original = Object.getOwnPropertyDescriptor(window, 'parent');
	Object.defineProperty(window, 'parent', {
		configurable: true,
		get: () => fakeParent,
	});
	return {
		postMessage: postMessageFn,
		restore() {
			if (original) {
				Object.defineProperty(window, 'parent', original);
			}
		},
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EmbedPlugin — deep behavioral coverage', () => {
	beforeEach(() => MockPlayer._reset());
	afterEach(() => {
		MockPlayer._reset();
		document.body.innerHTML = '';
	});

	// ── handleCommand() ───────────────────────────────────────────────────────

	describe('handleCommand()', () => {
		it('play action calls player.play()', async () => {
			const mockPlayer = makePlayer('embed-hc-play').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: ['https://host.example.com'] });
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const playCalls: unknown[] = [];
			mockPlayer.play = vi.fn(async (opts) => { playCalls.push(opts); });

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'play',
			});

			expect(playCalls).toHaveLength(1);
			expect((playCalls[0] as { source: string }).source).toBe('embed');
		});

		it('pause action calls player.pause()', async () => {
			const mockPlayer = makePlayer('embed-hc-pause').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const pauseCalls: unknown[] = [];
			mockPlayer.pause = vi.fn(async (opts) => { pauseCalls.push(opts); });

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'pause',
			});

			expect(pauseCalls).toHaveLength(1);
		});

		it('stop action calls player.stop()', async () => {
			const mockPlayer = makePlayer('embed-hc-stop').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const stopCalls: unknown[] = [];
			mockPlayer.stop = vi.fn(async (opts) => { stopCalls.push(opts); });

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'stop',
			});

			expect(stopCalls).toHaveLength(1);
		});

		it('seek action calls player.time()', async () => {
			const mockPlayer = makePlayer('embed-hc-seek').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const timeCalls: number[] = [];
			(mockPlayer as unknown as { time: (t: number) => void }).time = (t: number) => { timeCalls.push(t); };

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'seek',
				time: 45,
			});

			expect(timeCalls).toHaveLength(1);
			expect(timeCalls[0]).toBe(45);
		});

		it('volume action calls player.volume()', async () => {
			const mockPlayer = makePlayer('embed-hc-volume').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const volumeCalls: number[] = [];
			(mockPlayer as unknown as { volume: (v: number) => void }).volume = (v: number) => { volumeCalls.push(v); };

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'volume',
				level: 75,
			});

			expect(volumeCalls).toHaveLength(1);
			expect(volumeCalls[0]).toBe(75);
		});

		it('mute action calls player.mute()', async () => {
			const mockPlayer = makePlayer('embed-hc-mute').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const muteCalls: unknown[] = [];
			(mockPlayer as MockPlayer & { mute: () => void }).mute = () => { muteCalls.push(true); };

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'mute',
			});

			expect(muteCalls).toHaveLength(1);
		});

		it('unmute action calls player.unmute()', async () => {
			const mockPlayer = makePlayer('embed-hc-unmute').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const unmuteCalls: unknown[] = [];
			(mockPlayer as MockPlayer & { unmute: () => void }).unmute = () => { unmuteCalls.push(true); };

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'unmute',
			});

			expect(unmuteCalls).toHaveLength(1);
		});

		it('next action calls player.next()', async () => {
			const mockPlayer = makePlayer('embed-hc-next').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const nextCalls: unknown[] = [];
			(mockPlayer as MockPlayer & { next: (opts?: unknown) => Promise<void> }).next = async (opts) => { nextCalls.push(opts); };

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'next',
			});

			expect(nextCalls).toHaveLength(1);
		});

		it('previous action calls player.previous()', async () => {
			const mockPlayer = makePlayer('embed-hc-prev').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const prevCalls: unknown[] = [];
			(mockPlayer as MockPlayer & { previous: (opts?: unknown) => Promise<void> }).previous = async (opts) => { prevCalls.push(opts); };

			(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
				type: 'nm:command',
				action: 'previous',
			});

			expect(prevCalls).toHaveLength(1);
		});

		it('unknown action does not throw', async () => {
			const mockPlayer = makePlayer('embed-hc-unknown').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			expect(() => {
				(inst as unknown as { handleCommand: (cmd: unknown) => void }).handleCommand({
					type: 'nm:command',
					action: 'fly-to-the-moon',
				});
			}).not.toThrow();
		});
	});

	// ── options() live update ─────────────────────────────────────────────────

	describe('options() live update', () => {
		it('options({ allowedOrigins }) immediately updates the live origin filter', async () => {
			const mockPlayer = makePlayer('embed-opts-1').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: ['https://old.example.com'] });
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://old.example.com')).toBe(true);

			inst.options({ allowedOrigins: ['https://new.example.com'] });

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://old.example.com')).toBe(false);
			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://new.example.com')).toBe(true);
		});

		it('options({ allowedOrigins: "*" }) accepts any origin', async () => {
			const mockPlayer = makePlayer('embed-opts-2').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			inst.options({ allowedOrigins: '*' });

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://any.origin.com')).toBe(true);
		});
	});

	// ── allowedOrigins() getter/setter ────────────────────────────────────────

	describe('allowedOrigins()', () => {
		it('getter returns current allowlist snapshot', async () => {
			const mockPlayer = makePlayer('embed-ao-1').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: ['https://a.com', 'https://b.com'] });
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const list = inst.allowedOrigins();
			expect(list).toEqual(['https://a.com', 'https://b.com']);
		});

		it('getter returns a snapshot — mutating it does not affect live list', async () => {
			const mockPlayer = makePlayer('embed-ao-2').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: ['https://a.com'] });
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			const list = inst.allowedOrigins() as string[];
			list.push('https://evil.com');

			expect(inst.allowedOrigins()).not.toContain('https://evil.com');
		});

		it('setter(array) replaces the allowlist', async () => {
			const mockPlayer = makePlayer('embed-ao-3').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			inst.allowedOrigins(['https://replaced.com']);

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://replaced.com')).toBe(true);
		});

		it('setter(string) wraps in array', async () => {
			const mockPlayer = makePlayer('embed-ao-4').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			inst.allowedOrigins('https://single.com');

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://single.com')).toBe(true);
		});
	});

	// ── isOriginAllowed ────────────────────────────────────────────────────────

	describe('isOriginAllowed()', () => {
		it('empty allowlist rejects all origins', async () => {
			const mockPlayer = makePlayer('embed-ioa-1').setup({});
			mockPlayer.addPlugin(EmbedPlugin);
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://anything.com')).toBe(false);
		});

		it('"*" in list accepts any origin', async () => {
			const mockPlayer = makePlayer('embed-ioa-2').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: '*' });
			await mockPlayer.ready();
			const inst = mockPlayer.getPlugin(EmbedPlugin)!;

			expect((inst as unknown as { isOriginAllowed: (o: string) => boolean }).isOriginAllowed('https://random.com')).toBe(true);
		});
	});

	// ── sendToHost() ──────────────────────────────────────────────────────────

	describe('sendToHost()', () => {
		it('posts message to window.parent with pinned origin when one origin is in list', async () => {
			const stub = stubWindowParent();
			try {
				const mockPlayer = makePlayer('embed-send-1').setup({});
				mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: 'https://host.example.com' });
				await mockPlayer.ready();
				const inst = mockPlayer.getPlugin(EmbedPlugin)!;

				inst.sendToHost({ type: 'nm:event', name: 'play', data: {} });

				expect(stub.postMessage).toHaveBeenCalledWith(
					{ type: 'nm:event', name: 'play', data: {} },
					'https://host.example.com',
				);
			}
			finally {
				stub.restore();
			}
		});

		it('uses "*" as target when multiple origins are listed', async () => {
			const stub = stubWindowParent();
			try {
				const mockPlayer = makePlayer('embed-send-2').setup({});
				mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: ['https://a.com', 'https://b.com'] });
				await mockPlayer.ready();
				const inst = mockPlayer.getPlugin(EmbedPlugin)!;

				inst.sendToHost({ type: 'nm:event', name: 'play', data: {} });

				expect(stub.postMessage).toHaveBeenCalledWith(
					expect.anything(),
					'*',
				);
			}
			finally {
				stub.restore();
			}
		});
	});

	// ── inbound message dispatching ────────────────────────────────────────────

	describe('inbound message dispatching', () => {
		it('message from allowed origin with nm:command type dispatches handleCommand', async () => {
			const mockPlayer = makePlayer('embed-msg-1').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: 'https://trusted.com' });
			await mockPlayer.ready();

			const playCalls: unknown[] = [];
			mockPlayer.play = vi.fn(async (opts) => { playCalls.push(opts); });

			const event = new MessageEvent('message', {
				data: { type: 'nm:command', action: 'play' },
				origin: 'https://trusted.com',
			});
			window.dispatchEvent(event);

			expect(playCalls).toHaveLength(1);
		});

		it('message from disallowed origin is rejected', async () => {
			const mockPlayer = makePlayer('embed-msg-2').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: 'https://trusted.com' });
			await mockPlayer.ready();

			const playCalls: unknown[] = [];
			mockPlayer.play = vi.fn(async (opts) => { playCalls.push(opts); });

			const event = new MessageEvent('message', {
				data: { type: 'nm:command', action: 'play' },
				origin: 'https://evil.com',
			});
			window.dispatchEvent(event);

			expect(playCalls).toHaveLength(0);
		});

		it('message with wrong type is ignored', async () => {
			const mockPlayer = makePlayer('embed-msg-3').setup({});
			mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: '*' });
			await mockPlayer.ready();

			const playCalls: unknown[] = [];
			mockPlayer.play = vi.fn(async (opts) => { playCalls.push(opts); });

			const event = new MessageEvent('message', {
				data: { type: 'nm:other', action: 'play' },
				origin: 'https://any.com',
			});
			window.dispatchEvent(event);

			expect(playCalls).toHaveLength(0);
		});
	});

	// ── player event forwarding ───────────────────────────────────────────────

	describe('player event forwarding', () => {
		it('player.emit("play") posts nm:event to window.parent', async () => {
			const stub = stubWindowParent();
			try {
				const mockPlayer = makePlayer('embed-fwd-1').setup({});
				mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: 'https://host.example.com' });
				await mockPlayer.ready();

				(mockPlayer as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('play', { source: 'user' });

				expect(stub.postMessage).toHaveBeenCalledWith(
					expect.objectContaining({ type: 'nm:event', name: 'play' }),
					'https://host.example.com',
				);
			}
			finally {
				stub.restore();
			}
		});

		it('opts.forwardEvents limits which events are forwarded', async () => {
			const stub = stubWindowParent();
			try {
				const mockPlayer = makePlayer('embed-fwd-2').setup({});
				mockPlayer.addPlugin(EmbedPlugin, {
					allowedOrigins: 'https://host.example.com',
					forwardEvents: ['play'],
				});
				await mockPlayer.ready();

				(mockPlayer as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('pause', {});
				expect(stub.postMessage).not.toHaveBeenCalled();

				(mockPlayer as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('play', {});
				expect(stub.postMessage).toHaveBeenCalledOnce();
			}
			finally {
				stub.restore();
			}
		});
	});

	// ── dispose() ────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('removes forwarded event listeners so player events no longer post messages', async () => {
			const stub = stubWindowParent();
			try {
				const mockPlayer = makePlayer('embed-dispose-1').setup({});
				mockPlayer.addPlugin(EmbedPlugin, { allowedOrigins: 'https://host.example.com' });
				await mockPlayer.ready();

				mockPlayer.removePlugin(EmbedPlugin);

				// Reset call count — ready event was forwarded during p.ready() above.
				stub.postMessage.mockClear();

				(mockPlayer as MockPlayer & { emit: (e: string, d: unknown) => void }).emit('play', {});
				expect(stub.postMessage).not.toHaveBeenCalled();
			}
			finally {
				stub.restore();
			}
		});
	});
});
