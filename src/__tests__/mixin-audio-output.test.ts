// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Coverage for `audioOutputMethods` — `src/core/mixins/audio-output.ts`.
 *
 * This mixin was at 0% function coverage. Three exported methods:
 *  - audioOutputs()   — enumerates audio output devices via navigator.mediaDevices
 *  - selectAudioOutput() — opens the browser picker (Chrome ≥105 only)
 *  - audioOutput()    — read/write the active output device via setSinkId
 *
 * We mock `navigator.mediaDevices` at the test level so the REAL code runs
 * against the mock, then assert the correct consequences.
 *
 * Test groups:
 *  - audioOutputs — no mediaDevices → [], with mock → filters audiooutput devices
 *  - selectAudioOutput — unsupported → BrowserPolicyError, AbortError → null,
 *    NotAllowedError → null, success → MediaDeviceInfo
 *  - audioOutput getter — returns _currentAudioOutputId (null by default)
 *  - audioOutput setter — calls setSinkId, stores device id; no setSinkId → BrowserPolicyError
 */

import type { BaseEventMap } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	BrowserPolicyError,
	composeMixins,
	EventEmitter,
	initPlayerCoreState,
	playerCoreMethods,
	resolvePlayerConstructor,
} from '../index';

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
	declare audioOutputs: () => Promise<MediaDeviceInfo[]>;
	declare selectAudioOutput: () => Promise<MediaDeviceInfo | null>;
	declare audioOutput: {
		(): Promise<string | null>;
		(deviceId: string): Promise<void>;
	};

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

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');

function restoreMediaDevices(): void {
	if (originalMediaDevices) {
		Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
	}
	else {
		try { delete (navigator as unknown as Record<string, unknown>)['mediaDevices']; }
		catch { /* read-only in some envs */ }
	}
}

function mockMediaDevices(overrides: Partial<MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> }>): void {
	Object.defineProperty(navigator, 'mediaDevices', {
		configurable: true,
		get: () => overrides,
	});
}

describe('audioOutputMethods', () => {
	beforeEach(() => {
		MockPlayer._resetRegistry();
	});

	afterEach(() => {
		MockPlayer._resetRegistry();
		document.body.innerHTML = '';
		restoreMediaDevices();
	});

	describe('audioOutputs()', () => {
		it('returns [] when navigator.mediaDevices is undefined', async () => {
			Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => undefined });
			const mockPlayer = makePlayer('ao-1');
			await expect(mockPlayer.audioOutputs()).resolves.toEqual([]);
		});

		it('returns [] when enumerateDevices is undefined', async () => {
			mockMediaDevices({} as any);
			const mockPlayer = makePlayer('ao-2');
			await expect(mockPlayer.audioOutputs()).resolves.toEqual([]);
		});

		it('filters to audiooutput devices only', async () => {
			const devices: Partial<MediaDeviceInfo>[] = [
				{ kind: 'audioinput', deviceId: 'mic-1' },
				{ kind: 'audiooutput', deviceId: 'spk-1' },
				{ kind: 'videoinput', deviceId: 'cam-1' },
				{ kind: 'audiooutput', deviceId: 'spk-2' },
			];
			mockMediaDevices({
				enumerateDevices: async () => devices as MediaDeviceInfo[],
			} as any);
			const mockPlayer = makePlayer('ao-3');
			const result = await mockPlayer.audioOutputs();
			expect(result).toHaveLength(2);
			expect(result.map(mediaDeviceInfo => mediaDeviceInfo.deviceId)).toEqual(['spk-1', 'spk-2']);
		});
	});

	describe('selectAudioOutput()', () => {
		it('throws BrowserPolicyError when selectAudioOutput is not in mediaDevices', async () => {
			mockMediaDevices({} as any);
			const mockPlayer = makePlayer('ao-4');
			await expect(mockPlayer.selectAudioOutput()).rejects.toBeInstanceOf(BrowserPolicyError);
		});

		it('throws BrowserPolicyError when navigator.mediaDevices is undefined', async () => {
			Object.defineProperty(navigator, 'mediaDevices', { configurable: true, get: () => undefined });
			const mockPlayer = makePlayer('ao-5');
			await expect(mockPlayer.selectAudioOutput()).rejects.toBeInstanceOf(BrowserPolicyError);
		});

		it('returns null when user aborts (AbortError)', async () => {
			const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
			mockMediaDevices({
				selectAudioOutput: async () => { throw abort; },
			} as any);
			const mockPlayer = makePlayer('ao-6');
			await expect(mockPlayer.selectAudioOutput()).resolves.toBeNull();
		});

		it('returns null when user denies (NotAllowedError)', async () => {
			const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
			mockMediaDevices({
				selectAudioOutput: async () => { throw denied; },
			} as any);
			const mockPlayer = makePlayer('ao-7');
			await expect(mockPlayer.selectAudioOutput()).resolves.toBeNull();
		});

		it('re-throws non-abort/non-allowed errors', async () => {
			const unexpected = Object.assign(new Error('unexpected'), { name: 'UnknownError' });
			mockMediaDevices({
				selectAudioOutput: async () => { throw unexpected; },
			} as any);
			const mockPlayer = makePlayer('ao-8');
			await expect(mockPlayer.selectAudioOutput()).rejects.toThrow('unexpected');
		});

		it('returns the selected device on success', async () => {
			const device: Partial<MediaDeviceInfo> = { deviceId: 'spk-3', kind: 'audiooutput', label: 'Headphones' };
			mockMediaDevices({
				selectAudioOutput: async () => device as MediaDeviceInfo,
			} as any);
			const mockPlayer = makePlayer('ao-9');
			await expect(mockPlayer.selectAudioOutput()).resolves.toBe(device);
		});
	});

	describe('audioOutput() getter / setter', () => {
		it('getter returns null by default', async () => {
			const mockPlayer = makePlayer('ao-10');
			await expect(mockPlayer.audioOutput()).resolves.toBeNull();
		});

		it('setter throws BrowserPolicyError when no backend / no setSinkId', async () => {
			const mockPlayer = makePlayer('ao-11');
			await expect(mockPlayer.audioOutput('device-1')).rejects.toBeInstanceOf(BrowserPolicyError);
		});

		it('setter calls setSinkId and stores device id when backend has setSinkId', async () => {
			const mockPlayer = makePlayer('ao-12');
			const setSinkId = vi.fn().mockResolvedValue(undefined);
			const mockElement = { setSinkId };
			(mockPlayer as any)._peekBackendTyped = () => ({ mediaElement: () => mockElement });
			await mockPlayer.audioOutput('device-x');
			expect(setSinkId).toHaveBeenCalledWith('device-x');
			await expect(mockPlayer.audioOutput()).resolves.toBe('device-x');
		});

		it('getter reflects the live element sinkId after a media-element swap, not the stale cached id', async () => {
			const mockPlayer = makePlayer('ao-13');
			const oldElement = { setSinkId: vi.fn().mockResolvedValue(undefined), sinkId: 'old-device' };
			(mockPlayer as any)._peekBackendTyped = () => ({ mediaElement: () => oldElement });
			await mockPlayer.audioOutput('old-device');
			await expect(mockPlayer.audioOutput()).resolves.toBe('old-device');

			const newElement = { setSinkId: vi.fn().mockResolvedValue(undefined), sinkId: 'new-device' };
			(mockPlayer as any)._peekBackendTyped = () => ({ mediaElement: () => newElement });

			await expect(mockPlayer.audioOutput()).resolves.toBe('new-device');
		});

		it('setter normalizes "" (system default) to null on read-back, per spec', async () => {
			const mockPlayer = makePlayer('ao-14');
			const setSinkId = vi.fn().mockResolvedValue(undefined);
			const mockElement = { setSinkId, sinkId: '' };
			(mockPlayer as any)._peekBackendTyped = () => ({ mediaElement: () => mockElement });

			await mockPlayer.audioOutput('');

			expect(setSinkId).toHaveBeenCalledWith('');
			await expect(mockPlayer.audioOutput()).resolves.toBeNull();
		});
	});
});
