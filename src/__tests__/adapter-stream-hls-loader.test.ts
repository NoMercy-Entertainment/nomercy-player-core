// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * HlsStreamSource intercepting loader: the hls.js hand-off must run once,
 * and only an interceptor failure falls back to the original response.
 */

import { describe, expect, it, vi } from 'vitest';
import { HlsStreamSource } from '../adapters/stream/hls';
import { StreamRegistry } from '../adapters/stream/registry';

type SuccessFn = (...args: unknown[]) => unknown;
type LoaderCtor = new (config: unknown) => { load: (...args: unknown[]) => void };

const shared = vi.hoisted(() => ({
	baseLoad: undefined as undefined | ((callbacks: { onSuccess: (...args: unknown[]) => unknown }) => void),
	config: undefined as undefined | { loader?: unknown },
}));

vi.mock('hls.js', () => {
	class BaseLoader {
		stats = {};
		destroy(): void {}
		abort(): void {}
		load(_context: unknown, _config: unknown, callbacks: { onSuccess: (...args: unknown[]) => unknown }): void {
			shared.baseLoad?.(callbacks);
		}
	}

	class FakeHls {
		static isSupported(): boolean { return true; }
		static Events = { MANIFEST_PARSED: 'p', LEVEL_SWITCHED: 'l', FRAG_LOADED: 'f', ERROR: 'e', MEDIA_ATTACHED: 'a' };
		static DefaultConfig = { loader: BaseLoader };
		private attached = new Set<() => void>();

		constructor(config: { loader?: unknown }) {
			shared.config = config;
		}

		on(event: string, fn: () => void): void {
			if (event === 'a')
				this.attached.add(fn);
		}

		off(event: string, fn: () => void): void {
			if (event === 'a')
				this.attached.delete(fn);
		}

		attachMedia(): void {
			Promise.resolve().then(() => [...this.attached].forEach(fn => fn()));
		}

		loadSource(): void {}
		detachMedia(): void {}
		destroy(): void {}
	}

	return { default: FakeHls };
});

describe('HlsStreamSource intercepting loader', () => {
	it('does not call onSuccess a second time when the hls.js hand-off throws', async () => {
		const registry = new StreamRegistry();
		registry.intercept(async (_url, response) => response);
		const source = new HlsStreamSource('https://x/stream.m3u8', registry);
		await source.attach(document.createElement('video') as unknown as HTMLMediaElement);

		const Loader = shared.config?.loader as LoaderCtor;
		const onSuccess = vi.fn<SuccessFn>(() => { throw new Error('hls.js failed'); });
		shared.baseLoad = (callbacks) => {
			// hls.js ignores the returned promise; the rejection is the throw under test.
			Promise.resolve(callbacks.onSuccess({ data: 'body', url: 'https://x/a.ts' }, {}, { url: 'https://x/a.ts' }, null)).catch(() => {});
		};
		new Loader({}).load({ url: 'https://x/a.ts' }, {}, { onSuccess });
		await new Promise<void>(resolve => setTimeout(resolve, 20));

		expect(onSuccess).toHaveBeenCalledTimes(1);
	});
});
