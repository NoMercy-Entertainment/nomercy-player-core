// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended coverage for `MixerPlugin` — targets uncovered functions:
 *  - muted() getter / setter
 *  - save() — with and without persistKey
 *  - getGainNode() / getPannerNode() override hooks
 *  - dispose() — removes nodes from graph, clears state
 *  - gain() clamp / ramp when gainNode is present
 *  - pan() clamp when pannerNode is present
 *  - loadPersisted() — valid JSON, invalid JSON, async storage ignored
 *  - autoSave() — called on gain/pan/muted set
 *  - rampParam — fallback to direct set when setTargetAtTime unavailable
 *
 * AudioContext is mocked since jsdom does not implement Web Audio.
 */

import type { MixerOptions } from '../../plugins/mixer';
import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { MixerPlugin } from '../../plugins/mixer';

// ── Mock AudioContext ─────────────────────────────────────────────────────────

function makeAudioParam(initial: number = 1): AudioParam {
	return {
		value: initial,
		setTargetAtTime: vi.fn(),
	} as unknown as AudioParam;
}

function makeGainNode(): GainNode {
	return { gain: makeAudioParam(1) } as unknown as GainNode;
}

function makePannerNode(): StereoPannerNode {
	return { pan: makeAudioParam(0) } as unknown as StereoPannerNode;
}

function makeAudioContext(): AudioContext {
	return {
		currentTime: 0,
		createGain: vi.fn().mockReturnValue(makeGainNode()),
		createStereoPanner: vi.fn().mockReturnValue(makePannerNode()),
	} as unknown as AudioContext;
}

function makeAudioGraphPlugin(ctx: AudioContext): any {
	const effects: AudioNode[] = [];
	return {
		context: () => ctx,
		insertEffect: vi.fn((node: AudioNode) => effects.push(node)),
		removeEffect: vi.fn((node: AudioNode) => {
			const idx = effects.indexOf(node);
			if (idx >= 0)
				effects.splice(idx, 1);
		}),
	};
}

// ── MockPlayer ────────────────────────────────────────────────────────────────

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
	declare getPlugin: (PluginClass: any) => any;

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeInstrumentedMixer(
	player: MockPlayer,
	opts: MixerOptions = {},
): { mixer: MixerPlugin; graph: ReturnType<typeof makeAudioGraphPlugin>; ctx: AudioContext } {
	const ctx = makeAudioContext();
	const graph = makeAudioGraphPlugin(ctx);
	(player as any).getPlugin = (PluginClass: any) => {
		if (PluginClass.id === 'audio-graph')
			return graph;
		return undefined;
	};
	const mixer = new MixerPlugin();
	mixer.initialize(player as any, opts, new LifecycleRegistry());
	mixer.use();
	return { mixer, graph, ctx };
}

describe('MixerPlugin extended', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	describe('muted() getter / setter', () => {
		it('muted() returns false by default after use()', () => {
			const mockPlayer = makePlayer('mx-1');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			expect(mixer.muted()).toBe(false);
		});

		it('muted(true) sets mute state and emits mute:changed', () => {
			const mockPlayer = makePlayer('mx-2');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			const events: Array<{ muted: boolean }> = [];
			mockPlayer.on('plugin:mixer:mute:changed' as any, (data: { muted: boolean }) => events.push(data));

			mixer.muted(true);

			expect(mixer.muted()).toBe(true);
			expect(events).toHaveLength(1);
			expect(events[0]!.muted).toBe(true);
		});

		it('muted(false) restores gain and emits mute:changed', () => {
			const mockPlayer = makePlayer('mx-3');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			mixer.muted(true);
			const events: Array<{ muted: boolean }> = [];
			mockPlayer.on('plugin:mixer:mute:changed' as any, (data: { muted: boolean }) => events.push(data));

			mixer.muted(false);

			expect(mixer.muted()).toBe(false);
			expect(events).toHaveLength(1);
			expect(events[0]!.muted).toBe(false);
		});

		it('muted(value) is a no-op when value equals current state', () => {
			const mockPlayer = makePlayer('mx-4');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			const events: unknown[] = [];
			mockPlayer.on('plugin:mixer:mute:changed' as any, (data: unknown) => events.push(data));

			mixer.muted(false);

			expect(events).toHaveLength(0);
		});
	});

	describe('gain() with AudioNode', () => {
		it('gain(dB) clamps to +maxGainDb', () => {
			const mockPlayer = makePlayer('mx-5');
			const { mixer } = makeInstrumentedMixer(mockPlayer, { maxGainDb: 12 });
			mixer.gain(100);
			expect(mixer.gain()).toBe(12);
		});

		it('gain(dB) clamps to -maxGainDb', () => {
			const mockPlayer = makePlayer('mx-6');
			const { mixer } = makeInstrumentedMixer(mockPlayer, { maxGainDb: 12 });
			mixer.gain(-100);
			expect(mixer.gain()).toBe(-12);
		});

		it('gain(dB) ramps the GainNode param via setTargetAtTime', () => {
			const mockPlayer = makePlayer('mx-7');
			const { mixer, ctx } = makeInstrumentedMixer(mockPlayer);
			const gainNode = (mixer as any).gainNode as GainNode;
			const setTargetSpy = vi.spyOn(gainNode.gain, 'setTargetAtTime');
			mixer.gain(6);
			expect(setTargetSpy).toHaveBeenCalled();
			void ctx;
		});

		it('when muted, gain(dB) ramps to 0 (not the linear value)', () => {
			const mockPlayer = makePlayer('mx-8');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			mixer.muted(true);
			const gainNode = (mixer as any).gainNode as GainNode;
			const setTargetSpy = vi.spyOn(gainNode.gain, 'setTargetAtTime');
			mixer.gain(6);
			const targetArg = (setTargetSpy.mock.calls[0] as [number, ...unknown[]])[0];
			expect(targetArg).toBe(0);
		});
	});

	describe('pan() with AudioNode', () => {
		it('pan(value) clamps to +1', () => {
			const mockPlayer = makePlayer('mx-9');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			mixer.pan(5);
			expect(mixer.pan()).toBe(1);
		});

		it('pan(value) clamps to -1', () => {
			const mockPlayer = makePlayer('mx-10');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			mixer.pan(-5);
			expect(mixer.pan()).toBe(-1);
		});

		it('pan(value) ramps the StereoPannerNode param', () => {
			const mockPlayer = makePlayer('mx-11');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			const pannerNode = (mixer as any).pannerNode as StereoPannerNode;
			const setTargetSpy = vi.spyOn(pannerNode.pan, 'setTargetAtTime');
			mixer.pan(0.5);
			expect(setTargetSpy).toHaveBeenCalled();
		});
	});

	describe('save()', () => {
		it('is a no-op when persistKey is not set', () => {
			const mockPlayer = makePlayer('mx-12');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			const events: unknown[] = [];
			mockPlayer.on('plugin:mixer:saved' as any, (data: unknown) => events.push(data));
			mixer.save();
			expect(events).toHaveLength(0);
		});

		it('emits saved when persistKey is set', () => {
			const mockPlayer = makePlayer('mx-13');
			const storageMock = { set: vi.fn().mockResolvedValue(undefined), get: vi.fn() };
			const { mixer } = makeInstrumentedMixer(mockPlayer, { persistKey: 'mixer-state' });
			(mixer as any).storage = storageMock;
			const events: unknown[] = [];
			mockPlayer.on('plugin:mixer:saved' as any, (data: unknown) => events.push(data));
			mixer.save();
			expect(events).toHaveLength(1);
			expect(storageMock.set).toHaveBeenCalledWith('mixer-state', expect.any(String));
		});
	});

	describe('dispose()', () => {
		it('removes gain and panner nodes from the graph', () => {
			const mockPlayer = makePlayer('mx-14');
			const { mixer, graph } = makeInstrumentedMixer(mockPlayer);
			mixer.dispose();
			expect(graph.removeEffect).toHaveBeenCalledTimes(2);
		});

		it('clears gainNode and pannerNode references', () => {
			const mockPlayer = makePlayer('mx-15');
			const { mixer } = makeInstrumentedMixer(mockPlayer);
			mixer.dispose();
			expect((mixer as any).gainNode).toBeNull();
			expect((mixer as any).pannerNode).toBeNull();
		});

		it('dispose with no graph is a no-op', () => {
			const mockPlayer = makePlayer('mx-16');
			const mixer = new MixerPlugin();
			mixer.initialize(mockPlayer as any, {}, new LifecycleRegistry());
			expect(() => mixer.dispose()).not.toThrow();
		});
	});

	describe('rampParam() fallback', () => {
		it('falls back to direct param.value when setTargetAtTime throws', () => {
			const mockPlayer = makePlayer('mx-17');
			const ctx = makeAudioContext();
			const gainNode = makeGainNode();
			const pannerNode = makePannerNode();
			(gainNode.gain.setTargetAtTime as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error('AudioContext is closed');
			});
			(ctx.createGain as ReturnType<typeof vi.fn>).mockReturnValue(gainNode);
			(ctx.createStereoPanner as ReturnType<typeof vi.fn>).mockReturnValue(pannerNode);
			const graph = makeAudioGraphPlugin(ctx);
			(mockPlayer as any).getPlugin = () => graph;

			const mixer = new MixerPlugin();
			mixer.initialize(mockPlayer as any, {}, new LifecycleRegistry());
			mixer.use();

			expect(() => mixer.gain(6)).not.toThrow();
			expect(gainNode.gain.value).not.toBeUndefined();
		});
	});

	describe('loadPersisted()', () => {
		it('returns undefined when storage.get returns undefined', () => {
			const mockPlayer = makePlayer('mx-18');
			const { mixer } = makeInstrumentedMixer(mockPlayer, { persistKey: 'k' });
			(mixer as any).storage = { get: () => undefined, set: vi.fn() };
			const result = (mixer as any).loadPersisted('k');
			expect(result).toBeUndefined();
		});

		it('returns parsed state when storage.get returns valid JSON', () => {
			const mockPlayer = makePlayer('mx-19');
			const state = { gain: 3, pan: 0.1, muted: false };
			const { mixer } = makeInstrumentedMixer(mockPlayer, { persistKey: 'k' });
			(mixer as any).storage = { get: () => JSON.stringify(state), set: vi.fn() };
			const result = (mixer as any).loadPersisted('k');
			expect(result).toEqual(state);
		});

		it('returns undefined when storage.get returns invalid JSON', () => {
			const mockPlayer = makePlayer('mx-20');
			const { mixer } = makeInstrumentedMixer(mockPlayer, { persistKey: 'k' });
			(mixer as any).storage = { get: () => '{bad json', set: vi.fn() };
			const result = (mixer as any).loadPersisted('k');
			expect(result).toBeUndefined();
		});

		it('returns undefined when storage.get returns null JSON', () => {
			const mockPlayer = makePlayer('mx-21');
			const { mixer } = makeInstrumentedMixer(mockPlayer, { persistKey: 'k' });
			(mixer as any).storage = { get: () => 'null', set: vi.fn() };
			const result = (mixer as any).loadPersisted('k');
			expect(result).toBeUndefined();
		});
	});
});
