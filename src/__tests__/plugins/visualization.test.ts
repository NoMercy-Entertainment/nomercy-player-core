/**
 * VisualizationPlugin static-shape + graceful-degradation locks.
 *
 * The visualization base class is abstract; only subclasses can be installed.
 * In happy-dom there is no `AudioContext`, so the spectrum dependency fails
 * during `use()` and the kit marks it disabled — VisualizationPlugin must
 * detect that and emit `unsupported` instead of crashing the player.
 *
 * Mirrors the conventions in `audio-chain.test.ts` / `message-and-canvas.test.ts`:
 * a self-contained MockPlayer built on the kit's shared mixins so the real
 * spine is exercised.
 */

import type { VisualizationFrame } from '../../plugins/visualization';
import type { BaseEventMap } from '../../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../../index';
import { AudioGraphPlugin } from '../../plugins/audio-graph';
import { CanvasPlugin } from '../../plugins/canvas';
import { SpectrumPlugin } from '../../plugins/spectrum';
import {

	VisualizationPlugin,
	WaveformVisualization,
} from '../../plugins/visualization';

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
	declare getPlugin: (PluginClass: any) => any;
	declare getPluginById: (id: string) => any;
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

function installCanvasStub(): void {
	const proto = HTMLCanvasElement.prototype as unknown as { getContext: (type: string) => unknown };
	if ((proto as unknown as { __nmStubbed?: boolean }).__nmStubbed)
		return;
	(proto as unknown as { __nmStubbed: boolean }).__nmStubbed = true;
	proto.getContext = function (this: HTMLCanvasElement, type: string): unknown {
		if (type !== '2d')
			return null;
		const stub: Partial<CanvasRenderingContext2D> = {
			canvas: this,
			clearRect: () => {},
			fillRect: () => {},
			save: () => {},
			restore: () => {},
			beginPath: () => {},
			closePath: () => {},
			moveTo: () => {},
			lineTo: () => {},
			stroke: () => {},
			fill: () => {},
		};
		return stub as CanvasRenderingContext2D;
	};
}

describe('VisualizationPlugin', () => {
	beforeEach(() => {
		installCanvasStub();
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		vi.useRealTimers();
	});

	describe('plugin metadata', () => {
		it('advertises id "visualization", a 2.x version, and CanvasPlugin + SpectrumPlugin as static deps', () => {
			expect(VisualizationPlugin.id).toBe('visualization');
			expect(VisualizationPlugin.version.startsWith('2.')).toBe(true);
			expect(typeof VisualizationPlugin.description).toBe('string');
			expect(VisualizationPlugin.description.length).toBeGreaterThan(0);
			const requires = VisualizationPlugin.requires;
			expect(requires).toBeDefined();
			expect(requires).toContain(CanvasPlugin);
			expect(requires).toContain(SpectrumPlugin);
		});

		it('WaveformVisualization concrete subclass advertises a vendored id and inherits requires', () => {
			expect(WaveformVisualization.id).toBe('fillz:waveform');
			// Subclasses share the abstract base's `requires` until they override.
			expect(WaveformVisualization.requires).toContain(CanvasPlugin);
			expect(WaveformVisualization.requires).toContain(SpectrumPlugin);
		});
	});

	describe('graceful degradation when AudioContext is unavailable', () => {
		it('install succeeds and emits `unsupported` when the spectrum dep is disabled (no AudioContext)', async () => {
			// happy-dom precondition — spectrum plugin will fail at `use()` because
			// AudioGraphPlugin can't acquire an AudioContext, and the kit marks it
			// disabled. VisualizationPlugin detects that and skips registration.
			expect(typeof (globalThis as any).AudioContext).toBe('undefined');

			const p = makePlayer('viz-degrade').setup({});
			await p.ready();

			let unsupportedReason: string | undefined;
			p.on('plugin:fillz:waveform:unsupported' as any, (data: any) => {
				unsupportedReason = data?.reason;
			});

			p.addPlugin(AudioGraphPlugin);
			p.addPlugin(SpectrumPlugin);
			p.addPlugin(CanvasPlugin);
			p.addPlugin(WaveformVisualization);

			// Allow the kit's async install path to settle.
			await new Promise(r => setTimeout(r, 0));

			const inst = p.getPluginById('fillz:waveform');
			expect(inst).toBeDefined();
			expect(unsupportedReason).toBe('spectrum-unavailable');
			// Plugin itself stays enabled — it just silently no-ops on render.
			expect(inst.enabled()).toBe(true);
			// And `currentFrame()` returns undefined because no spectrum frame
			// was ever produced.
			expect(inst.currentFrame()).toBeUndefined();
		});
	});

	describe('render dispatch', () => {
		it('invokes render(ctx, frame) when the canvas RAF tick fires with a synthetic spectrum frame', () => {
			// Build a bare instance (no real player wiring) and exercise the
			// private tick path directly. This sidesteps the AudioContext gap
			// by short-circuiting the spectrum dep-resolution and proves the
			// render contract independently from the install pipeline.
			const renderSpy = vi.fn();
			class TestViz extends VisualizationPlugin {
				static override readonly id = 'fillz:test-viz';
				protected override render(ctx: CanvasRenderingContext2D, frame: VisualizationFrame): void {
					renderSpy(ctx, frame);
				}
			}

			const inst = new TestViz();
			const fakeFrame: VisualizationFrame = {
				frequency: new Uint8Array([10, 20, 30, 40]),
				waveform: new Uint8Array([128, 130, 126, 128]),
				time: 0,
				deltaMs: 0,
				energy: 0.42,
				bandEnergies: { bass: 0.5, mid: 0.3, treble: 0.1 },
			};

			// Plant a synthetic spectrum stub + latest-frame and a mock player
			// so `_renderTick` has everything it needs (incl. `this.emit`).
			(inst as any).player = { emit: () => {} } as any;
			(inst as any)._spectrumPlugin = { currentFrame: () => fakeFrame } as any;
			(inst as any)._latestFrame = fakeFrame;

			const fakeCanvas = document.createElement('canvas');
			fakeCanvas.width = 320;
			fakeCanvas.height = 240;
			const ctx = fakeCanvas.getContext('2d');
			expect(ctx).toBeTruthy();

			(inst as any)._renderTick(ctx!, 16.7, 1.234);

			expect(renderSpy).toHaveBeenCalledTimes(1);
			const [calledCtx, calledFrame] = renderSpy.mock.calls[0]!;
			expect(calledCtx).toBe(ctx);
			expect(calledFrame.frequency).toBe(fakeFrame.frequency);
			// Timing is overridden to the canvas-supplied values.
			expect(calledFrame.deltaMs).toBe(16.7);
			expect(calledFrame.time).toBeCloseTo(1.234);
			// And `currentFrame()` now reflects the dispatched payload.
			expect(inst.currentFrame()).toBe(calledFrame);
		});

		it('swallows render() throws so a buggy author cannot kill the canvas RAF loop', () => {
			class ThrowingViz extends VisualizationPlugin {
				static override readonly id = 'fillz:throwing-viz';
				protected override render(): void {
					throw new Error('boom');
				}
			}
			const inst = new ThrowingViz();
			const fakeFrame: VisualizationFrame = {
				frequency: new Uint8Array(0),
				waveform: new Uint8Array(0),
				time: 0,
				deltaMs: 0,
				energy: 0,
				bandEnergies: { bass: 0, mid: 0, treble: 0 },
			};
			(inst as any).player = { emit: () => {} } as any;
			(inst as any)._spectrumPlugin = { currentFrame: () => fakeFrame } as any;
			(inst as any)._latestFrame = fakeFrame;

			const fakeCanvas = document.createElement('canvas');
			const ctx = fakeCanvas.getContext('2d');
			const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			expect(() => (inst as any)._renderTick(ctx!, 16, 0)).not.toThrow();
			expect(errSpy).toHaveBeenCalled();
			errSpy.mockRestore();
		});
	});
});
