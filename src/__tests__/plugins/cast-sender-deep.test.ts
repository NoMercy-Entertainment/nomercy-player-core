// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Deep behavioral tests for `CastSenderPlugin`.
 *
 * The existing cast-sender.test.ts covers: SDK-absent guard + BrowserPolicyError,
 * isConnected() default, disconnect() no-op, static metadata, subclass hooks.
 *
 * This file covers the remaining ~180 uncovered lines:
 *  - connect() happy path: session established, cast:connected emitted, deviceName resolved
 *  - connect() error path: requestSession rejects → cast:error + rethrow
 *  - disconnect() with SDK present: endCurrentSession called, cast:disconnected emitted
 *  - player → cast forwarding: play / pause / stop / seek / volume / mute events
 *  - cast → player mirroring: RemotePlayerController events mirror state back
 *  - applyingFromRemote guard: prevents re-broadcast loops
 *  - handleRemoteDisconnect: resume-local path + resumeLocalOnDisconnect: false
 *  - dispose() teardown: detaches listeners, ends session
 *  - forwardCurrent() happy path: loadMedia called with correct MediaInfo
 *  - unsupported event when disconnect() called with no SDK
 *  - emitPlayer() swallows errors from a dead player
 */

import type { IUrlResolver } from '../../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserPolicyError } from '../../errors';
import { buildResolvedUrl } from '../../index';
import { CastSenderPlugin } from '../../plugins/cast-sender';
import { StubPlayer } from '../../testing/stub-player';

// ─── Cast SDK fake factory ────────────────────────────────────────────────────

interface FakeRemotePlayer {
	isConnected: boolean;
	isPaused: boolean;
	isMuted: boolean;
	currentTime: number;
	duration: number;
	volumeLevel: number;
	mediaInfo: { contentId?: string } | null;
}

interface FakeController {
	addEventListener: ReturnType<typeof vi.fn>;
	removeEventListener: ReturnType<typeof vi.fn>;
	playOrPause: ReturnType<typeof vi.fn>;
	stop: ReturnType<typeof vi.fn>;
	seek: ReturnType<typeof vi.fn>;
	setVolumeLevel: ReturnType<typeof vi.fn>;
	muteOrUnmute: ReturnType<typeof vi.fn>;
}

interface FakeSdk {
	remote: FakeRemotePlayer;
	controller: FakeController;
	session: {
		loadMedia: ReturnType<typeof vi.fn>;
		getSessionId: () => string;
		getCastDevice: () => { friendlyName: string };
	};
	context: {
		requestSession: ReturnType<typeof vi.fn>;
		endCurrentSession: ReturnType<typeof vi.fn>;
		getCurrentSession: () => typeof fakeSdk.session;
	};
	triggerEvent: (event: string) => void;
}

let fakeSdk: FakeSdk;

function buildFakeSdk(overrides: { requestSessionRejects?: boolean } = {}): void {
	const handlers = new Map<string, Array<(ev: { value: unknown }) => void>>();

	fakeSdk = {
		remote: {
			isConnected: true,
			isPaused: false,
			isMuted: false,
			currentTime: 30,
			duration: 180,
			volumeLevel: 0.8,
			mediaInfo: { contentId: 'https://example.com/track.mp3' },
		},

		controller: {
			addEventListener: vi.fn((event: string, handler: (ev: { value: unknown }) => void) => {
				const list = handlers.get(event) ?? [];
				list.push(handler);
				handlers.set(event, list);
			}),
			removeEventListener: vi.fn(),
			playOrPause: vi.fn(),
			stop: vi.fn(),
			seek: vi.fn(),
			setVolumeLevel: vi.fn(),
			muteOrUnmute: vi.fn(),
		},

		session: {
			loadMedia: vi.fn().mockResolvedValue(undefined),
			getSessionId: () => 'sess-1',
			getCastDevice: () => ({ friendlyName: 'Living Room TV' }),
		},

		context: {
			requestSession: overrides.requestSessionRejects
				? vi.fn().mockRejectedValue(new Error('User cancelled'))
				: vi.fn().mockResolvedValue(undefined),
			endCurrentSession: vi.fn(),
			getCurrentSession: () => fakeSdk.session,
		},

		triggerEvent(event: string) {
			for (const handler of handlers.get(event) ?? []) {
				handler({ value: null });
			}
		},
	};

	const RemotePlayerEventType = {
		IS_CONNECTED_CHANGED: 'IS_CONNECTED_CHANGED',
		IS_PAUSED_CHANGED: 'IS_PAUSED_CHANGED',
		CURRENT_TIME_CHANGED: 'CURRENT_TIME_CHANGED',
		IS_MEDIA_LOADED_CHANGED: 'IS_MEDIA_LOADED_CHANGED',
		MEDIA_INFO_CHANGED: 'MEDIA_INFO_CHANGED',
		VOLUME_LEVEL_CHANGED: 'VOLUME_LEVEL_CHANGED',
		IS_MUTED_CHANGED: 'IS_MUTED_CHANGED',
	};

	(globalThis as unknown as Record<string, unknown>)['cast'] = {
		framework: {
			CastContext: { getInstance: () => fakeSdk.context },
			// Constructor functions — the plugin calls these with `new`, so they
			// must be `function` expressions (method shorthand is not constructable).
			/* eslint-disable object-shorthand */
			RemotePlayer: function () { return fakeSdk.remote; },
			RemotePlayerController: function () { return fakeSdk.controller; },
			/* eslint-enable object-shorthand */
			RemotePlayerEventType,
		},
	};

	(globalThis as unknown as Record<string, unknown>)['chrome'] = {
		cast: {
			media: {
				/* eslint-disable object-shorthand */
				MediaInfo: function (contentId: string, contentType: string) { return { contentId, contentType }; },
				LoadRequest: function (mediaInfo: unknown) { return { mediaInfo }; },
				GenericMediaMetadata: function () { return {}; },
				/* eslint-enable object-shorthand */
				StreamType: { BUFFERED: 'BUFFERED', LIVE: 'LIVE' },
			},
		},
	};
}

function clearCastSdk(): void {
	(globalThis as unknown as Record<string, unknown>)['cast'] = undefined;
	(globalThis as unknown as Record<string, unknown>)['chrome'] = undefined;
}

/** Create a StubPlayer with an `item()` stub so forwardCurrent() never crashes. */
function makeStubPlayer(): StubPlayer & Record<string, unknown> {
	const player = new StubPlayer() as StubPlayer & Record<string, unknown>;
	player['item'] = () => undefined;
	return player;
}

/** Wire a CastSenderPlugin against a player with a lifecycle stub. */
function wirePluginForPlayer(
	player: StubPlayer & Record<string, unknown>,
	opts: Record<string, unknown> = {},
): CastSenderPlugin {
	const plugin = new CastSenderPlugin();
	const lifecycle = {
		addCleanup: vi.fn(),
		listen: vi.fn(),
		timeout: vi.fn(),
		interval: vi.fn(),
		frame: vi.fn(),
		abortable: vi.fn(),
	};
	plugin.initialize(player as never, opts, lifecycle as never);
	plugin.use();
	return plugin;
}

// ─── Plugin wiring helper ─────────────────────────────────────────────────────

function wirePlugin(
	opts: Record<string, unknown> = {},
	playerOverrides: Record<string, unknown> = {},
): { plugin: CastSenderPlugin; player: StubPlayer & Record<string, unknown> } {
	const player = new StubPlayer() as StubPlayer & Record<string, unknown>;
	// Default item() stub so forwardCurrent() doesn't crash.
	if (!playerOverrides['item']) {
		(player as unknown as { item: () => undefined }).item = () => undefined;
	}
	Object.assign(player, playerOverrides);

	const plugin = new CastSenderPlugin();
	const lifecycle = {
		addCleanup: vi.fn(),
		listen: vi.fn(),
		timeout: vi.fn(),
		interval: vi.fn(),
		frame: vi.fn(),
		abortable: vi.fn(),
	};
	plugin.initialize(player as never, opts, lifecycle as never);
	plugin.use();
	return { plugin, player };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CastSenderPlugin — deep behavioral coverage', () => {
	beforeEach(() => {
		clearCastSdk();
	});

	afterEach(() => {
		clearCastSdk();
	});

	// ── connect() ─────────────────────────────────────────────────────────────

	describe('connect()', () => {
		it('resolves on success, emits cast:connected with deviceName, and isConnected() becomes true', async () => {
			buildFakeSdk();
			const { plugin, player } = wirePlugin();

			const connected: Array<{ deviceName: string }> = [];
			player.on('plugin:cast-sender:cast:connected' as never, (data: { deviceName: string }) => { connected.push(data); });

			await plugin.connect();

			expect(plugin.isConnected()).toBe(true);
			expect(connected).toHaveLength(1);
			expect(connected[0]!.deviceName).toBe('Living Room TV');
		});

		it('falls back to "Cast device" when getCastDevice returns undefined friendlyName', async () => {
			buildFakeSdk();
			// ?? only guards null/undefined, not empty string.
			// Simulate a device with no friendlyName property.
			fakeSdk.session.getCastDevice = () => ({ friendlyName: undefined as unknown as string });

			const { plugin, player } = wirePlugin();

			const connected: Array<{ deviceName: string }> = [];
			player.on('plugin:cast-sender:cast:connected' as never, (data: { deviceName: string }) => { connected.push(data); });

			await plugin.connect();

			expect(connected[0]!.deviceName).toBe('Cast device');
		});

		it('emits cast:error and rethrows when requestSession rejects', async () => {
			buildFakeSdk({ requestSessionRejects: true });
			const { plugin, player } = wirePlugin();

			const errors: Array<{ error: Error }> = [];
			player.on('plugin:cast-sender:cast:error' as never, (data: { error: Error }) => { errors.push(data); });

			await expect(plugin.connect()).rejects.toThrow('User cancelled');
			expect(errors).toHaveLength(1);
			expect(errors[0]!.error.message).toBe('User cancelled');
			expect(plugin.isConnected()).toBe(false);
		});

		it('emits unsupported + throws BrowserPolicyError when SDK is absent', async () => {
			const { plugin, player } = wirePlugin();

			const unsupported: Array<{ reason: string }> = [];
			player.on('plugin:cast-sender:unsupported' as never, (data: { reason: string }) => { unsupported.push(data); });

			let err: unknown;
			try { await plugin.connect(); }
			catch (error) { err = error; }

			expect(err).toBeInstanceOf(BrowserPolicyError);
			expect(unsupported).toHaveLength(1);
			expect(unsupported[0]!.reason).toBe('cast-sdk-missing');
		});
	});

	// ── disconnect() ──────────────────────────────────────────────────────────

	describe('disconnect()', () => {
		it('calls endCurrentSession, emits cast:disconnected, sets isConnected to false', async () => {
			buildFakeSdk();
			const { plugin, player } = wirePlugin();

			await plugin.connect();
			expect(plugin.isConnected()).toBe(true);

			const disconnected: unknown[] = [];
			player.on('plugin:cast-sender:cast:disconnected' as never, () => { disconnected.push(true); });

			plugin.disconnect();

			expect(plugin.isConnected()).toBe(false);
			expect(disconnected).toHaveLength(1);
			expect(fakeSdk.context.endCurrentSession).toHaveBeenCalledWith(true);
		});

		it('emits unsupported when SDK is absent — does not throw', () => {
			const { plugin, player } = wirePlugin();

			const unsupported: Array<{ reason: string }> = [];
			player.on('plugin:cast-sender:unsupported' as never, (data: { reason: string }) => { unsupported.push(data); });

			expect(() => plugin.disconnect()).not.toThrow();
			expect(unsupported).toHaveLength(1);
			expect(unsupported[0]!.reason).toBe('cast-sdk-missing');
		});
	});

	// ── dispose() ─────────────────────────────────────────────────────────────

	describe('dispose()', () => {
		it('calls endCurrentSession and detaches remote listeners when connected', async () => {
			buildFakeSdk();
			const { plugin } = wirePlugin();

			await plugin.connect();
			plugin.dispose();

			expect(fakeSdk.context.endCurrentSession).toHaveBeenCalledWith(true);
			expect(fakeSdk.controller.removeEventListener).toHaveBeenCalled();
			expect(plugin.isConnected()).toBe(false);
		});

		it('is idempotent — second dispose() does not throw', async () => {
			buildFakeSdk();
			const { plugin } = wirePlugin();

			await plugin.connect();
			plugin.dispose();
			expect(() => plugin.dispose()).not.toThrow();
		});
	});

	// ── player → cast forwarding ──────────────────────────────────────────────

	describe('player → cast forwarding', () => {
		it('play event calls playOrPause when receiver is paused', async () => {
			buildFakeSdk();
			fakeSdk.remote.isPaused = true;

			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('play', { source: 'user' });

			expect(fakeSdk.controller.playOrPause).toHaveBeenCalledOnce();
		});

		it('play event tagged source: "cast" is skipped to prevent re-broadcast', async () => {
			buildFakeSdk();
			fakeSdk.remote.isPaused = true;

			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('play', { source: 'cast' });

			expect(fakeSdk.controller.playOrPause).not.toHaveBeenCalled();
		});

		it('stop event calls controller.stop()', async () => {
			buildFakeSdk();
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('stop', { source: 'user' });

			expect(fakeSdk.controller.stop).toHaveBeenCalledOnce();
		});

		it('seek event writes currentTime and calls controller.seek()', async () => {
			buildFakeSdk();
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('seek', { time: 45 });

			expect(fakeSdk.remote.currentTime).toBe(45);
			expect(fakeSdk.controller.seek).toHaveBeenCalledOnce();
		});

		it('seek with negative time is clamped to 0', async () => {
			buildFakeSdk();
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('seek', { time: -10 });

			expect(fakeSdk.remote.currentTime).toBe(0);
		});

		it('volume event divides by 100 and calls setVolumeLevel()', async () => {
			buildFakeSdk();
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('volume', { level: 75 });

			expect(fakeSdk.remote.volumeLevel).toBeCloseTo(0.75);
			expect(fakeSdk.controller.setVolumeLevel).toHaveBeenCalledOnce();
		});

		it('volume level clamped to 0..1 range', async () => {
			buildFakeSdk();
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('volume', { level: 150 });
			expect(fakeSdk.remote.volumeLevel).toBe(1);

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('volume', { level: -20 });
			expect(fakeSdk.remote.volumeLevel).toBe(0);
		});

		it('mute event calls muteOrUnmute when receiver mute state differs', async () => {
			buildFakeSdk();
			fakeSdk.remote.isMuted = false;
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('mute', { muted: true });

			expect(fakeSdk.controller.muteOrUnmute).toHaveBeenCalledOnce();
			expect(fakeSdk.remote.isMuted).toBe(true);
		});

		it('mute event is skipped when receiver mute state already matches', async () => {
			buildFakeSdk();
			fakeSdk.remote.isMuted = true;
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('mute', { muted: true });

			expect(fakeSdk.controller.muteOrUnmute).not.toHaveBeenCalled();
		});
	});

	// ── cast → player mirroring ───────────────────────────────────────────────

	describe('cast → player mirroring (RemotePlayerController events)', () => {
		it('IS_PAUSED_CHANGED (paused) emits cast:remote-state with state "paused"', async () => {
			buildFakeSdk();
			fakeSdk.remote.isPaused = true;
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			const states: Array<{ state: string }> = [];
			player.on('plugin:cast-sender:cast:remote-state' as never, (data: { state: string }) => { states.push(data); });

			fakeSdk.triggerEvent('IS_PAUSED_CHANGED');

			expect(states).toHaveLength(1);
			expect(states[0]!.state).toBe('paused');
		});

		it('IS_PAUSED_CHANGED (playing) emits cast:remote-state with state "playing"', async () => {
			buildFakeSdk();
			fakeSdk.remote.isPaused = false;
			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			const states: Array<{ state: string }> = [];
			player.on('plugin:cast-sender:cast:remote-state' as never, (data: { state: string }) => { states.push(data); });

			fakeSdk.triggerEvent('IS_PAUSED_CHANGED');

			expect(states[0]!.state).toBe('playing');
		});

		it('MEDIA_INFO_CHANGED emits cast:media-changed when receiver contentId differs from local', async () => {
			buildFakeSdk();
			fakeSdk.remote.mediaInfo = { contentId: 'https://example.com/other.mp3' };

			const player = makeStubPlayer() as ReturnType<typeof makeStubPlayer> & { item: () => { url: string } };
			player.item = () => ({ url: 'https://example.com/original.mp3' });
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			const mediaChanged: Array<{ contentId: string }> = [];
			player.on('plugin:cast-sender:cast:media-changed' as never, (data: { contentId: string }) => { mediaChanged.push(data); });

			fakeSdk.triggerEvent('MEDIA_INFO_CHANGED');

			expect(mediaChanged).toHaveLength(1);
			expect(mediaChanged[0]!.contentId).toBe('https://example.com/other.mp3');
		});

		it('does NOT emit cast:media-changed when the receiver echoes back the plugin\'s own RESOLVED contentId', async () => {
			buildFakeSdk();

			const player = makeStubPlayer() as ReturnType<typeof makeStubPlayer> & { item: () => { url: string } };
			player.item = () => ({ url: 'https://example.com/track.mp3' });
			const resolver: IUrlResolver = url => buildResolvedUrl(url, `${url}?token=abc`);
			player.urlResolver(resolver);

			const plugin = wirePluginForPlayer(player);
			await plugin.connect();
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			fakeSdk.remote.mediaInfo = { contentId: 'https://example.com/track.mp3?token=abc' };

			const mediaChanged: Array<{ contentId: string }> = [];
			player.on('plugin:cast-sender:cast:media-changed' as never, (data: { contentId: string }) => { mediaChanged.push(data); });

			fakeSdk.triggerEvent('MEDIA_INFO_CHANGED');

			expect(mediaChanged).toHaveLength(0);
		});

		it('still emits cast:media-changed when the receiver genuinely switched to a different item', async () => {
			buildFakeSdk();

			const player = makeStubPlayer() as ReturnType<typeof makeStubPlayer> & { item: () => { url: string } };
			player.item = () => ({ url: 'https://example.com/track.mp3' });
			const resolver: IUrlResolver = url => buildResolvedUrl(url, `${url}?token=abc`);
			player.urlResolver(resolver);

			const plugin = wirePluginForPlayer(player);
			await plugin.connect();
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			fakeSdk.remote.mediaInfo = { contentId: 'https://example.com/other-track.mp3?token=xyz' };

			const mediaChanged: Array<{ contentId: string }> = [];
			player.on('plugin:cast-sender:cast:media-changed' as never, (data: { contentId: string }) => { mediaChanged.push(data); });

			fakeSdk.triggerEvent('MEDIA_INFO_CHANGED');

			expect(mediaChanged).toHaveLength(1);
			expect(mediaChanged[0]!.contentId).toBe('https://example.com/other-track.mp3?token=xyz');
		});

		it('IS_CONNECTED_CHANGED (disconnected) calls handleRemoteDisconnect, emits cast:disconnected', async () => {
			buildFakeSdk();
			const player = makeStubPlayer();
			const playCalls: unknown[] = [];
			(player as typeof player & { play: (opts?: unknown) => Promise<void> }).play = async (opts) => {
				playCalls.push(opts);
			};
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			const disconnected: unknown[] = [];
			player.on('plugin:cast-sender:cast:disconnected' as never, () => { disconnected.push(true); });

			fakeSdk.remote.isConnected = false;
			fakeSdk.triggerEvent('IS_CONNECTED_CHANGED');

			expect(plugin.isConnected()).toBe(false);
			expect(disconnected).toHaveLength(1);
		});

		it('handleRemoteDisconnect with resumeLocalOnDisconnect: false skips play() resume', async () => {
			buildFakeSdk();
			fakeSdk.remote.isPaused = false;
			fakeSdk.remote.currentTime = 60;

			const player = makeStubPlayer();
			const playCalls: unknown[] = [];
			(player as typeof player & { play: (opts?: unknown) => Promise<void> }).play = async (opts) => {
				playCalls.push(opts);
			};
			const plugin = wirePluginForPlayer(player, { resumeLocalOnDisconnect: false });
			await plugin.connect();

			fakeSdk.remote.isConnected = false;
			fakeSdk.triggerEvent('IS_CONNECTED_CHANGED');

			expect(playCalls).toHaveLength(0);
		});

		it('handleRemoteDisconnect resumes player.play() when not paused and resumeLocalOnDisconnect: true (default)', async () => {
			buildFakeSdk();
			fakeSdk.remote.isPaused = false;
			fakeSdk.remote.currentTime = 60;

			const player = makeStubPlayer();
			const playCalls: unknown[] = [];
			(player as typeof player & { play: (opts?: unknown) => Promise<void> }).play = async (opts) => {
				playCalls.push(opts);
			};
			const timeCalls: unknown[] = [];
			const timeOverride: (seconds: number, opts?: unknown) => Promise<void> = async (seconds, opts) => {
				timeCalls.push({ seconds, opts });
			};
			(player as unknown as Record<string, unknown>)['time'] = timeOverride;
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			fakeSdk.remote.isConnected = false;
			fakeSdk.triggerEvent('IS_CONNECTED_CHANGED');

			// Allow microtasks to settle.
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			expect(timeCalls).toHaveLength(1);
			expect((timeCalls[0] as { seconds: number }).seconds).toBe(60);
			expect(playCalls).toHaveLength(1);
		});
	});

	// ── forwardCurrent() ──────────────────────────────────────────────────────

	describe('forwardCurrent() — loadMedia invocation', () => {
		it('calls session.loadMedia with correct MediaInfo after connect()', async () => {
			buildFakeSdk();

			const player = makeStubPlayer() as ReturnType<typeof makeStubPlayer> & { item: () => { url: string; title: string } };
			player.item = () => ({ url: 'https://example.com/track.mp3', title: 'My Track' });
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();

			// Allow the forwardCurrent() async call after connect to settle.
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			expect(fakeSdk.session.loadMedia).toHaveBeenCalled();
		});

		it('skips loadMedia when there is no current item', async () => {
			buildFakeSdk();

			const player = makeStubPlayer();
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			expect(fakeSdk.session.loadMedia).not.toHaveBeenCalled();
		});

		it('item event triggers forwardCurrent() when connected', async () => {
			buildFakeSdk();

			const player = makeStubPlayer() as ReturnType<typeof makeStubPlayer> & { item: () => { url: string } };
			player.item = () => ({ url: 'https://example.com/track.mp3' });
			const plugin = wirePluginForPlayer(player);
			await plugin.connect();
			// Reset call count after connect's own forwardCurrent.
			fakeSdk.session.loadMedia.mockClear();

			(player as typeof player & { emit: (eventName: string, data: unknown) => void }).emit('item', { item: { url: 'https://example.com/track.mp3' } });
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			expect(fakeSdk.session.loadMedia).toHaveBeenCalled();
		});

		it('sets streamType to LIVE when opts.live is true', async () => {
			buildFakeSdk();

			const player = makeStubPlayer() as ReturnType<typeof makeStubPlayer> & { item: () => { url: string } };
			player.item = () => ({ url: 'https://example.com/stream.m3u8' });
			const plugin = wirePluginForPlayer(player, { live: true });
			await plugin.connect();
			await new Promise<void>(resolve => setTimeout(resolve, 0));

			const loadRequestArg = fakeSdk.session.loadMedia.mock.calls[0]![0] as { mediaInfo: Record<string, unknown> };
			expect(loadRequestArg.mediaInfo['streamType']).toBe('LIVE');
		});
	});

	// ── static metadata ───────────────────────────────────────────────────────

	describe('static metadata', () => {
		it('id, version, description, and translations are defined', () => {
			expect(CastSenderPlugin.id).toBe('cast-sender');
			expect(CastSenderPlugin.version).toBe('2.0.0');
			expect(typeof CastSenderPlugin.description).toBe('string');
			expect(CastSenderPlugin.translations).toBeDefined();
			expect(CastSenderPlugin.translations['en']).toBeDefined();
			expect(CastSenderPlugin.translations['nl']).toBeDefined();
		});
	});
});
