// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type {
	DecodeCapability,
	DecodeProfile,
	ICapabilitiesProbe,
	INetworkMonitor,
	IPlatform,
	IVisibilityMonitor,
	IWakeLock,
	NetworkType,
} from '../../adapters/platform/IPlatform';

export interface FakePlatform extends IPlatform {
	visibilitySubscribeCalls: number;
}

/**
 * Minimal IPlatform fake for DI tests. Tracks how many times
 * `visibility.subscribe` was called so tests can assert the lifecycle wiring
 * used the injected platform, not the `browserPlatform` default.
 */
export function makeFakePlatform(): FakePlatform {
	let visibilitySubscribeCalls = 0;

	const visibility: IVisibilityMonitor = {
		isVisible(): boolean { return true; },
		subscribe(_fn: (visible: boolean) => void): () => void {
			visibilitySubscribeCalls += 1;
			return (): void => {};
		},
	};

	const network: INetworkMonitor = {
		isOnline(): boolean { return true; },
		type(): NetworkType { return 'wifi'; },
		downlinkMbps(): number | undefined { return undefined; },
		rttMs(): number | undefined { return undefined; },
		subscribe(_fn: (state: { online: boolean; type: NetworkType }) => void): () => void {
			return (): void => {};
		},
	};

	const wakeLock: IWakeLock = {
		acquire(): Promise<void> { return Promise.resolve(); },
		release(): Promise<void> { return Promise.resolve(); },
		isHeld(): boolean { return false; },
	};

	const capabilities: ICapabilitiesProbe = {
		canDecode(_profile: DecodeProfile): Promise<DecodeCapability> {
			return Promise.resolve({ supported: true, smooth: true, powerEfficient: true });
		},
	};

	const platform = {
		get visibilitySubscribeCalls(): number { return visibilitySubscribeCalls; },
		visibility,
		network,
		wakeLock,
		capabilities,
	} as FakePlatform;

	return platform;
}
