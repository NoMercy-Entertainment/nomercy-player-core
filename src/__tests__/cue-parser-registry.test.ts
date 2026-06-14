/**
 * Cue parser registry behavior — kit-default registration, resolution order,
 * consumer override.
 *
 * Spec §G / §24.7: kit-default parsers (LRC, VTT-subtitle, sprite-VTT) auto-
 * register in `setup()` AS LOW-PRIORITY entries, so consumer-supplied parsers
 * registered via `setup({ cueParsers })` win the resolution.
 */

import type { ICueParser } from '../adapters/cue-parser/ICueParser';
import type { PlayerTestInternals } from '../testing/player-test-internals';
import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitter } from '../adapters/event-bus/default';
import {
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../base-player';
import { composeMixins } from '../core/compose';

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = <HTMLElement>{};
	get id(): string { return this.playerId; }

	declare setup: (config: any) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare registerCueParser: (parser: ICueParser, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;

	constructor(id?: string | number) {
		super();
		const resolved = resolvePlayerConstructor(id, _instances, 'MockPlayer');
		if (resolved.kind === 'existing') {
			return resolved.instance as unknown as this;
		}
		initPlayerCoreState(this, { className: 'MockPlayer' });
		(this as { playerId: string }).playerId = resolved.id;
		this.container = resolved.div;
		_instances.set(resolved.id, this);
	}

	static _resetRegistry(): void {
		_instances.clear();
	}
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

function make(divId: string, opts?: any): MockPlayer {
	const div = document.createElement('div');
	div.id = divId;
	document.body.appendChild(div);
	return new MockPlayer(divId).setup(opts ?? {});
}

describe('Cue parser registry — kit defaults', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('kit auto-registers the three built-in parsers (lrc, vtt, sprite-vtt) on setup', async () => {
		const p = make('p1');
		await p.ready();
		// Indirect check: registry's `_cueParsers` field is internal but we can
		// resolve URL patterns to confirm a parser claims them.
		const reg = (p as unknown as PlayerTestInternals)._cueParsers;
		expect(reg.resolve('lyrics.lrc')?.id).toBe('lrc');
		expect(reg.resolve('subs.vtt')?.id).toBe('vtt');
		expect(reg.resolve('thumbs.sprite.vtt')?.id).toBe('sprite-vtt');
	});

	it('matches by content-type when extension is ambiguous', async () => {
		const p = make('p2');
		await p.ready();
		const reg = (p as unknown as PlayerTestInternals)._cueParsers;
		expect(reg.resolve('https://x/lyrics', 'application/x-lrc')?.id).toBe('lrc');
		expect(reg.resolve('https://x/subs', 'text/vtt')?.id).toBe('vtt');
	});

	it('consumer-supplied parser via setup() wins over a built-in for the same URL', async () => {
		const customLrc: ICueParser = {
			id: 'custom-lrc',
			canParse: (url: string) => /\.lrc(?:\?|$)/i.test(url),
			parse: () => ({ get: () => [], at: () => undefined, after: () => undefined, before: () => undefined } as any),
		};
		const p = make('p3', { cueParsers: [customLrc] });
		await p.ready();
		const reg = (p as unknown as PlayerTestInternals)._cueParsers;
		expect(reg.resolve('lyrics.lrc')?.id).toBe('custom-lrc');
	});

	it('unrecognized URL returns undefined (caller decides whether absence is an error)', async () => {
		const p = make('p4');
		await p.ready();
		const reg = (p as unknown as PlayerTestInternals)._cueParsers;
		expect(reg.resolve('https://x/something.xyz')).toBeUndefined();
	});

	it('runtime registerCueParser appends to back so latest wins', async () => {
		const p = make('p5');
		await p.ready();
		const customVtt: ICueParser = {
			id: 'late-vtt',
			canParse: (url: string) => /\.vtt(?:\?|$)/i.test(url),
			parse: () => ({ get: () => [], at: () => undefined, after: () => undefined, before: () => undefined } as any),
		};
		p.registerCueParser(customVtt);
		const reg = (p as unknown as PlayerTestInternals)._cueParsers;
		expect(reg.resolve('subs.vtt')?.id).toBe('late-vtt');
	});

	it('unregisterCueParser removes by id', async () => {
		const p = make('p6');
		await p.ready();
		const reg = (p as unknown as PlayerTestInternals)._cueParsers;
		expect(reg.resolve('lyrics.lrc')?.id).toBe('lrc');
		p.unregisterCueParser('lrc');
		expect(reg.resolve('lyrics.lrc')).toBeUndefined();
	});
});
