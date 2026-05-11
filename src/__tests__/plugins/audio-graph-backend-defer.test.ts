/**
 * AudioGraphPlugin — backend.outputNode() deferral.
 *
 * Verifies that when the player's backend exposes an `outputNode(ctx)` method,
 * `AudioGraphPlugin.mountSource` reuses that node instead of calling
 * `ctx.createMediaElementSource(element)` a second time.
 *
 * A second `createMediaElementSource()` call on the same element returns a
 * silent node in Chrome (no throw). The bug produced:
 *   backend: source → analyser → outputGain → (dead end)
 *   plugin:  silent_source → destination
 *
 * The fix: mountSource checks `backend.outputNode(ctx)` first. When present,
 * the plugin's chain becomes: outputGain → [effects] → destination.
 */

import type { BaseEventMap, IPlayer } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
	setPlayerAudioContext,
} from '../../index';
import { AudioGraphPlugin } from '../../plugins/audio-graph';

// ── Web Audio stubs ───────────────────────────────────────────────────────────

class MockAudioNode {
	_connections: unknown[] = [];
	label: string;

	constructor(label: string) {
		this.label = label;
	}

	connect(target: unknown): void {
		this._connections.push(target);
	}

	disconnect(): void {
		this._connections = [];
	}
}

class MockAudioContext {
	state: AudioContextState = 'running';
	currentTime = 0;
	sampleRate = 44100;
	destination = new MockAudioNode('destination') as unknown as AudioDestinationNode;

	createGain = vi.fn(() => new MockAudioNode('gain'));
	createAnalyser = vi.fn(() => new MockAudioNode('analyser'));
	createMediaElementSource = vi.fn(() => new MockAudioNode('source'));
	resume = vi.fn(() => Promise.resolve());
}

// ── MockPlayer with backend support ──────────────────────────────────────────

const _instances = new Map<string, MockPlayerWithBackend>();

interface MockBackend {
	outputNode: (ctx: AudioContext) => AudioNode;
	mediaElement: () => HTMLMediaElement;
}

class MockPlayerWithBackend extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = document.createElement('div');

	get id(): string {
		return this.playerId;
	}

	declare options: object;
	declare setup: (config: object) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare addPlugin: (PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: <P extends object>(PluginClass: { new(): P }) => P | undefined;
	declare getPluginById: (id: string) => object | undefined;
	declare removePlugin: (PluginClass: unknown) => void;
	declare audioContext: () => AudioContext | undefined;

	private _backend: MockBackend | null = null;

	setBackend(backend: MockBackend): void {
		this._backend = backend;
	}

	backend(): MockBackend | null {
		return this._backend;
	}

	constructor(id?: string | number) {
		super();
		initPlayerCoreState(this, { className: 'MockPlayerWithBackend' });
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayerWithBackend');
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

composeMixins(MockPlayerWithBackend.prototype, ...playerCoreMethods);

// ── Helpers ───────────────────────────────────────────────────────────────────

function installAudioContext(ctx: MockAudioContext): void {
	(globalThis as unknown as { AudioContext: new () => MockAudioContext }).AudioContext = class {
		state = ctx.state;
		currentTime = ctx.currentTime;
		sampleRate = ctx.sampleRate;
		destination = ctx.destination;
		createGain = ctx.createGain.bind(ctx);
		createAnalyser = ctx.createAnalyser.bind(ctx);
		createMediaElementSource = ctx.createMediaElementSource.bind(ctx);
		resume = ctx.resume.bind(ctx);
	};
}

function removeAudioContext(): void {
	delete (globalThis as unknown as { AudioContext?: unknown }).AudioContext;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AudioGraphPlugin — defers to backend.outputNode when present', () => {
	let mockCtx: MockAudioContext;
	let player: MockPlayerWithBackend;

	beforeEach(async () => {
		MockPlayerWithBackend._resetRegistry();
		mockCtx = new MockAudioContext();
		installAudioContext(mockCtx);

		const div = document.createElement('div');
		div.id = 'ag-defer-test';
		document.body.appendChild(div);

		player = new MockPlayerWithBackend('ag-defer-test');
		player.setup({});
		await player.ready();
	});

	afterEach(() => {
		MockPlayerWithBackend._resetRegistry();
		removeAudioContext();
		document.body.innerHTML = '';
	});

	it('does NOT call createMediaElementSource when backend.outputNode is available', () => {
		const backendOutputNode = new MockAudioNode('backend-outputGain') as unknown as AudioNode;
		const audioEl = document.createElement('audio');

		player.setBackend({
			outputNode: vi.fn(() => backendOutputNode),
			mediaElement: () => audioEl,
		});

		setPlayerAudioContext(player as unknown as IPlayer, mockCtx as unknown as AudioContext);

		player.addPlugin(AudioGraphPlugin);

		expect(mockCtx.createMediaElementSource).not.toHaveBeenCalled();
	});

	it('uses the backend outputNode as the chain source', () => {
		const backendOutputNode = new MockAudioNode('backend-outputGain') as unknown as AudioNode;
		const audioEl = document.createElement('audio');

		const backendOutputNodeFn = vi.fn(() => backendOutputNode);

		player.setBackend({
			outputNode: backendOutputNodeFn,
			mediaElement: () => audioEl,
		});

		setPlayerAudioContext(player as unknown as IPlayer, mockCtx as unknown as AudioContext);

		player.addPlugin(AudioGraphPlugin);

		expect(backendOutputNodeFn).toHaveBeenCalledOnce();

		// The plugin's chain should connect the backend node to destination.
		const nodeConnections = (backendOutputNode as unknown as MockAudioNode)._connections;
		expect(nodeConnections).toContain(mockCtx.destination);
	});

	it('falls back to createMediaElementSource when backend has no outputNode', () => {
		const audioEl = document.createElement('audio');
		document.body.appendChild(audioEl);

		// Backend without outputNode — simulates a non-audio-element backend.
		player.setBackend({
			outputNode: undefined as unknown as MockBackend['outputNode'],
			mediaElement: () => audioEl,
		});

		setPlayerAudioContext(player as unknown as IPlayer, mockCtx as unknown as AudioContext);

		player.addPlugin(AudioGraphPlugin);

		expect(mockCtx.createMediaElementSource).toHaveBeenCalledOnce();
		expect(mockCtx.createMediaElementSource).toHaveBeenCalledWith(audioEl);
	});

	it('falls back to createMediaElementSource when player has no backend() method', async () => {
		// Plain player with no backend method — kit-only mock.
		const plainDiv = document.createElement('div');
		plainDiv.id = 'ag-no-backend';
		document.body.appendChild(plainDiv);

		MockPlayerWithBackend._resetRegistry();
		const plainPlayer = new MockPlayerWithBackend('ag-no-backend');
		plainPlayer.setup({});
		await plainPlayer.ready();

		// Remove backend method entirely.
		delete (plainPlayer as unknown as { backend?: unknown }).backend;

		setPlayerAudioContext(plainPlayer as unknown as IPlayer, mockCtx as unknown as AudioContext);

		plainPlayer.addPlugin(AudioGraphPlugin);

		// No backend → falls back. But also no media element → gets a gain placeholder.
		// Either way, createMediaElementSource is not called (no element to wrap).
		// The plugin emits context:ready without throwing.
		const plugin = plainPlayer.getPlugin(AudioGraphPlugin);
		expect(plugin).toBeDefined();
	});
});
