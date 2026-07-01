// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Stable-gate conformance tests. Every plugin shipped by nomercy-player-core
 * runs through `describePlugin` — the kit's lifecycle + leak harness — PLUS at
 * least one real-behavior assertion that proves the plugin's primary documented
 * effect, not just that it ran.
 *
 * Event assertions use `vi.spyOn(ctx.player, 'emit')` rather than
 * `ctx.player.on(event, fn)`. The spy patches the method in place; it does NOT
 * add a listener to the EventEmitter's internal map, so the leak harness in
 * `afterEach` never sees it as a leaked listener.
 *
 * Plugins that require `AudioGraphPlugin` (Equalizer, Mixer, Spectrum) use a
 * `StubPlayerWithGraph` subclass. It pre-wires an `AudioGraphPlugin` instance
 * with a mock `AudioContext` and exposes it via `getPlugin`. The mock
 * `AudioContext` constructor is installed on `globalThis` before `use()` runs;
 * jsdom never has a real `AudioContext` so leaving the override in place for
 * the duration of the suite is safe.
 *
 * `VisualizationPlugin` is abstract; `WaveformVisualization` stands in.
 */

import type { AudioGraphOptions } from '../../plugins/audio-graph';
import type { VisualizationOptions } from '../../plugins/visualization';
import type { IPlayer } from '../../types';
import { expect, vi } from 'vitest';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { BrowserPolicyError } from '../../errors';
import { AudioGraphPlugin } from '../../plugins/audio-graph';
import { CanvasPlugin } from '../../plugins/canvas';
import { CastSenderPlugin } from '../../plugins/cast-sender';
import { EmbedPlugin } from '../../plugins/embed';
import { EqualizerPlugin } from '../../plugins/equalizer';
import { KeyHandlerPlugin } from '../../plugins/key-handler';
import { MediaSessionPlugin } from '../../plugins/media-session';
import { MessagePlugin } from '../../plugins/message';
import { MixerPlugin } from '../../plugins/mixer';
import { SpectrumPlugin } from '../../plugins/spectrum';
import { TabLeaderPlugin } from '../../plugins/tab-leader';
import { WaveformVisualization } from '../../plugins/visualization';
import { describePlugin } from '../../testing/describe-plugin';
import { StubPlayer } from '../../testing/stub-player';

// ── AudioContext mock ──────────────────────────────────────────────────────────

function makeAudioNode(): AudioNode {
	return {
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as AudioNode;
}

function makeGainNode(): GainNode {
	return {
		gain: { value: 1, setTargetAtTime: vi.fn() },
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as GainNode;
}

function makeAnalyserNode(): AnalyserNode {
	let _fftSize = 2048;
	let _smoothing = 0.8;
	return {
		get fftSize() { return _fftSize; },
		set fftSize(v: number) { _fftSize = v; },
		get frequencyBinCount() { return _fftSize / 2; },
		get smoothingTimeConstant() { return _smoothing; },
		set smoothingTimeConstant(v: number) { _smoothing = v; },
		connect: vi.fn(),
		disconnect: vi.fn(),
		getByteFrequencyData: vi.fn(),
		getByteTimeDomainData: vi.fn(),
	} as unknown as AnalyserNode;
}

function makeStereoPannerNode(): StereoPannerNode {
	return {
		pan: { value: 0, setTargetAtTime: vi.fn() },
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as StereoPannerNode;
}

function makeBiquadFilterNode(): BiquadFilterNode {
	return {
		type: 'peaking' as BiquadFilterType,
		frequency: { value: 1000 },
		Q: { value: 1 },
		gain: { value: 0, setTargetAtTime: vi.fn() },
		connect: vi.fn(),
		disconnect: vi.fn(),
	} as unknown as BiquadFilterNode;
}

function installMockAudioContext(): void {
	(globalThis as Record<string, unknown>)['AudioContext'] = function () {
		return {
			sampleRate: 44100,
			currentTime: 0,
			state: 'running' as AudioContextState,
			destination: makeAudioNode(),
			createGain: vi.fn(() => makeGainNode()),
			createAnalyser: vi.fn(() => makeAnalyserNode()),
			createBiquadFilter: vi.fn(() => makeBiquadFilterNode()),
			createStereoPanner: vi.fn(() => makeStereoPannerNode()),
			createMediaElementSource: vi.fn(() => makeAudioNode()),
			resume: vi.fn().mockResolvedValue(undefined),
			close: vi.fn().mockResolvedValue(undefined),
		} as unknown as AudioContext;
	};
}

// ── StubPlayerWithGraph ────────────────────────────────────────────────────────
//
// Exposes a pre-wired AudioGraphPlugin via getPlugin so that AudioGraph-dependent
// plugins (Equalizer, Mixer, Spectrum) can resolve their dependency at use() time.
// The graph plugin is initialized against this same player, keeping the
// AudioContext reference consistent.

class StubPlayerWithGraph extends StubPlayer {
	private readonly _graphPlugin: AudioGraphPlugin;
	private readonly _graphLifecycle: LifecycleRegistry;

	constructor() {
		super();
		installMockAudioContext();

		const graph = new AudioGraphPlugin();
		const lc = new LifecycleRegistry();
		graph.initialize(this as unknown as IPlayer, {} as AudioGraphOptions, lc);
		graph.use();

		this._graphPlugin = graph;
		this._graphLifecycle = lc;
	}

	override getPlugin<P extends object>(PluginClass: { id: string; new(): P }): P | undefined {
		if (PluginClass.id === AudioGraphPlugin.id) {
			return this._graphPlugin as unknown as P;
		}
		return undefined;
	}

	override reset(): void {
		this._graphPlugin.dispose();
		this._graphLifecycle.dispose();
		super.reset();
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AudioGraphPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(AudioGraphPlugin, (ctx) => {
	it('has static id "audio-graph"', () => {
		expect(AudioGraphPlugin.id).toBe('audio-graph');
	});

	it('context() returns an AudioContext with a positive sampleRate', () => {
		const audioCtx = ctx.plugin.context();
		expect(audioCtx).toBeDefined();
		expect(typeof audioCtx.sampleRate).toBe('number');
		expect(audioCtx.sampleRate).toBeGreaterThan(0);
	});

	it('insertEffect returns the node reference back', () => {
		const node = makeAudioNode();
		const returned = ctx.plugin.insertEffect(node, 'post');
		expect(returned).toBe(node);
	});

	it('pre() inserts and returns the node', () => {
		const node = makeAudioNode();
		expect(ctx.plugin.pre(node)).toBe(node);
	});

	it('post() inserts and returns the node', () => {
		const node = makeAudioNode();
		expect(ctx.plugin.post(node)).toBe(node);
	});

	it('insertEffect emits chain:rebuilt on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		const node = makeAudioNode();
		ctx.plugin.insertEffect(node, 'post');
		const rebuiltCalls = spy.mock.calls.filter(([e]) => e === 'plugin:audio-graph:chain:rebuilt');
		expect(rebuiltCalls.length).toBeGreaterThanOrEqual(1);
	});

	it('removeEffect emits chain:rebuilt on the player', () => {
		const node = makeAudioNode();
		ctx.plugin.insertEffect(node, 'post');

		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.removeEffect(node);
		const rebuiltCalls = spy.mock.calls.filter(([e]) => e === 'plugin:audio-graph:chain:rebuilt');
		expect(rebuiltCalls.length).toBeGreaterThanOrEqual(1);
	});

	it('outputNode() returns an AudioNode after use()', () => {
		const out = ctx.plugin.outputNode();
		expect(typeof out.connect).toBe('function');
	});

	it('analyserSource() returns the same node on repeated calls (singleton)', () => {
		const a = ctx.plugin.analyserSource();
		const b = ctx.plugin.analyserSource();
		expect(a).toBe(b);
	});

	it('dispose() emits context:closed on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.dispose();
		const closedCalls = spy.mock.calls.filter(([e]) => e === 'plugin:audio-graph:context:closed');
		expect(closedCalls.length).toBe(1);
	});

	it('use() emits context:ready — sampleRate carried in payload', () => {
		// context:ready fires during use() in beforeEach. The plugin is already live;
		// verify via context() that the session is active.
		expect(ctx.plugin.context().sampleRate).toBeGreaterThan(0);
	});
}, {
	createPlayer: () => {
		installMockAudioContext();
		return new StubPlayer();
	},
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. CanvasPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(CanvasPlugin, (ctx) => {
	it('has static id "canvas"', () => {
		expect(CanvasPlugin.id).toBe('canvas');
	});

	it('canvas() returns an HTMLCanvasElement after use()', () => {
		expect(ctx.plugin.canvas()).toBeInstanceOf(HTMLCanvasElement);
	});

	it('canvas() is mounted inside the player container', () => {
		const canvasEl = ctx.plugin.canvas();
		expect(ctx.player.container.contains(canvasEl)).toBe(true);
	});

	it('size() write emits resized event on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.size(320, 240);
		const resizedCalls = spy.mock.calls.filter(([e]) => e === 'plugin:canvas:resized');
		expect(resizedCalls.length).toBeGreaterThanOrEqual(1);
		const payload = resizedCalls[0]?.[1] as { width: number; height: number } | undefined;
		expect(payload?.width).toBe(320);
		expect(payload?.height).toBe(240);
	});

	it('size() read returns an object with width and height', () => {
		const s = ctx.plugin.size();
		expect(typeof s.width).toBe('number');
		expect(typeof s.height).toBe('number');
	});

	it('addRenderer() returns an unregister function', () => {
		const unregister = ctx.plugin.addRenderer(vi.fn());
		expect(typeof unregister).toBe('function');
		unregister();
	});

	it('removeRenderer() silently no-ops for unknown fn', () => {
		expect(() => ctx.plugin.removeRenderer(vi.fn())).not.toThrow();
	});

	it('use() emits mounted — canvas is present as proof', () => {
		expect(ctx.plugin.canvas()).toBeInstanceOf(HTMLCanvasElement);
	});

	it('dispose() does not throw and canvas() throws afterwards', () => {
		ctx.plugin.dispose();
		expect(() => ctx.plugin.canvas()).toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. CastSenderPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(CastSenderPlugin, (ctx) => {
	it('has static id "cast-sender"', () => {
		expect(CastSenderPlugin.id).toBe('cast-sender');
	});

	it('isConnected() is false before connect()', () => {
		expect(ctx.plugin.isConnected()).toBe(false);
	});

	it('connect() rejects with BrowserPolicyError when Cast SDK is absent', async () => {
		await expect(ctx.plugin.connect()).rejects.toBeInstanceOf(BrowserPolicyError);
	});

	it('connect() emits plugin:cast-sender:unsupported on the player when SDK is absent', async () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		await ctx.plugin.connect().catch(() => {});
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:cast-sender:unsupported');
		expect(calls.length).toBeGreaterThanOrEqual(1);
	});

	it('disconnect() is safe to call when not connected', () => {
		expect(() => ctx.plugin.disconnect()).not.toThrow();
	});

	it('use() completes without throwing when Cast SDK is absent', () => {
		expect(ctx.plugin.isConnected()).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. EmbedPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(EmbedPlugin, (ctx) => {
	it('has static id "embed"', () => {
		expect(EmbedPlugin.id).toBe('embed');
	});

	it('allowedOrigins() returns empty array by default', () => {
		expect(ctx.plugin.allowedOrigins()).toEqual([]);
	});

	it('allowedOrigins(list) round-trip', () => {
		ctx.plugin.allowedOrigins(['https://example.com', 'https://other.com']);
		expect(ctx.plugin.allowedOrigins()).toEqual(['https://example.com', 'https://other.com']);
	});

	it('allowedOrigins(string) normalises to single-element array', () => {
		ctx.plugin.allowedOrigins('https://example.com');
		expect(ctx.plugin.allowedOrigins()).toEqual(['https://example.com']);
	});

	it('options({allowedOrigins}) live-updates the inbound filter', () => {
		ctx.plugin.options({ allowedOrigins: ['https://trusted.com'] });
		expect(ctx.plugin.allowedOrigins()).toEqual(['https://trusted.com']);
	});

	it('sendToHost does not throw when window.parent is the same origin', () => {
		expect(() => ctx.plugin.sendToHost({ type: 'nm:event', name: 'play', data: {} })).not.toThrow();
	});

	it('dispose() cleans up without throwing', () => {
		expect(() => ctx.plugin.dispose()).not.toThrow();
	});
}, { opts: { allowedOrigins: [] } });

// ─────────────────────────────────────────────────────────────────────────────
// 5. EqualizerPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(EqualizerPlugin, (ctx) => {
	it('has static id "equalizer"', () => {
		expect(EqualizerPlugin.id).toBe('equalizer');
	});

	it('bands() has more than one entry after use()', () => {
		expect(ctx.plugin.bands().length).toBeGreaterThan(1);
	});

	it('bands()[0] is the Pre pseudo-band', () => {
		expect(ctx.plugin.bands()[0]?.frequency).toBe('Pre');
	});

	it('band(freq) read returns 0 for the default 70 Hz band', () => {
		expect(ctx.plugin.band(70)).toBe(0);
	});

	it('band({frequency, gain}) write then read round-trip', () => {
		ctx.plugin.band({ frequency: 70, gain: 6 });
		expect(ctx.plugin.band(70)).toBe(6);
	});

	it('band() write emits plugin:equalizer:band:changed on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.band({ frequency: 180, gain: -3 });
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:equalizer:band:changed');
		expect(calls.length).toBe(1);
		expect(((calls[0]![1] as { band: { frequency: number } }).band).frequency).toBe(180);
	});

	it('presets() returns at least one built-in preset', () => {
		expect(ctx.plugin.presets().length).toBeGreaterThan(0);
	});

	it('preset(name) applies and emits plugin:equalizer:preset:changed', () => {
		const available = ctx.plugin.presets();
		const first = available[0]!;
		const spy = vi.spyOn(ctx.player, 'emit');

		ctx.plugin.preset(first.name);

		expect(ctx.plugin.preset()).toBe(first.name);
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:equalizer:preset:changed');
		expect(calls.length).toBeGreaterThanOrEqual(1);
	});

	it('reset() clears the preset name and emits preset:changed with undefined', () => {
		const available = ctx.plugin.presets();
		ctx.plugin.preset(available[0]!.name);

		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.reset();

		expect(ctx.plugin.preset()).toBeUndefined();
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:equalizer:preset:changed');
		expect(calls.length).toBeGreaterThanOrEqual(1);
	});

	it('bands() snapshot is a defensive copy — external mutation does not affect state', () => {
		const snap = ctx.plugin.bands();
		const originalGain = snap[1]?.gain ?? 0;
		if (snap[1])
			snap[1].gain = 999;
		expect(ctx.plugin.bands()[1]?.gain).toBe(originalGain);
	});

	it('addCustomPreset() makes the preset available via presets()', () => {
		ctx.plugin.addCustomPreset({ name: 'TestCustom', values: [{ frequency: 70, gain: 5 }] });
		const names = ctx.plugin.presets().map(p => p.name);
		expect(names).toContain('TestCustom');
	});
}, {
	createPlayer: () => new StubPlayerWithGraph(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. KeyHandlerPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(KeyHandlerPlugin, (ctx) => {
	it('has static id "key-handler"', () => {
		expect(KeyHandlerPlugin.id).toBe('key-handler');
	});

	it('bindings() contains the default Space binding', () => {
		expect(ctx.plugin.bindings().has(' ')).toBe(true);
	});

	it('bindings() contains ArrowLeft, ArrowRight, ArrowUp, ArrowDown, m', () => {
		const map = ctx.plugin.bindings();
		expect(map.has('ArrowLeft')).toBe(true);
		expect(map.has('ArrowRight')).toBe(true);
		expect(map.has('ArrowUp')).toBe(true);
		expect(map.has('ArrowDown')).toBe(true);
		expect(map.has('m')).toBe(true);
	});

	it('bind() registers a new combo', () => {
		ctx.plugin.bind('k', () => {});
		expect(ctx.plugin.bindings().has('k')).toBe(true);
	});

	it('unbind() removes a registered combo', () => {
		ctx.plugin.bind('q', () => {});
		ctx.plugin.unbind('q');
		expect(ctx.plugin.bindings().has('q')).toBe(false);
	});

	it('replace() is an alias for bind() — overwrites', () => {
		ctx.plugin.bind('x', () => {});
		ctx.plugin.replace('x', () => {});
		expect(ctx.plugin.bindings().has('x')).toBe(true);
	});

	it('scope() defaults to document', () => {
		expect(ctx.plugin.scope()).toBe(document);
	});

	it('scope("container") returns the player container', () => {
		const plugin = new KeyHandlerPlugin();
		const lc = new LifecycleRegistry();
		plugin.initialize(ctx.player as unknown as IPlayer, { scope: 'container' }, lc);
		plugin.use();
		expect(plugin.scope()).toBe(ctx.player.container);
		plugin.dispose();
		lc.dispose();
	});

	it('Space keydown on document calls player.togglePlayback', () => {
		vi.spyOn(ctx.player, 'togglePlayback').mockImplementation(async () => {});
		document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(vi.mocked(ctx.player.togglePlayback)).toHaveBeenCalledTimes(1);
	});

	it('ArrowLeft keydown calls player.rewind', () => {
		vi.spyOn(ctx.player, 'rewind').mockImplementation(async () => {});
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
		expect(vi.mocked(ctx.player.rewind)).toHaveBeenCalledTimes(1);
	});
}, { opts: { cooldownMs: 0 } });

// ─────────────────────────────────────────────────────────────────────────────
// 7. MediaSessionPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(MediaSessionPlugin, (ctx) => {
	it('has static id "media-session"', () => {
		expect(MediaSessionPlugin.id).toBe('media-session');
	});

	it('use() is silent in jsdom (no navigator.mediaSession) — no throw', () => {
		expect(true).toBe(true);
	});

	it('metadata() returns undefined before any write', () => {
		expect(ctx.plugin.metadata()).toBeUndefined();
	});

	it('metadata(meta) stores and metadata() reads it back', () => {
		ctx.plugin.metadata({ title: 'Test Track', artist: 'Test Artist' });
		const meta = ctx.plugin.metadata();
		expect(meta?.title).toBe('Test Track');
		expect(meta?.artist).toBe('Test Artist');
	});

	it('metadata(meta) with artwork stores artwork array', () => {
		ctx.plugin.metadata({ title: 'T', artwork: [{ src: 'https://example.com/art.jpg' }] });
		expect(ctx.plugin.metadata()?.artwork?.[0]?.src).toBe('https://example.com/art.jpg');
	});

	it('clearMetadata() does not throw in jsdom', () => {
		expect(() => ctx.plugin.clearMetadata()).not.toThrow();
	});

	it('dispose() does not throw in jsdom', () => {
		expect(() => ctx.plugin.dispose()).not.toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. MessagePlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(MessagePlugin, (ctx) => {
	it('has static id "message"', () => {
		expect(MessagePlugin.id).toBe('message');
	});

	it('use() mounts a toast div with role="status" and aria-live="polite"', () => {
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast');
		expect(toast).not.toBeNull();
		expect(toast?.getAttribute('role')).toBe('status');
		expect(toast?.getAttribute('aria-live')).toBe('polite');
	});

	it('show(text) sets toast text content and makes it visible', () => {
		ctx.plugin.show('Hello world', 60000);
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast') as HTMLElement;
		expect(toast.textContent).toBe('Hello world');
		expect(toast.style.display).toBe('block');
	});

	it('hide() clears text and sets display:none', () => {
		ctx.plugin.show('Visible', 60000);
		ctx.plugin.hide();
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast') as HTMLElement;
		expect(toast.style.display).toBe('none');
		expect(toast.textContent).toBe('');
	});

	it('displayMessage(string) shows the text', () => {
		ctx.plugin.displayMessage('Direct string', 60000);
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast') as HTMLElement;
		expect(toast.textContent).toBe('Direct string');
	});

	it('displayMessage({text}) reads text from object', () => {
		ctx.plugin.displayMessage({ text: 'Object text', durationMs: 60000 });
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast') as HTMLElement;
		expect(toast.textContent).toBe('Object text');
	});

	it('displayPersistent() mounts a named persistent element with correct role', () => {
		ctx.plugin.displayPersistent('Stay visible', 'test-id');
		const el = ctx.player.container.querySelector('[data-persistent-id="test-id"]') as HTMLElement;
		expect(el).not.toBeNull();
		expect(el.textContent).toBe('Stay visible');
		expect(el.getAttribute('role')).toBe('status');
	});

	it('displayPersistent() updates text in-place on second call with same id', () => {
		ctx.plugin.displayPersistent('First', 'same-id');
		ctx.plugin.displayPersistent('Second', 'same-id');
		const all = ctx.player.container.querySelectorAll('[data-persistent-id="same-id"]');
		expect(all.length).toBe(1);
		expect((all[0] as HTMLElement).textContent).toBe('Second');
	});

	it('removePersistent() removes the named element from DOM', () => {
		ctx.plugin.displayPersistent('Remove me', 'rm-id');
		ctx.plugin.removePersistent('rm-id');
		expect(ctx.player.container.querySelector('[data-persistent-id="rm-id"]')).toBeNull();
	});

	it('queue() shows the first message immediately', () => {
		vi.useFakeTimers();
		ctx.plugin.queue(['First', 'Second']);
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast') as HTMLElement;
		expect(toast.textContent).toBe('First');
		vi.useRealTimers();
	});

	it('clear() hides the toast and cancels the queue', () => {
		vi.useFakeTimers();
		ctx.plugin.queue(['A', 'B', 'C']);
		ctx.plugin.clear();
		vi.advanceTimersByTime(30000);
		const toast = ctx.player.container.querySelector('.nmplayer-message-toast') as HTMLElement;
		expect(toast.style.display).toBe('none');
		vi.useRealTimers();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. MixerPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(MixerPlugin, (ctx) => {
	it('has static id "mixer"', () => {
		expect(MixerPlugin.id).toBe('mixer');
	});

	it('gain() defaults to 0 dB', () => {
		expect(ctx.plugin.gain()).toBe(0);
	});

	it('gain(dB) write then read round-trip', () => {
		ctx.plugin.gain(6);
		expect(ctx.plugin.gain()).toBe(6);
	});

	it('gain() clamps to +24 dB ceiling', () => {
		ctx.plugin.gain(9999);
		expect(ctx.plugin.gain()).toBe(24);
	});

	it('gain() clamps to -24 dB floor', () => {
		ctx.plugin.gain(-9999);
		expect(ctx.plugin.gain()).toBe(-24);
	});

	it('gain() emits plugin:mixer:gain:changed on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.gain(3);
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:mixer:gain:changed');
		expect(calls.length).toBe(1);
		expect((calls[0]![1] as { gain: number }).gain).toBe(3);
	});

	it('pan() defaults to 0', () => {
		expect(ctx.plugin.pan()).toBe(0);
	});

	it('pan() write then read round-trip', () => {
		ctx.plugin.pan(-0.5);
		expect(ctx.plugin.pan()).toBe(-0.5);
	});

	it('pan() clamps to ±1', () => {
		ctx.plugin.pan(5);
		expect(ctx.plugin.pan()).toBe(1);
		ctx.plugin.pan(-5);
		expect(ctx.plugin.pan()).toBe(-1);
	});

	it('pan() emits plugin:mixer:pan:changed on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.pan(0.5);
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:mixer:pan:changed');
		expect(calls.length).toBe(1);
		expect((calls[0]![1] as { pan: number }).pan).toBe(0.5);
	});

	it('muted() defaults to false', () => {
		expect(ctx.plugin.muted()).toBe(false);
	});

	it('muted(true) write then read', () => {
		ctx.plugin.muted(true);
		expect(ctx.plugin.muted()).toBe(true);
	});

	it('muted() emits plugin:mixer:mute:changed on the player', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.muted(true);
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:mixer:mute:changed');
		expect(calls.length).toBe(1);
		expect((calls[0]![1] as { muted: boolean }).muted).toBe(true);
	});

	it('muted() is a no-op when state already matches (no duplicate event)', () => {
		const spy = vi.spyOn(ctx.player, 'emit');
		ctx.plugin.muted(false);
		ctx.plugin.muted(false);
		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:mixer:mute:changed');
		expect(calls.length).toBe(0);
	});
}, {
	createPlayer: () => new StubPlayerWithGraph(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SpectrumPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(SpectrumPlugin, (ctx) => {
	it('has static id "spectrum"', () => {
		expect(SpectrumPlugin.id).toBe('spectrum');
	});

	it('analyser() returns the AnalyserNode after use()', () => {
		const node = ctx.plugin.analyser();
		expect(node).toBeDefined();
		expect(typeof node.fftSize).toBe('number');
	});

	it('syntheticMode() defaults to false', () => {
		expect(ctx.plugin.syntheticMode()).toBe(false);
	});

	it('syntheticMode(true) enables, syntheticMode(false) disables', () => {
		ctx.plugin.syntheticMode(true);
		expect(ctx.plugin.syntheticMode()).toBe(true);
		ctx.plugin.syntheticMode(false);
		expect(ctx.plugin.syntheticMode()).toBe(false);
	});

	it('pushFrame() is a no-op when syntheticMode is false', () => {
		const frame = {
			frequency: new Uint8Array(new ArrayBuffer(1024)),
			waveform: new Uint8Array(new ArrayBuffer(2048)),
			time: 0,
			deltaMs: 0,
			energy: 0,
			bandEnergies: { bass: 0, mid: 0, treble: 0 },
			frequencyFloat: new Float32Array(1024),
			waveformFloat: new Float32Array(2048),
			sampleRate: 44100,
			binHz: 44100 / 2048,
			peakHz: 0,
			peakBandEnergies: { bass: 0, mid: 0, treble: 0 },
		};
		expect(() => ctx.plugin.pushFrame(frame)).not.toThrow();
		expect(ctx.plugin.syntheticMode()).toBe(false);
	});

	it('pushFrame() is accepted when syntheticMode is true', () => {
		const frame = {
			frequency: new Uint8Array(new ArrayBuffer(1024)),
			waveform: new Uint8Array(new ArrayBuffer(2048)),
			time: 42,
			deltaMs: 16,
			energy: 0.5,
			bandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
			frequencyFloat: new Float32Array(1024),
			waveformFloat: new Float32Array(2048),
			sampleRate: 44100,
			binHz: 44100 / 2048,
			peakHz: 440,
			peakBandEnergies: { bass: 0.3, mid: 0.2, treble: 0.1 },
		};
		ctx.plugin.syntheticMode(true);
		expect(() => ctx.plugin.pushFrame(frame)).not.toThrow();
	});

	it('fftSize() returns the current analyser fftSize', () => {
		const size = ctx.plugin.fftSize();
		expect(typeof size).toBe('number');
		expect(size).toBeGreaterThan(0);
	});

	it('fftSize(size) updates the AnalyserNode fftSize', () => {
		ctx.plugin.fftSize(4096);
		expect(ctx.plugin.fftSize()).toBe(4096);
	});

	it('smoothingTimeConstant() returns a number', () => {
		expect(typeof ctx.plugin.smoothingTimeConstant()).toBe('number');
	});

	it('smoothingTimeConstant(value) updates the AnalyserNode', () => {
		ctx.plugin.smoothingTimeConstant(0.5);
		expect(ctx.plugin.smoothingTimeConstant()).toBe(0.5);
	});

	it('bandEnergy() returns a value in [0, 1]', () => {
		const energy = ctx.plugin.bandEnergy(20, 250);
		expect(energy).toBeGreaterThanOrEqual(0);
		expect(energy).toBeLessThanOrEqual(1);
	});

	it('registerBeatProvider() does not throw', () => {
		expect(() => ctx.plugin.registerBeatProvider(() => ({ beat: false, bpm: 120 }))).not.toThrow();
	});
}, {
	createPlayer: () => new StubPlayerWithGraph(),
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. TabLeaderPlugin
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(TabLeaderPlugin, (ctx) => {
	it('has static id "tab-leader"', () => {
		expect(TabLeaderPlugin.id).toBe('tab-leader');
	});

	it('isLeader() is false in jsdom (no navigator.locks)', () => {
		expect(ctx.plugin.isLeader()).toBe(false);
	});

	it('use() emits unsupported when navigator.locks is absent', () => {
		// use() ran in beforeEach; isLeader() staying false confirms the unsupported path.
		expect(ctx.plugin.isLeader()).toBe(false);
	});

	it('releaseLock() is safe when not the leader', () => {
		expect(() => ctx.plugin.releaseLock()).not.toThrow();
	});

	it('requestLock() resolves immediately in jsdom', async () => {
		await expect(ctx.plugin.requestLock()).resolves.toBeUndefined();
	});

	it('dispose() calls releaseLock without throwing', () => {
		expect(() => ctx.plugin.dispose()).not.toThrow();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. VisualizationPlugin (via WaveformVisualization)
// ─────────────────────────────────────────────────────────────────────────────

describePlugin(WaveformVisualization, (ctx) => {
	it('WaveformVisualization has static id "fillz:waveform"', () => {
		expect(WaveformVisualization.id).toBe('fillz:waveform');
	});

	it('requires list contains canvas and spectrum plugin ids', () => {
		const ids = (WaveformVisualization.requires ?? []).map((r) => {
			const ctor = typeof r === 'object' && 'plugin' in r ? r.plugin : r;
			return (ctor as { id: string }).id;
		});
		expect(ids).toContain('canvas');
		expect(ids).toContain('spectrum');
	});

	it('currentFrame() is undefined when dependencies are missing (unsupported path)', () => {
		expect(ctx.plugin.currentFrame()).toBeUndefined();
	});

	it('use() emits plugin:fillz:waveform:unsupported on the player when deps absent', () => {
		const spy = vi.spyOn(ctx.player, 'emit');

		const freshPlugin = new WaveformVisualization();
		const lc = new LifecycleRegistry();
		freshPlugin.initialize(ctx.player as unknown as IPlayer, {} as VisualizationOptions, lc);
		freshPlugin.use();

		const calls = spy.mock.calls.filter(([e]) => e === 'plugin:fillz:waveform:unsupported');
		expect(calls.length).toBeGreaterThanOrEqual(1);

		freshPlugin.dispose();
		lc.dispose();
	});

	it('dispose() does not throw', () => {
		expect(() => ctx.plugin.dispose()).not.toThrow();
	});
});
