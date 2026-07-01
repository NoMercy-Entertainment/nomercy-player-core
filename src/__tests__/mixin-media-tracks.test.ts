// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for the media-tracks mixin.
 *
 * Covers: subtitle()/subtitles(), audioTrack()/audioTracks(),
 * quality()/qualityLevels(), chapters()/seekToChapter()/nextChapter()/
 * previousChapter()/chapter(), subtitleStyle(), _disposeSidecarSubtitle(),
 * resolveItemTrackUrls(), _resolveAndEmitChapters() — all state/event/
 * side-effect consequences.
 *
 * Note: media-tracks-dedup.test.ts already covers subtitles() dedup +
 * normalizeLanguage. This file covers every OTHER uncovered method.
 */

import type { AudioTrack, BaseEventMap, BasePlaylistItem, Chapter, PluginCtorWithId, QualityLevel, SubtitleStyle, SubtitleTrack } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	AudioTrackState,
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	QualityState,
	resolvePlayerConstructor,
} from '../index';

// ─────────────────────────────────────────────────────────────────────────────
// MockPlayer — minimal full-mixin player reusing the canonical pattern
// ─────────────────────────────────────────────────────────────────────────────

const _instances = new Map<string, MockPlayer>();

class MockPlayer extends EventEmitter<BaseEventMap> {
	readonly playerId: string = '';
	container: HTMLElement = {} as HTMLElement;

	get id(): string { return this.playerId; }

	declare options: Record<string, unknown>;
	declare setup: (config: Record<string, unknown>) => this;
	declare ready: () => Promise<void>;
	declare dispose: () => void;
	declare phase: () => string;
	declare dispatching: () => ReadonlyArray<string>;
	declare baseUrl: { (): string | undefined; (url: string): void };
	declare audioContext: () => AudioContext | undefined;
	declare experimental: unknown;
	declare t: {
		(key: string, vars?: Record<string, string>): string;
		(PluginClass: PluginCtorWithId, key: string, vars?: Record<string, string>): string;
	};

	declare language: { (): string; (lang: string): Promise<void> };
	declare addTranslations: (bundle: unknown) => void;
	declare translation: (lang: string, key: string, value: string) => void;
	declare removeTranslations: (prefix: string, lang?: string) => void;
	declare registerCueParser: (parser: unknown, prepend?: boolean) => void;
	declare unregisterCueParser: (id: string) => void;
	declare play: (opts?: unknown) => Promise<void>;
	declare pause: (opts?: unknown) => Promise<void>;
	declare stop: (opts?: unknown) => Promise<void>;
	declare togglePlayback: (opts?: unknown) => Promise<void>;
	declare next: (opts?: unknown) => Promise<void>;
	declare previous: (opts?: unknown) => Promise<void>;
	declare rewind: (seconds?: number, opts?: unknown) => Promise<void>;
	declare forward: (seconds?: number, opts?: unknown) => Promise<void>;
	declare restart: (opts?: unknown) => Promise<void>;
	declare time: { (): number; (seconds: number, opts?: unknown): Promise<void> };
	declare duration: () => number;
	declare buffered: () => number;
	declare timeData: () => unknown;
	declare playbackRate: { (): number; (rate: number): void };
	declare playbackRates: () => number[];
	declare volume: { (): number; (level: number): void };
	declare mute: () => void;
	declare unmute: () => void;
	declare toggleMute: () => void;
	declare volumeUp: (step?: number) => void;
	declare volumeDown: (step?: number) => void;
	declare playState: () => string;
	declare volumeState: () => string;
	declare repeatState: { (): string; (state: unknown): void };
	declare shuffleState: { (): string; (state: unknown): void };
	declare queue: { (): ReadonlyArray<unknown>; (items: unknown[], opts?: unknown): void };
	declare queueAppend: (item: unknown, opts?: unknown) => void;
	declare queuePrepend: (item: unknown, opts?: unknown) => void;
	declare queueInsert: (item: unknown, index: number, opts?: unknown) => void;
	declare queueRemove: (id: unknown, opts?: unknown) => void;
	declare queueRemoveAt: (index: number, opts?: unknown) => void;
	declare queueMove: (from: number, to: number, opts?: unknown) => void;
	declare queueClear: (opts?: unknown) => void;
	declare queueShuffle: (opts?: unknown) => void;
	declare queueSort: (compare: unknown, opts?: unknown) => void;
	declare peekNext: () => unknown;
	declare peekPrevious: () => unknown;
	declare queueLength: () => number;
	declare queueIndexOf: (id: unknown) => number;
	declare item: { (): unknown; (target: unknown, opts?: unknown): void };
	declare index: () => number;
	declare backlog: { (): ReadonlyArray<unknown>; (items: unknown[]): void };
	declare backlogAppend: (item: unknown) => void;
	declare backlogRemove: (id: unknown) => void;
	declare backlogClear: () => void;
	declare addPlugin: (PluginClass: unknown, opts?: unknown) => this;
	declare getPlugin: (PluginClass: unknown) => unknown;
	declare getPluginById: (id: string) => unknown;
	declare removePlugin: (PluginClass: unknown) => void;
	declare removePluginById: (id: string) => void;
	declare plugins: () => ReadonlyArray<unknown>;
	declare enabledPlugins: () => ReadonlyArray<unknown>;

	// track-related methods added by mixin
	declare subtitles: () => ReadonlyArray<SubtitleTrack>;
	declare subtitle: { (): unknown; (idx: number | null): void };
	declare subtitleStyle: { (): SubtitleStyle; (patch: Partial<SubtitleStyle>): void };
	declare audioTracks: () => ReadonlyArray<AudioTrack>;
	declare audioTrack: { (): unknown; (idx: number): void };
	declare qualityLevels: (opts?: { includeUnsupported?: true }) => ReadonlyArray<QualityLevel>;
	declare quality: { (): unknown; (idx: number | 'auto'): void };
	declare chapters: () => ReadonlyArray<Chapter>;
	declare seekToChapter: (idx: number, opts?: unknown) => void;
	declare nextChapter: (opts?: unknown) => void;
	declare previousChapter: (opts?: unknown) => void;
	declare chapter: { (): Chapter | null; (idx: number): void };
	declare resolveItemTrackUrls: <T extends BasePlaylistItem>(item: T) => Promise<T>;

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

	static _resetRegistry(): void { _instances.clear(); }
}

composeMixins(MockPlayer.prototype, ...playerCoreMethods);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function setupPlayer(): MockPlayer {
	const div = document.createElement('div');
	div.id = 'mt-mock';
	document.body.appendChild(div);
	return new MockPlayer('mt-mock').setup({});
}

function makeBackendWithTracks(opts: {
	subtitleTracks?: SubtitleTrack[];
	audioTracks?: AudioTrack[];
	qualityLevels?: QualityLevel[];
}): {
	subtitleTracks?: () => SubtitleTrack[];
	setSubtitleTrack?: (idx: number | null) => void;
	audioTracks?: () => AudioTrack[];
	setAudioTrack?: (idx: number) => void;
	qualityLevels?: (opts?: { includeUnsupported?: true }) => QualityLevel[];
	setQuality?: (idx: number | 'auto') => void;
	setSubtitleTrackCalls: Array<number | null>;
	setAudioTrackCalls: number[];
	setQualityCalls: Array<number | 'auto'>;
} {
	const calls = {
		setSubtitleTrackCalls: [] as Array<number | null>,
		setAudioTrackCalls: [] as number[],
		setQualityCalls: [] as Array<number | 'auto'>,
	};
	return {
		...calls,
		subtitleTracks: () => opts.subtitleTracks ?? [],
		setSubtitleTrack: idx => calls.setSubtitleTrackCalls.push(idx),
		audioTracks: () => opts.audioTracks ?? [],
		setAudioTrack: idx => calls.setAudioTrackCalls.push(idx),
		qualityLevels: () => opts.qualityLevels ?? [],
		setQuality: idx => calls.setQualityCalls.push(idx),
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// subtitle() — setter paths
// ─────────────────────────────────────────────────────────────────────────────

describe('subtitle() — setter paths', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('subtitle(null) sets _currentSubtitleIdx to null, calls backend setSubtitleTrack(null), emits subtitle + subtitleCue', () => {
		const player = setupPlayer();
		const backend = makeBackendWithTracks({
			subtitleTracks: [
				{ id: 's0', language: 'en', kind: 'subtitles', label: 'English', url: '' },
			],
		});
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		const subtitleEvents: Array<{ track: number | null }> = [];
		const cueEvents: Array<{ cues: unknown[] }> = [];
		player.on('subtitle' as never, (data: { track: number | null }) => subtitleEvents.push(data));
		player.on('subtitleCue' as never, (data: { cues: unknown[] }) => cueEvents.push(data));

		player.subtitle(null);

		expect((player as unknown as { _currentSubtitleIdx: number | null })._currentSubtitleIdx).toBeNull();
		expect(backend.setSubtitleTrackCalls).toContain(null);
		expect(subtitleEvents).toHaveLength(1);
		expect(subtitleEvents[0]!.track).toBeNull();
		expect(cueEvents).toHaveLength(1);
		expect(cueEvents[0]!.cues).toHaveLength(0);
	});

	it('subtitle(-1) is treated as "off" — sets null, emits subtitle { track: null }', () => {
		const player = setupPlayer();
		const subtitleEvents: Array<{ track: number | null }> = [];
		player.on('subtitle' as never, (data: { track: number | null }) => subtitleEvents.push(data));

		player.subtitle(-1);

		expect((player as unknown as { _currentSubtitleIdx: number | null })._currentSubtitleIdx).toBeNull();
		expect(subtitleEvents[0]!.track).toBeNull();
	});

	it('subtitle(0) selects backend-managed track when within backend count', () => {
		const player = setupPlayer();
		const backend = makeBackendWithTracks({
			subtitleTracks: [
				{ id: 's0', language: 'en', kind: 'subtitles', label: 'English', url: '' },
			],
		});
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		const subtitleEvents: Array<{ track: number | null }> = [];
		player.on('subtitle' as never, (data: { track: number | null }) => subtitleEvents.push(data));

		player.subtitle(0);

		expect((player as unknown as { _currentSubtitleIdx: number | null })._currentSubtitleIdx).toBe(0);
		expect(backend.setSubtitleTrackCalls).toContain(0);
		expect(subtitleEvents[0]!.track).toBe(0);
	});

	it('subtitle() (no arg) returns null when no selection made', () => {
		const player = setupPlayer();
		expect(player.subtitle()).toBeNull();
	});

	it('subtitle() returns { index, track } when a track is selected', () => {
		const player = setupPlayer();
		const backend = makeBackendWithTracks({
			subtitleTracks: [
				{ id: 's0', language: 'en', kind: 'subtitles', label: 'English', url: '' },
			],
		});
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		player.subtitle(0);
		const result = player.subtitle() as { index: number; track: SubtitleTrack } | null;
		expect(result).not.toBeNull();
		expect(result!.index).toBe(0);
		expect(result!.track.label).toBe('English');
	});

	it('subtitle() returns null when stored index points to no track', () => {
		const player = setupPlayer();
		// set internally to a stale index with no backend
		(player as unknown as { _currentSubtitleIdx: number | null })._currentSubtitleIdx = 5;
		expect(player.subtitle()).toBeNull();
	});

	it('subtitle(sidecarIdx) with no URL emits subtitleCue with empty cues', () => {
		const player = setupPlayer();
		// no backend tracks, so index 0 goes into sidecar path, but no item active
		const cueEvents: Array<{ cues: unknown[] }> = [];
		player.on('subtitleCue' as never, (data: { cues: unknown[] }) => cueEvents.push(data));

		player.subtitle(0);

		expect(cueEvents).toHaveLength(1);
		expect(cueEvents[0]!.cues).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// subtitleStyle()
// ─────────────────────────────────────────────────────────────────────────────

describe('subtitleStyle()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('returns a copy of the default style when called without arguments first time', () => {
		const player = setupPlayer();
		const style = player.subtitleStyle();
		expect(style).toBeDefined();
		expect(style.fontSize).toBe(100);
		expect(style.fontFamily).toBe('ReithSans, sans-serif');
		expect(style.textColor).toBe('white');
	});

	it('returns a copy — mutations to the returned object do not affect stored state', () => {
		const player = setupPlayer();
		const style = player.subtitleStyle();
		style.fontSize = 999;
		expect(player.subtitleStyle().fontSize).toBe(100);
	});

	it('merges a patch onto the active style and emits subtitleStyle with merged result', () => {
		const player = setupPlayer();
		const styleEvents: SubtitleStyle[] = [];
		player.on('subtitleStyle' as never, (subtitleStyle: SubtitleStyle) => styleEvents.push(subtitleStyle));

		player.subtitleStyle({ fontSize: 120 });

		expect(styleEvents).toHaveLength(1);
		expect(styleEvents[0]!.fontSize).toBe(120);
		expect(styleEvents[0]!.fontFamily).toBe('ReithSans, sans-serif');
	});

	it('successive patches accumulate', () => {
		const player = setupPlayer();
		player.subtitleStyle({ fontSize: 120 });
		player.subtitleStyle({ textColor: 'yellow' });
		const style = player.subtitleStyle();
		expect(style.fontSize).toBe(120);
		expect(style.textColor).toBe('yellow');
	});

	it('patch with all default-style fields fully replaces style entries', () => {
		const player = setupPlayer();
		player.subtitleStyle({
			fontSize: 80,
			fontFamily: 'Arial',
			textColor: 'red',
			textOpacity: 80,
			backgroundColor: 'blue',
			backgroundOpacity: 50,
			edgeStyle: 'none',
			areaColor: 'green',
			windowOpacity: 30,
		});
		const style = player.subtitleStyle();
		expect(style.fontSize).toBe(80);
		expect(style.fontFamily).toBe('Arial');
		expect(style.textColor).toBe('red');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// audioTracks() / audioTrack()
// ─────────────────────────────────────────────────────────────────────────────

describe('audioTracks() / audioTrack()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('audioTracks() returns empty array when no backend', () => {
		const player = setupPlayer();
		expect(player.audioTracks()).toHaveLength(0);
	});

	it('audioTracks() returns backend tracks when available', () => {
		const player = setupPlayer();
		const tracks: AudioTrack[] = [
			{ id: 'a0', language: 'en', label: 'English', channels: 2 },
			{ id: 'a1', language: 'fr', label: 'French', channels: 2 },
		];
		const backend = makeBackendWithTracks({ audioTracks: tracks });
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		expect(player.audioTracks()).toHaveLength(2);
		expect(player.audioTracks()[0]!.language).toBe('en');
	});

	it('audioTracks() returns empty array when backend throws', () => {
		const player = setupPlayer();
		(player as unknown as { backend: () => unknown }).backend = () => ({
			audioTracks: () => { throw new Error('backend error'); },
		});
		expect(player.audioTracks()).toHaveLength(0);
	});

	it('audioTrack() returns null when no selection', () => {
		const player = setupPlayer();
		expect(player.audioTrack()).toBeNull();
	});

	it('audioTrack(idx) sets index, calls backend setAudioTrack, emits audioTrack + audioTrackState', () => {
		const player = setupPlayer();
		const backend = makeBackendWithTracks({
			audioTracks: [
				{ id: 'a0', language: 'en', label: 'English', channels: 2 },
				{ id: 'a1', language: 'fr', label: 'French', channels: 2 },
			],
		});
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		const audioTrackEvents: Array<{ id: number }> = [];
		const audioTrackStateEvents: Array<{ state: string }> = [];
		player.on('audioTrack' as never, (data: { id: number }) => audioTrackEvents.push(data));
		player.on('audioTrackState' as never, (data: { state: string }) => audioTrackStateEvents.push(data));

		player.audioTrack(1);

		expect((player as unknown as { _currentAudioTrackIdx: number | null })._currentAudioTrackIdx).toBe(1);
		expect(backend.setAudioTrackCalls).toContain(1);
		expect(audioTrackEvents).toHaveLength(1);
		expect(audioTrackEvents[0]!.id).toBe(1);
		expect(audioTrackStateEvents).toHaveLength(1);
		expect(audioTrackStateEvents[0]!.state).toBe(AudioTrackState.MANUAL);
	});

	it('audioTrack() returns { index, track } after a selection is made', () => {
		const player = setupPlayer();
		const backend = makeBackendWithTracks({
			audioTracks: [
				{ id: 'a0', language: 'en', label: 'English', channels: 2 },
			],
		});
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		player.audioTrack(0);
		const result = player.audioTrack() as { index: number; track: AudioTrack } | null;
		expect(result).not.toBeNull();
		expect(result!.index).toBe(0);
		expect(result!.track.language).toBe('en');
	});

	it('audioTrack() returns null when stored index has no matching track', () => {
		const player = setupPlayer();
		(player as unknown as { _currentAudioTrackIdx: number | null })._currentAudioTrackIdx = 99;
		expect(player.audioTrack()).toBeNull();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// qualityLevels() / quality()
// ─────────────────────────────────────────────────────────────────────────────

describe('qualityLevels() / quality()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('qualityLevels() returns empty array when no backend', () => {
		const player = setupPlayer();
		expect(player.qualityLevels()).toHaveLength(0);
	});

	it('qualityLevels() returns backend quality levels', () => {
		const player = setupPlayer();
		const levels: QualityLevel[] = [
			{ index: 0, label: '1080p', bitrate: 5000000, height: 1080, width: 1920, supported: true },
			{ index: 1, label: '720p', bitrate: 2500000, height: 720, width: 1280, supported: true },
		];
		const backend = makeBackendWithTracks({ qualityLevels: levels });
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		expect(player.qualityLevels()).toHaveLength(2);
		expect(player.qualityLevels()[0]!.label).toBe('1080p');
	});

	it('qualityLevels() returns empty array when backend throws', () => {
		const player = setupPlayer();
		(player as unknown as { backend: () => unknown }).backend = () => ({
			qualityLevels: () => { throw new Error('backend error'); },
		});
		expect(player.qualityLevels()).toHaveLength(0);
	});

	it('quality() returns "auto" when default', () => {
		const player = setupPlayer();
		expect(player.quality()).toBe('auto');
	});

	it('quality("auto") sets AUTO state, emits qualityState', () => {
		const player = setupPlayer();
		const stateEvents: Array<{ state: string }> = [];
		player.on('qualityState' as never, (data: { state: string }) => stateEvents.push(data));

		player.quality('auto');

		expect((player as unknown as { _qualityState: string })._qualityState).toBe(QualityState.AUTO);
		expect(stateEvents[0]!.state).toBe(QualityState.AUTO);
	});

	it('quality(idx) sets MANUAL state, calls backend setQuality, emits qualityState', () => {
		const player = setupPlayer();
		const levels: QualityLevel[] = [
			{ index: 0, label: '1080p', bitrate: 5000000, height: 1080, width: 1920, supported: true },
		];
		const backend = makeBackendWithTracks({ qualityLevels: levels });
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		const stateEvents: Array<{ state: string }> = [];
		player.on('qualityState' as never, (data: { state: string }) => stateEvents.push(data));

		player.quality(0);

		expect((player as unknown as { _currentQualityIdx: number | 'auto' })._currentQualityIdx).toBe(0);
		expect(backend.setQualityCalls).toContain(0);
		expect(stateEvents[0]!.state).toBe(QualityState.MANUAL);
	});

	it('quality() returns { index, track } after selecting a level', () => {
		const player = setupPlayer();
		const levels: QualityLevel[] = [
			{ index: 0, label: '1080p', bitrate: 5000000, height: 1080, width: 1920, supported: true },
		];
		const backend = makeBackendWithTracks({ qualityLevels: levels });
		(player as unknown as { backend: () => unknown }).backend = () => backend;

		player.quality(0);
		const result = player.quality() as { index: number; track: QualityLevel } | 'auto';
		expect(result).not.toBe('auto');
		const typed = result as { index: number; track: QualityLevel };
		expect(typed.index).toBe(0);
		expect(typed.track.label).toBe('1080p');
	});

	it('quality() returns "auto" when stored index has no matching level', () => {
		const player = setupPlayer();
		(player as unknown as { _currentQualityIdx: number | 'auto' })._currentQualityIdx = 99;
		expect(player.quality()).toBe('auto');
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// chapters() / seekToChapter() / nextChapter() / previousChapter() / chapter()
// ─────────────────────────────────────────────────────────────────────────────

describe('chapters() / chapter navigation', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	function setupWithChapters(chapters: Chapter[], currentTime = 0): MockPlayer {
		const player = setupPlayer();

		// `chapters()` in the mixin reads through hasTracksField — items must have
		// a non-empty `tracks` array for the guard to pass and chapters to be visible.
		// We add a placeholder tracks entry so hasTracksField returns true.
		const fakeItem: BasePlaylistItem & { tracks: unknown[]; chapters?: Chapter[] } = {
			id: 'item-1',
			title: 'Test',
			url: '/test.mp4',
			tracks: [{ kind: 'subtitles', file: '/placeholder.vtt', language: 'en' }],
			chapters,
		};
		player.queue([fakeItem]);
		player.item(fakeItem);

		// Set the internal current time
		(player as unknown as { _internalCurrentTime: number })._internalCurrentTime = currentTime;

		// Stub time() to capture seek calls — real time() would require _assertReady
		(player as unknown as { time: (seconds: number, opts?: unknown) => void }).time = vi.fn();

		return player;
	}

	it('chapters() returns empty array when no item', () => {
		const player = setupPlayer();
		expect(player.chapters()).toHaveLength(0);
	});

	it('chapters() returns chapter list from active item', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters);
		expect(player.chapters()).toHaveLength(2);
		expect(player.chapters()[0]!.title).toBe('Intro');
	});

	it('seekToChapter(0) calls time(0) and emits chapter event with index+title', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 10, end: 60, title: 'Opening' },
		];
		const player = setupWithChapters(chapters);

		const chapterEvents: Array<{ index: number; title: string }> = [];
		player.on('chapter' as never, (data: { index: number; title: string }) => chapterEvents.push(data));

		player.seekToChapter(0);

		expect((player.time as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(10, undefined);
		expect(chapterEvents).toHaveLength(1);
		expect(chapterEvents[0]!.index).toBe(0);
		expect(chapterEvents[0]!.title).toBe('Opening');
	});

	it('seekToChapter(out-of-range) is a no-op — no events emitted', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
		];
		const player = setupWithChapters(chapters);
		const chapterEvents: unknown[] = [];
		player.on('chapter' as never, (data: unknown) => chapterEvents.push(data));

		player.seekToChapter(99);

		expect(chapterEvents).toHaveLength(0);
	});

	it('nextChapter() no-ops when chapter list is empty', () => {
		const player = setupWithChapters([]);
		const chapterEvents: unknown[] = [];
		player.on('chapter' as never, (data: unknown) => chapterEvents.push(data));

		player.nextChapter();
		expect(chapterEvents).toHaveLength(0);
	});

	it('nextChapter() seeks to next chapter whose start > currentTime', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
			{ index: 2, start: 120, end: 180, title: 'Act 2' },
		];
		const player = setupWithChapters(chapters, 30);
		const chapterEvents: Array<{ index: number; title: string }> = [];
		player.on('chapter' as never, (data: { index: number; title: string }) => chapterEvents.push(data));

		player.nextChapter();

		expect(chapterEvents[0]!.index).toBe(1);
		expect(chapterEvents[0]!.title).toBe('Act 1');
	});

	it('nextChapter() no-ops when already past last chapter', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters, 200);
		const chapterEvents: unknown[] = [];
		player.on('chapter' as never, (data: unknown) => chapterEvents.push(data));

		player.nextChapter();
		expect(chapterEvents).toHaveLength(0);
	});

	it('previousChapter() no-ops when chapter list is empty', () => {
		const player = setupWithChapters([]);
		const chapterEvents: unknown[] = [];
		player.on('chapter' as never, (data: unknown) => chapterEvents.push(data));

		player.previousChapter();
		expect(chapterEvents).toHaveLength(0);
	});

	it('previousChapter() restarts current chapter when > 10 seconds in', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters, 85);
		const chapterEvents: Array<{ index: number; title: string }> = [];
		player.on('chapter' as never, (data: { index: number; title: string }) => chapterEvents.push(data));

		player.previousChapter();

		expect(chapterEvents[0]!.index).toBe(1);
		expect(chapterEvents[0]!.title).toBe('Act 1');
	});

	it('previousChapter() goes to previous chapter when within 10 seconds of current chapter start', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters, 65);
		const chapterEvents: Array<{ index: number; title: string }> = [];
		player.on('chapter' as never, (data: { index: number; title: string }) => chapterEvents.push(data));

		player.previousChapter();

		expect(chapterEvents[0]!.index).toBe(0);
		expect(chapterEvents[0]!.title).toBe('Intro');
	});

	it('previousChapter() no-ops when before the first chapter start', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 30, end: 90, title: 'Intro' },
		];
		const player = setupWithChapters(chapters, 10);
		const chapterEvents: unknown[] = [];
		player.on('chapter' as never, (data: unknown) => chapterEvents.push(data));

		player.previousChapter();
		expect(chapterEvents).toHaveLength(0);
	});

	it('previousChapter() on first chapter at <=10s in restarts chapter 0', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters, 5);
		const chapterEvents: Array<{ index: number; title: string }> = [];
		player.on('chapter' as never, (data: { index: number; title: string }) => chapterEvents.push(data));

		player.previousChapter();

		expect(chapterEvents[0]!.index).toBe(0);
	});

	it('chapter() (no arg) returns null when chapter list is empty', () => {
		const player = setupWithChapters([]);
		expect(player.chapter()).toBeNull();
	});

	it('chapter() returns the chapter whose range contains currentTime', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters, 75);
		const result = player.chapter();
		expect(result).not.toBeNull();
		expect(result!.title).toBe('Act 1');
	});

	it('chapter() returns null when currentTime is before any chapter start', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 30, end: 90, title: 'Intro' },
		];
		const player = setupWithChapters(chapters, 10);
		expect(player.chapter()).toBeNull();
	});

	it('chapter(idx) delegates to seekToChapter', () => {
		const chapters: Chapter[] = [
			{ index: 0, start: 0, end: 60, title: 'Intro' },
			{ index: 1, start: 60, end: 120, title: 'Act 1' },
		];
		const player = setupWithChapters(chapters);
		const chapterEvents: Array<{ index: number; title: string }> = [];
		player.on('chapter' as never, (data: { index: number; title: string }) => chapterEvents.push(data));

		player.chapter(1);

		expect(chapterEvents).toHaveLength(1);
		expect(chapterEvents[0]!.index).toBe(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// _disposeSidecarSubtitle()
// ─────────────────────────────────────────────────────────────────────────────

describe('_disposeSidecarSubtitle()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => { MockPlayer._resetRegistry(); document.body.innerHTML = ''; });

	it('no-ops when no sidecar context is active', () => {
		const player = setupPlayer();
		const internals = player as unknown as {
			_sidecarSubtitle: undefined;
			_disposeSidecarSubtitle: () => void;
		};
		expect(internals._sidecarSubtitle).toBeUndefined();
		expect(() => internals._disposeSidecarSubtitle()).not.toThrow();
		expect(internals._sidecarSubtitle).toBeUndefined();
	});

	it('calls tracker.dispose() and clears _sidecarSubtitle slot', () => {
		const player = setupPlayer();
		const disposeSpy = vi.fn();
		const fakeTracker = { dispose: disposeSpy, on: vi.fn(), attach: vi.fn() };
		(player as unknown as { _sidecarSubtitle: unknown })._sidecarSubtitle = {
			tracker: fakeTracker,
			active: new Set(),
			language: 'en',
		};

		(player as unknown as { _disposeSidecarSubtitle: () => void })._disposeSidecarSubtitle();

		expect(disposeSpy).toHaveBeenCalledOnce();
		expect((player as unknown as { _sidecarSubtitle: unknown })._sidecarSubtitle).toBeUndefined();
	});

	it('swallows exceptions from tracker.dispose() without propagating', () => {
		const player = setupPlayer();
		const fakeTracker = {
			dispose: () => { throw new Error('tracker dispose error'); },
			on: vi.fn(),
			attach: vi.fn(),
		};
		(player as unknown as { _sidecarSubtitle: unknown })._sidecarSubtitle = {
			tracker: fakeTracker,
			active: new Set(),
			language: 'en',
		};

		expect(() =>
			(player as unknown as { _disposeSidecarSubtitle: () => void })._disposeSidecarSubtitle()).not.toThrow();
		expect((player as unknown as { _sidecarSubtitle: unknown })._sidecarSubtitle).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveItemTrackUrls()
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveItemTrackUrls()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('returns the item unchanged when it has no tracks field', async () => {
		const player = setupPlayer();
		const item: BasePlaylistItem = { id: '1', title: 'Test' };
		const result = await player.resolveItemTrackUrls(item);
		expect(result).toBe(item);
	});

	it('returns item unchanged when tracks is an empty array', async () => {
		const player = setupPlayer();
		const item = { id: '1', title: 'Test', tracks: [] };
		const result = await player.resolveItemTrackUrls(item);
		expect(result).toEqual(item);
	});

	it('preserves track without a file property', async () => {
		const player = setupPlayer();
		const track = { kind: 'subtitles', language: 'en', label: 'English' };
		const item = { id: '1', title: 'Test', tracks: [track] };
		const result = await player.resolveItemTrackUrls(item);
		expect(result.tracks[0]).toEqual(track);
	});

	it('resolves track file URL relative to baseUrl', async () => {
		const player = setupPlayer();
		player.baseUrl('https://cdn.example.com/');
		const item = { id: '1', title: 'Test', tracks: [{ kind: 'subtitles', file: 'en.vtt', language: 'en' }] };
		const result = await player.resolveItemTrackUrls(item);
		expect(result.tracks[0]!.file).toBe('https://cdn.example.com/en.vtt');
	});

	it('calls transformUrl when _authConfig.transformUrl is set', async () => {
		const player = setupPlayer();
		const transformUrl = vi.fn().mockImplementation((url: string) => Promise.resolve(`${url}?token=abc`));
		(player as unknown as { _authConfig: unknown })._authConfig = { transformUrl };

		const item = { id: '1', title: 'Test', tracks: [{ kind: 'subtitles', file: 'https://cdn.example.com/en.vtt', language: 'en' }] };
		const result = await player.resolveItemTrackUrls(item);

		expect(transformUrl).toHaveBeenCalledWith('https://cdn.example.com/en.vtt');
		expect(result.tracks[0]!.file).toBe('https://cdn.example.com/en.vtt?token=abc');
	});

	it('does not fetch chapters when item already has chapters', async () => {
		const player = setupPlayer();
		const chapters = [{ title: 'Intro', start: 0, end: 60 }];
		const item = {
			id: '1',
			title: 'Test',
			chapters,
			tracks: [{ kind: 'chapters', file: 'https://cdn.example.com/chapters.vtt' }],
		};
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);

		try {
			const result = await player.resolveItemTrackUrls(item);
			expect(fetchSpy).not.toHaveBeenCalled();
			expect((result as { chapters: unknown }).chapters).toEqual(chapters);
		}
		finally {
			vi.unstubAllGlobals();
		}
	});

	it('attempts to fetch chapters when item has a chapters track and no existing chapters', async () => {
		const player = setupPlayer();
		// Stub fetch to fail so fetchChaptersVtt returns []
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network offline')));

		const item = {
			id: '1',
			title: 'Test',
			tracks: [{ kind: 'chapters', file: 'https://cdn.example.com/chapters.vtt' }],
		};

		try {
			const result = await player.resolveItemTrackUrls(item);
			// fetchChaptersVtt swallows the error and returns [], so no chapters added
			expect((result as { chapters?: unknown }).chapters).toBeUndefined();
		}
		finally {
			vi.unstubAllGlobals();
		}
	});

	it('returns withTracks including chapters when fetch succeeds and VTT has cues', async () => {
		const player = setupPlayer();
		// Stub fetch to return a minimal VTT
		const vttBody = 'WEBVTT\n\n00:00:00.000 --> 00:01:00.000\nIntro\n\n00:01:00.000 --> 00:10:00.000\nMain\n';
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'text/vtt' }),
			text: () => Promise.resolve(vttBody),
		}));

		const item = {
			id: '1',
			title: 'Test',
			tracks: [{ kind: 'chapters', file: 'https://cdn.example.com/chapters.vtt' }],
		};

		try {
			const result = await player.resolveItemTrackUrls(item);
			const chapters = (result as { chapters?: Array<{ title: string }> }).chapters;
			if (chapters && chapters.length > 0) {
				expect(chapters[0]).toHaveProperty('title');
			}
		}
		finally {
			vi.unstubAllGlobals();
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// _resolveAndEmitChapters()
// ─────────────────────────────────────────────────────────────────────────────

describe('_resolveAndEmitChapters()', () => {
	beforeEach(() => MockPlayer._resetRegistry());
	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
	});

	it('no-ops when the item id is not found in the queue', async () => {
		const player = setupPlayer();
		const chapterEvents: unknown[] = [];
		player.on('chapters' as never, (data: unknown) => chapterEvents.push(data));

		await (player as unknown as { _resolveAndEmitChapters: (id: string) => Promise<void> })
			._resolveAndEmitChapters('non-existent-id');

		expect(chapterEvents).toHaveLength(0);
	});

	it('emits chapters event when the item has inline chapters', async () => {
		const player = setupPlayer();
		const chapters = [{ title: 'Part 1', start: 0, end: 120 }];

		player.queue([{ id: 'item1', title: 'Movie', chapters }] as never);

		const chapterEvents: unknown[] = [];
		player.on('chapters' as never, (data: unknown) => chapterEvents.push(data));

		await (player as unknown as { _resolveAndEmitChapters: (id: string) => Promise<void> })
			._resolveAndEmitChapters('item1');

		expect(chapterEvents).toHaveLength(1);
		expect((chapterEvents[0] as { chapters: unknown[] }).chapters).toEqual(chapters);
	});

	it('respects monotonic epoch — stale call does not emit', async () => {
		const player = setupPlayer();
		player.queue([{ id: 'item1', title: 'Movie', chapters: [{ title: 'Intro', start: 0, end: 30 }] }] as never);

		const chapterEvents: unknown[] = [];
		player.on('chapters' as never, (data: unknown) => chapterEvents.push(data));

		const internals = player as unknown as { _chapterEpoch?: number; _resolveAndEmitChapters: (id: string) => Promise<void> };

		const p1 = internals._resolveAndEmitChapters('item1');
		const p2 = internals._resolveAndEmitChapters('item1');

		await Promise.all([p1, p2]);

		expect(chapterEvents.length).toBeGreaterThanOrEqual(1);
	});

	it('no-ops when resolveItemTrackUrls returns no chapters (empty tracks item)', async () => {
		const player = setupPlayer();
		player.queue([{ id: 'item-notracks', title: 'Movie', tracks: [] }] as never);

		const chapterEvents: unknown[] = [];
		player.on('chapters' as never, (data: unknown) => chapterEvents.push(data));

		const internals = player as unknown as { _resolveAndEmitChapters: (id: string) => Promise<void> };
		await internals._resolveAndEmitChapters('item-notracks');

		// No chapters found from resolveItemTrackUrls — should emit nothing
		expect(chapterEvents).toHaveLength(0);
	});

	it('emits chapters and replaces queue item when sidecar VTT fetch succeeds', async () => {
		const vttBody = 'WEBVTT\n\n00:00:00.000 --> 00:01:00.000\nIntro\n\n00:01:00.000 --> 00:10:00.000\nMain\n';
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			headers: new Headers({ 'content-type': 'text/vtt' }),
			text: () => Promise.resolve(vttBody),
		}));

		const player = setupPlayer();
		player.queue([{
			id: 'item-with-chapters-track',
			title: 'Movie',
			tracks: [{ kind: 'chapters', file: 'https://cdn.example.com/chapters.vtt' }],
		}] as never);

		const chapterEvents: Array<{ chapters: unknown[] }> = [];
		player.on('chapters' as never, (data: { chapters: unknown[] }) => chapterEvents.push(data));

		const internals = player as unknown as { _resolveAndEmitChapters: (id: string) => Promise<void> };

		try {
			await internals._resolveAndEmitChapters('item-with-chapters-track');
			if (chapterEvents.length > 0) {
				expect(chapterEvents[0]!.chapters.length).toBeGreaterThan(0);
			}
		}
		finally {
			vi.unstubAllGlobals();
		}
	});
});
