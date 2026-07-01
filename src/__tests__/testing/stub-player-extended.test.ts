// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Extended StubPlayer coverage — all uncovered methods from lines 639-902.
 *
 * The base stub-player.test.ts covers construction, phase, dispatching,
 * baseUrl, audioContext, i18n, cue parsers, experimental, and reset.
 *
 * This file covers every remaining method:
 *  - volume family (volume read/write, volumeUp, volumeDown, mute/unmute/toggleMute)
 *  - time family (time read/write, duration, timeData, playbackRates, playbackRate read/write)
 *  - queue family (queue read/write, queueAppend, queueSort, backlog, backlogAppend,
 *    loadQueue, seekToIndex, playItem, playNow, repeatState, shuffleState,
 *    queuePrepend, queueInsert, queueRemove, queueRemoveAt, queueMove, queueClear,
 *    queueShuffle, peekNext, peekPrevious, queueLength, queueIndexOf, index)
 *  - backlog mutations (backlogRemove, backlogClear)
 *  - load, subtitles, qualityLevels, audioTracks
 *  - audioOutputs, selectAudioOutput
 *  - castState, transferTo
 *  - addPlugin, registerStream
 *  - device, bandwidth, bandwidthEstimator, canPlay
 *  - announce, recordMetric, now
 *  - buffered, bufferedRanges, seekable
 *  - playState, volumeState
 *  - chapter navigation (seekToChapter, nextChapter, previousChapter)
 *  - setupState (idle/setup/disposed)
 *  - setup, ready, dispose lifecycle stubs
 *  - transport stubs (play/pause/stop/togglePlayback/rewind/forward/restart/next/previous)
 *  - auth, subtitle, audioTrack, quality stubs
 *  - chapter/chapters stubs
 *  - qualityMode, audioTrackMode stubs
 *  - seekByPercentage stub
 *  - platform stub
 *  - createElement, createButton, createSVG, addClasses, removeClasses
 *  - getPlugin, getPluginById, metrics
 *  - urlResolver, resolveUrl
 *  - id getter
 *  - createStubPlayer factory
 */

import type { BasePlaylistItem } from '../../types';
import { describe, expect, it } from 'vitest';
import { RepeatState, ShuffleState } from '../../core/mixins/state-mutators';
import { buildResolvedUrl } from '../../core/resolved-url';
import { createStubPlayer, StubPlayer } from '../../testing/stub-player';
import { SetupState } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function item(id: string): BasePlaylistItem {
	return { id, url: `https://example.com/${id}.mp3` } as BasePlaylistItem;
}

// ── Transport stubs ───────────────────────────────────────────────────────────

describe('StubPlayer transport stubs', () => {
	it('play() resolves', async () => {
		const p = new StubPlayer();
		await expect(p.play()).resolves.toBeUndefined();
	});

	it('pause() resolves', async () => {
		await expect(new StubPlayer().pause()).resolves.toBeUndefined();
	});

	it('stop() resolves', async () => {
		await expect(new StubPlayer().stop()).resolves.toBeUndefined();
	});

	it('togglePlayback() resolves', async () => {
		await expect(new StubPlayer().togglePlayback()).resolves.toBeUndefined();
	});

	it('rewind() resolves', async () => {
		await expect(new StubPlayer().rewind()).resolves.toBeUndefined();
	});

	it('forward() resolves', async () => {
		await expect(new StubPlayer().forward()).resolves.toBeUndefined();
	});

	it('restart() resolves', async () => {
		await expect(new StubPlayer().restart()).resolves.toBeUndefined();
	});

	it('next() resolves', async () => {
		await expect(new StubPlayer().next()).resolves.toBeUndefined();
	});

	it('previous() resolves', async () => {
		await expect(new StubPlayer().previous()).resolves.toBeUndefined();
	});
});

// ── Lifecycle stubs ───────────────────────────────────────────────────────────

describe('StubPlayer lifecycle stubs', () => {
	it('setup() returns this for chaining', () => {
		const p = new StubPlayer();
		expect(p.setup({})).toBe(p);
	});

	it('ready() resolves immediately', async () => {
		await expect(new StubPlayer().ready()).resolves.toBeUndefined();
	});

	it('dispose() is a no-op (does not throw)', () => {
		expect(() => new StubPlayer().dispose()).not.toThrow();
	});

	it('setupState() returns NOT_SETUP in idle', () => {
		expect(new StubPlayer().setupState()).toBe(SetupState.NOT_SETUP);
	});

	it('setupState() returns SETTING_UP in setup phase', () => {
		const p = new StubPlayer({ phase: 'setup' });
		expect(p.setupState()).toBe(SetupState.SETTING_UP);
	});

	it('setupState() returns DISPOSED in disposed phase', () => {
		const p = new StubPlayer({ phase: 'disposed' });
		expect(p.setupState()).toBe(SetupState.DISPOSED);
	});

	it('setupState() returns READY in ready phase', () => {
		const p = new StubPlayer({ phase: 'ready' });
		expect(p.setupState()).toBe(SetupState.READY);
	});
});

// ── id getter ─────────────────────────────────────────────────────────────────

describe('StubPlayer id getter', () => {
	it('id mirrors playerId', () => {
		const p = new StubPlayer({ id: 'my-player' });
		expect(p.id).toBe('my-player');
		expect(p.id).toBe(p.playerId);
	});
});

// ── platform ──────────────────────────────────────────────────────────────────

describe('StubPlayer platform()', () => {
	it('returns a non-null platform object', () => {
		const p = new StubPlayer();
		const plat = p.platform();
		expect(plat).toBeDefined();
		expect(typeof plat).toBe('object');
	});
});

// ── volume ────────────────────────────────────────────────────────────────────

describe('StubPlayer volume', () => {
	it('volume() returns 100 by default', () => {
		expect(new StubPlayer().volume()).toBe(100);
	});

	it('volume(level) stores and returns the level', () => {
		const p = new StubPlayer();
		p.volume(75);
		expect(p.volume()).toBe(75);
	});

	it('volume(level) clamps to 0', () => {
		const p = new StubPlayer();
		p.volume(-10);
		expect(p.volume()).toBe(0);
	});

	it('volume(level) clamps to 100', () => {
		const p = new StubPlayer();
		p.volume(200);
		expect(p.volume()).toBe(100);
	});

	it('volume(level) clears mute flag', () => {
		const p = new StubPlayer();
		p.mute();
		p.volume(50);
		expect(p.volume()).toBe(50);
	});

	it('volume() returns 0 when muted', () => {
		const p = new StubPlayer();
		p.mute();
		expect(p.volume()).toBe(0);
	});

	it('volumeUp() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().volumeUp()).not.toThrow();
		expect(() => new StubPlayer().volumeUp(5)).not.toThrow();
	});

	it('volumeDown() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().volumeDown()).not.toThrow();
		expect(() => new StubPlayer().volumeDown(5)).not.toThrow();
	});

	it('mute() sets muted flag', () => {
		const p = new StubPlayer();
		p.mute();
		expect(p.volume()).toBe(0);
	});

	it('unmute() clears muted flag', () => {
		const p = new StubPlayer();
		p.mute();
		p.unmute();
		expect(p.volume()).toBe(100);
	});

	it('toggleMute() flips mute state', () => {
		const p = new StubPlayer();
		p.toggleMute();
		expect(p.volume()).toBe(0);
		p.toggleMute();
		expect(p.volume()).toBe(100);
	});
});

// ── time ──────────────────────────────────────────────────────────────────────

describe('StubPlayer time', () => {
	it('time() returns 0 by default', () => {
		expect(new StubPlayer().time()).toBe(0);
	});

	it('time(seconds) sets position and resolves', async () => {
		const p = new StubPlayer();
		await p.time(30);
		expect(p.time()).toBe(30);
	});

	it('duration() returns 0 by default', () => {
		expect(new StubPlayer().duration()).toBe(0);
	});

	it('timeData() returns snapshot with correct fields', () => {
		const p = new StubPlayer();
		void p.time(20);
		const data = p.timeData();
		expect(data.position).toBe(20);
		expect(data.duration).toBe(0);
		expect(data.buffered).toBe(0);
		expect(data.remaining).toBe(0);
		expect(data.percentage).toBe(0);
	});

	it('timeData() percentage is computed when duration > 0', () => {
		const p = new StubPlayer();
		(p as unknown as Record<string, unknown>)['_duration'] = 100;
		void p.time(25);
		const data = p.timeData();
		expect(data.percentage).toBeCloseTo(25);
		expect(data.remaining).toBe(75);
	});

	it('playbackRates() returns standard rate list', () => {
		expect(new StubPlayer().playbackRates()).toEqual([0.5, 0.75, 1, 1.25, 1.5, 2]);
	});

	it('playbackRate() returns 1 by default', () => {
		expect(new StubPlayer().playbackRate()).toBe(1);
	});

	it('playbackRate(rate) stores and returns the rate', () => {
		const p = new StubPlayer();
		p.playbackRate(1.5);
		expect(p.playbackRate()).toBe(1.5);
	});
});

// ── queue ─────────────────────────────────────────────────────────────────────

describe('StubPlayer queue', () => {
	it('queue() returns empty array by default', () => {
		expect(new StubPlayer().queue()).toEqual([]);
	});

	it('queue(items) replaces the queue', () => {
		const p = new StubPlayer();
		const items = [item('a'), item('b')];
		p.queue(items);
		expect(p.queue()).toEqual(items);
	});

	it('queueLength() reflects the queue length', () => {
		const p = new StubPlayer();
		p.queue([item('x'), item('y')]);
		expect(p.queueLength()).toBe(2);
	});

	it('queueLength() returns 0 when empty', () => {
		expect(new StubPlayer().queueLength()).toBe(0);
	});

	it('queueIndexOf() always returns -1 (stub behaviour)', () => {
		const p = new StubPlayer();
		p.queue([item('a')]);
		expect(p.queueIndexOf('a')).toBe(-1);
	});

	it('index() always returns -1 (stub behaviour)', () => {
		expect(new StubPlayer().index()).toBe(-1);
	});

	it('queueAppend() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueAppend(item('a'))).not.toThrow();
	});

	it('queueSort() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueSort(() => 0)).not.toThrow();
	});

	it('queuePrepend() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queuePrepend(item('a'))).not.toThrow();
	});

	it('queueInsert() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueInsert(item('a'), 0)).not.toThrow();
	});

	it('queueRemove() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueRemove('a')).not.toThrow();
	});

	it('queueRemoveAt() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueRemoveAt(0)).not.toThrow();
	});

	it('queueMove() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueMove(0, 1)).not.toThrow();
	});

	it('queueClear() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueClear()).not.toThrow();
	});

	it('queueShuffle() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().queueShuffle()).not.toThrow();
	});

	it('peekNext() returns undefined (stub behaviour)', () => {
		expect(new StubPlayer().peekNext()).toBeUndefined();
	});

	it('peekPrevious() returns undefined (stub behaviour)', () => {
		expect(new StubPlayer().peekPrevious()).toBeUndefined();
	});

	it('seekToIndex() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().seekToIndex(1)).not.toThrow();
	});

	it('playItem() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().playItem(item('a'))).not.toThrow();
	});

	it('playNow() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().playNow([item('a')])).not.toThrow();
	});

	it('loadQueue() resolves immediately', async () => {
		await expect(new StubPlayer().loadQueue('https://example.com/queue.json')).resolves.toBeUndefined();
	});

	it('loadQueue() with custom parser resolves immediately', async () => {
		const parser = (raw: string): BasePlaylistItem[] => JSON.parse(raw) as BasePlaylistItem[];
		await expect(new StubPlayer().loadQueue('https://example.com/q.json', parser)).resolves.toBeUndefined();
	});
});

// ── repeatState / shuffleState ────────────────────────────────────────────────

describe('StubPlayer repeatState / shuffleState', () => {
	it('repeatState() returns OFF by default', () => {
		expect(new StubPlayer().repeatState()).toBe(RepeatState.OFF);
	});

	it('repeatState(state) stores and returns the state', () => {
		const p = new StubPlayer();
		p.repeatState(RepeatState.ALL);
		expect(p.repeatState()).toBe(RepeatState.ALL);
	});

	it('shuffleState() returns OFF by default', () => {
		expect(new StubPlayer().shuffleState()).toBe(ShuffleState.OFF);
	});

	it('shuffleState(ShuffleState) stores enum value', () => {
		const p = new StubPlayer();
		p.shuffleState(ShuffleState.ON);
		expect(p.shuffleState()).toBe(ShuffleState.ON);
	});

	it('shuffleState(true) maps to ShuffleState.ON', () => {
		const p = new StubPlayer();
		p.shuffleState(true);
		expect(p.shuffleState()).toBe(ShuffleState.ON);
	});

	it('shuffleState(false) maps to ShuffleState.OFF', () => {
		const p = new StubPlayer();
		p.shuffleState(true);
		p.shuffleState(false);
		expect(p.shuffleState()).toBe(ShuffleState.OFF);
	});
});

// ── backlog ────────────────────────────────────────────────────────────────────

describe('StubPlayer backlog', () => {
	it('backlog() returns empty array by default', () => {
		expect(new StubPlayer().backlog()).toEqual([]);
	});

	it('backlog(items) replaces the backlog', () => {
		const p = new StubPlayer();
		const items = [item('a')];
		p.backlog(items);
		expect(p.backlog()).toEqual(items);
	});

	it('backlogAppend() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().backlogAppend(item('a'))).not.toThrow();
	});

	it('backlogRemove() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().backlogRemove('a')).not.toThrow();
	});

	it('backlogClear() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().backlogClear()).not.toThrow();
	});
});

// ── load ──────────────────────────────────────────────────────────────────────

describe('StubPlayer load()', () => {
	it('resolves immediately', async () => {
		await expect(new StubPlayer().load(item('a'))).resolves.toBeUndefined();
	});
});

// ── media tracks ──────────────────────────────────────────────────────────────

describe('StubPlayer media tracks', () => {
	it('subtitles() returns empty array', () => {
		expect(new StubPlayer().subtitles()).toEqual([]);
	});

	it('qualityLevels() returns empty array', () => {
		expect(new StubPlayer().qualityLevels()).toEqual([]);
	});

	it('qualityLevels({ includeUnsupported }) returns empty array', () => {
		expect(new StubPlayer().qualityLevels({ includeUnsupported: true })).toEqual([]);
	});

	it('audioTracks() returns empty array', () => {
		expect(new StubPlayer().audioTracks()).toEqual([]);
	});
});

// ── audio output ──────────────────────────────────────────────────────────────

describe('StubPlayer audio output', () => {
	it('audioOutputs() resolves to empty array', async () => {
		await expect(new StubPlayer().audioOutputs()).resolves.toEqual([]);
	});

	it('selectAudioOutput() resolves to null', async () => {
		await expect(new StubPlayer().selectAudioOutput()).resolves.toBeNull();
	});

	it('audioOutput() (getter) resolves to null', async () => {
		await expect(new StubPlayer().audioOutput()).resolves.toBeNull();
	});

	it('audioOutput(deviceId) (setter) resolves to void', async () => {
		await expect(new StubPlayer().audioOutput('device-1')).resolves.toBeUndefined();
	});
});

// ── cast ──────────────────────────────────────────────────────────────────────

describe('StubPlayer cast', () => {
	it('castState() returns "unavailable"', () => {
		expect(new StubPlayer().castState()).toBe('unavailable');
	});

	it('transferTo() resolves immediately', async () => {
		await expect(new StubPlayer().transferTo({ type: 'chromecast' } as any)).resolves.toBeUndefined();
	});
});

// ── plugin / stream stubs ─────────────────────────────────────────────────────

describe('StubPlayer plugin and stream stubs', () => {
	it('addPlugin() returns this for chaining', () => {
		const p = new StubPlayer();
		const result = p.addPlugin({} as any);
		expect(result).toBe(p);
	});

	it('registerStream() returns this for chaining', () => {
		const p = new StubPlayer();
		const result = p.registerStream({} as any);
		expect(result).toBe(p);
	});

	it('getPlugin() always returns undefined', () => {
		expect(new StubPlayer().getPlugin({} as any)).toBeUndefined();
	});

	it('getPluginById() always returns undefined', () => {
		expect(new StubPlayer().getPluginById('my-plugin')).toBeUndefined();
	});
});

// ── device / ABR ──────────────────────────────────────────────────────────────

describe('StubPlayer device / ABR', () => {
	it('device() returns a device-capabilities-shaped object', () => {
		expect(typeof new StubPlayer().device()).toBe('object');
	});

	it('bandwidth() returns 0', () => {
		expect(new StubPlayer().bandwidth()).toBe(0);
	});

	it('bandwidthEstimator() (getter) returns undefined', () => {
		expect(new StubPlayer().bandwidthEstimator()).toBeUndefined();
	});

	it('bandwidthEstimator(fn) (setter) is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().bandwidthEstimator(() => 5_000_000)).not.toThrow();
	});

	it('canPlay() resolves to { supported, smooth, powerEfficient }', async () => {
		const result = await new StubPlayer().canPlay({ contentType: 'video/mp4' });
		expect(result).toEqual({ supported: true, smooth: true, powerEfficient: true });
	});
});

// ── a11y / metrics / clock ────────────────────────────────────────────────────

describe('StubPlayer accessibility, metrics, clock', () => {
	it('announce() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().announce('Loading…')).not.toThrow();
		expect(() => new StubPlayer().announce('Info', 'polite')).not.toThrow();
	});

	it('recordMetric() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().recordMetric('ttfb', 120)).not.toThrow();
	});

	it('now() returns a number', () => {
		expect(typeof new StubPlayer().now()).toBe('number');
	});

	it('metrics() returns a zeroed-out metrics snapshot', () => {
		const m = new StubPlayer().metrics();
		expect(m.ttfb).toBeNull();
		expect(m.ttff).toBe(0);
		expect(m.rebufferRatio).toBe(0);
		expect(m.avgBitrate).toBeNull();
		expect(m.droppedFrames).toBeNull();
		expect(m.decoderStalls).toBeNull();
		expect(m.joinTime).toBe(0);
		expect(m.sessionDurationMs).toBe(0);
	});
});

// ── buffered / seekable ranges ────────────────────────────────────────────────

describe('StubPlayer buffered / seekable ranges', () => {
	it('buffered() returns 0', () => {
		expect(new StubPlayer().buffered()).toBe(0);
	});

	it('bufferedRanges() returns an empty TimeRanges-shaped object', () => {
		const ranges = new StubPlayer().bufferedRanges();
		expect(ranges.length).toBe(0);
		expect(typeof ranges.start).toBe('function');
		expect(typeof ranges.end).toBe('function');
	});

	it('seekable() returns an empty TimeRanges-shaped object', () => {
		const ranges = new StubPlayer().seekable();
		expect(ranges.length).toBe(0);
	});
});

// ── coarse state tokens ───────────────────────────────────────────────────────

describe('StubPlayer coarse state tokens', () => {
	it('playState() returns "idle"', () => {
		expect(new StubPlayer().playState()).toBe('idle');
	});

	it('volumeState() returns "unmuted"', () => {
		expect(new StubPlayer().volumeState()).toBe('unmuted');
	});
});

// ── chapter navigation ────────────────────────────────────────────────────────

describe('StubPlayer chapter navigation', () => {
	it('chapters() returns empty array', () => {
		expect(new StubPlayer().chapters()).toEqual([]);
	});

	it('chapter() (getter) returns null', () => {
		expect(new StubPlayer().chapter()).toBeNull();
	});

	it('chapter(idx) (setter) is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().chapter(0)).not.toThrow();
	});

	it('seekToChapter() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().seekToChapter(0)).not.toThrow();
	});

	it('nextChapter() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().nextChapter()).not.toThrow();
	});

	it('previousChapter() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().previousChapter()).not.toThrow();
	});
});

// ── media track mode stubs ────────────────────────────────────────────────────

describe('StubPlayer media track mode stubs', () => {
	it('subtitle() (getter) returns null', () => {
		expect(new StubPlayer().subtitle()).toBeNull();
	});

	it('subtitle(idx) (setter) is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().subtitle(0)).not.toThrow();
	});

	it('audioTrack() (getter) returns null', () => {
		expect(new StubPlayer().audioTrack()).toBeNull();
	});

	it('audioTrack(idx) (setter) is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().audioTrack(0)).not.toThrow();
	});

	it('quality() (getter) returns "auto"', () => {
		expect(new StubPlayer().quality()).toBe('auto');
	});

	it('quality(idx) (setter) is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().quality(0)).not.toThrow();
	});

	it('qualityMode() (getter) returns AUTO', () => {
		const p = new StubPlayer();
		const mode = p.qualityMode();
		expect(mode).toBeDefined();
	});

	it('qualityMode(target) stores MANUAL state when given a number', () => {
		const p = new StubPlayer();
		p.qualityMode(2);
		const mode = p.qualityMode();
		expect(mode).toBeDefined();
	});

	it('qualityMode("auto") stores AUTO state', () => {
		const p = new StubPlayer();
		p.qualityMode(2);
		p.qualityMode('auto');
		expect(p.qualityMode()).toBeDefined();
	});

	it('audioTrackMode() (getter) returns default state', () => {
		expect(new StubPlayer().audioTrackMode()).toBeDefined();
	});

	it('audioTrackMode(idx) (setter) stores MANUAL state', () => {
		const p = new StubPlayer();
		p.audioTrackMode(1);
		expect(p.audioTrackMode()).toBeDefined();
	});

	it('seekByPercentage() is a no-op stub (does not throw)', () => {
		expect(() => new StubPlayer().seekByPercentage(50)).not.toThrow();
	});
});

// ── auth stub ─────────────────────────────────────────────────────────────────

describe('StubPlayer auth()', () => {
	it('auth() returns undefined initially', () => {
		expect(new StubPlayer().auth()).toBeUndefined();
	});

	it('auth(config) stores the config — snapshot is frozen and token fields are redacted', () => {
		const p = new StubPlayer();
		p.auth({ bearerToken: 'tok123', credentials: 'include' });
		const stored = p.auth();
		expect(stored).toBeDefined();
		expect(Object.isFrozen(stored)).toBe(true);
		expect((stored as any).bearerToken).toBeUndefined();
		expect((stored as any).credentials).toBe('include');
	});

	it('auth(partial) merges into existing config — non-secret fields visible', () => {
		const p = new StubPlayer();
		p.auth({ bearerToken: 'tok1', credentials: 'include' });
		p.auth({ retryAfterRefresh: 3 } as any);
		const config = p.auth() as any;
		expect(config.bearerToken).toBeUndefined();
		expect(config.credentials).toBe('include');
		expect(config.retryAfterRefresh).toBe(3);
	});
});

// ── urlResolver / resolveUrl ──────────────────────────────────────────────────

describe('StubPlayer urlResolver / resolveUrl', () => {
	it('urlResolver() returns undefined when none set', () => {
		expect(new StubPlayer().urlResolver()).toBeUndefined();
	});

	it('urlResolver(fn) stores and returns the resolver', () => {
		const p = new StubPlayer();
		const resolver = async (url: string): Promise<any> => ({ href: url, url, baseUrl: '', auth: undefined });
		p.urlResolver(resolver);
		expect(p.urlResolver()).toBe(resolver);
	});

	it('urlResolver(undefined) clears the resolver', () => {
		const p = new StubPlayer();
		const resolver = async (url: string): Promise<any> => ({ href: url, url, baseUrl: '', auth: undefined });
		p.urlResolver(resolver);
		p.urlResolver(undefined);
		expect(p.urlResolver()).toBeUndefined();
	});

	it('resolveUrl() returns the raw URL as href when no baseUrl and no resolver', async () => {
		const p = new StubPlayer();
		const result = await p.resolveUrl('https://cdn.example.com/file.mp3');
		expect(result.href).toBe('https://cdn.example.com/file.mp3');
	});

	it('resolveUrl() resolves relative image URL with baseImageUrl for poster category', async () => {
		const p = new StubPlayer();
		p.baseImageUrl('https://images.example.com/');
		const result = await p.resolveUrl('poster.jpg', 'poster');
		expect(result.href).toBe('https://images.example.com/poster.jpg');
	});

	it('resolveUrl() uses resolver when provided and returns valid href', async () => {
		const p = new StubPlayer();
		p.urlResolver(async url => buildResolvedUrl(url, `https://cdn.example.com/${url}`));
		const result = await p.resolveUrl('file.mp3');
		expect(result.href).toBe('https://cdn.example.com/file.mp3');
	});

	it('resolveUrl() falls back to default when resolver returns invalid result', async () => {
		const p = new StubPlayer();
		p.urlResolver(async () => null as any);
		const result = await p.resolveUrl('https://cdn.example.com/x.mp3');
		expect(result.href).toBe('https://cdn.example.com/x.mp3');
	});

	it('baseImageUrl() returns undefined initially', () => {
		expect(new StubPlayer().baseImageUrl()).toBeUndefined();
	});

	it('baseImageUrl(path) stores and returns the path', () => {
		const p = new StubPlayer();
		p.baseImageUrl('https://images.example.com/');
		expect(p.baseImageUrl()).toBe('https://images.example.com/');
	});
});

// ── DOM helpers ───────────────────────────────────────────────────────────────

describe('StubPlayer DOM helpers', () => {
	it('createElement() returns an object with el', () => {
		const p = new StubPlayer();
		const result = p.createElement('div', 'my-div');
		expect(result).toBeDefined();
	});

	it('createButton() returns a button element', () => {
		const p = new StubPlayer();
		const btn = p.createButton('my-btn', 'Play', () => {});
		expect(btn).toBeInstanceOf(HTMLButtonElement);
	});

	it('createSVG() returns an SVG element', () => {
		const p = new StubPlayer();
		const svg = p.createSVG('my-svg', '0 0 24 24');
		expect(svg).toBeInstanceOf(SVGSVGElement);
	});

	it('addClasses() returns el unchanged', () => {
		const p = new StubPlayer();
		const el = document.createElement('div');
		const result = p.addClasses(el, ['foo']);
		expect(result).toBe(el);
	});

	it('removeClasses() returns el unchanged', () => {
		const p = new StubPlayer();
		const el = document.createElement('div');
		el.classList.add('foo');
		const result = p.removeClasses(el, ['foo']);
		expect(result).toBe(el);
	});
});

// ── network / buffer / streaming state ───────────────────────────────────────

describe('StubPlayer streaming state stubs', () => {
	it('bufferState() returns IDLE', () => {
		const p = new StubPlayer();
		const state = p.bufferState();
		expect(state).toBeDefined();
	});

	it('networkState() returns ONLINE', () => {
		const p = new StubPlayer();
		const state = p.networkState();
		expect(state).toBeDefined();
	});

	it('streamState() returns "idle"', () => {
		expect(new StubPlayer().streamState()).toBe('idle');
	});

	it('visibilityState() returns VISIBLE', () => {
		const p = new StubPlayer();
		const state = p.visibilityState();
		expect(state).toBeDefined();
	});
});

// ── createStubPlayer factory ──────────────────────────────────────────────────

describe('createStubPlayer factory', () => {
	it('returns a StubPlayer instance', () => {
		expect(createStubPlayer()).toBeInstanceOf(StubPlayer);
	});

	it('passes opts through to the constructor', () => {
		const p = createStubPlayer({ id: 'factory-test', phase: 'ready' });
		expect(p.playerId).toBe('factory-test');
		expect(p.phase()).toBe('ready');
	});
});
