import type { AuthConfig } from '../adapters/auth';

import type { DrmConfig } from '../adapters/drm';
import type { ICapabilitiesProbe } from '../adapters/platform/capabilities';
import type { IFullscreenController } from '../adapters/platform/fullscreen';
import type { INetworkMonitor } from '../adapters/platform/network';
import type { IPipController } from '../adapters/platform/pip';
import type { IVisibilityMonitor } from '../adapters/platform/visibility';
import type { IWakeLock } from '../adapters/platform/wake-lock';
import type { IUrlResolver } from '../adapters/url-resolver';
import { describe, expect, it } from 'vitest';
import { addClasses } from '../adapters/class-manager';
import { systemClock } from '../adapters/clock';
import { CueParserRegistry } from '../adapters/cue-parser';
import { createElement } from '../adapters/element-factory';
import { EventEmitter } from '../adapters/event-bus';
import { defaultFetch } from '../adapters/fetch';
import { defaultIdGenerator } from '../adapters/id-generator';
import { bcp47FallbackChain } from '../adapters/language-matcher';
import { LifecycleRegistry } from '../adapters/lifecycle-registry';
import { Logger } from '../adapters/logger';
import { MediaList } from '../adapters/media-list';
import { browserPlatform } from '../adapters/platform';
import { DefaultPreloadStrategy } from '../adapters/preload';
import { nativeWebSocketAdapter } from '../adapters/realtime';
import { DEFAULT_RETRY_POLICY } from '../adapters/retry-policy';
import { LocalStorageBackend, MemoryStorageBackend } from '../adapters/storage';
import { StreamRegistry } from '../adapters/stream';
import { buildSubtitleFragment } from '../adapters/subtitle-renderer';
import { DefaultTranslator } from '../adapters/translator';
import { StubPlayer } from '../testing';

describe('subpath-exports', () => {
	describe('adapters/storage', () => {
		it('LocalStorageBackend is constructable', () => {
			expect(new LocalStorageBackend()).toBeTruthy();
		});

		it('MemoryStorageBackend is constructable', () => {
			expect(new MemoryStorageBackend()).toBeTruthy();
		});
	});

	describe('adapters/stream', () => {
		it('StreamRegistry is constructable', () => {
			expect(new StreamRegistry()).toBeTruthy();
		});
	});

	describe('adapters/platform', () => {
		it('browserPlatform is an object with expected shape', () => {
			expect(typeof browserPlatform).toBe('object');
		});
	});

	describe('adapters/platform/wake-lock (type-only)', () => {
		it('IWakeLock is importable as a type', () => {
			const ref: IWakeLock | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/platform/network (type-only)', () => {
		it('INetworkMonitor is importable as a type', () => {
			const ref: INetworkMonitor | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/platform/visibility (type-only)', () => {
		it('IVisibilityMonitor is importable as a type', () => {
			const ref: IVisibilityMonitor | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/platform/capabilities (type-only)', () => {
		it('ICapabilitiesProbe is importable as a type', () => {
			const ref: ICapabilitiesProbe | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/platform/fullscreen (type-only)', () => {
		it('IFullscreenController is importable as a type', () => {
			const ref: IFullscreenController | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/platform/pip (type-only)', () => {
		it('IPipController is importable as a type', () => {
			const ref: IPipController | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/realtime', () => {
		it('nativeWebSocketAdapter is a function', () => {
			expect(typeof nativeWebSocketAdapter).toBe('function');
		});
	});

	describe('adapters/translator', () => {
		it('DefaultTranslator is constructable', () => {
			expect(new DefaultTranslator()).toBeTruthy();
		});
	});

	describe('adapters/language-matcher', () => {
		it('bcp47FallbackChain is a function', () => {
			expect(typeof bcp47FallbackChain).toBe('function');
		});
	});

	describe('adapters/preload', () => {
		it('DefaultPreloadStrategy is constructable', () => {
			expect(new DefaultPreloadStrategy()).toBeTruthy();
		});
	});

	describe('adapters/cue-parser', () => {
		it('CueParserRegistry is constructable', () => {
			expect(new CueParserRegistry()).toBeTruthy();
		});
	});

	describe('adapters/subtitle-renderer', () => {
		it('buildSubtitleFragment is a function', () => {
			expect(typeof buildSubtitleFragment).toBe('function');
		});
	});

	describe('adapters/logger', () => {
		it('Logger is constructable', () => {
			expect(new Logger({ prefix: 'test' })).toBeTruthy();
		});
	});

	describe('adapters/retry-policy', () => {
		it('DEFAULT_RETRY_POLICY has expected shape', () => {
			expect(DEFAULT_RETRY_POLICY).toBeTruthy();
			expect(typeof DEFAULT_RETRY_POLICY).toBe('object');
		});
	});

	describe('adapters/event-bus', () => {
		it('EventEmitter is constructable', () => {
			expect(new EventEmitter()).toBeTruthy();
		});
	});

	describe('adapters/media-list', () => {
		it('MediaList is constructable', () => {
			expect(new MediaList()).toBeTruthy();
		});
	});

	describe('adapters/lifecycle-registry', () => {
		it('LifecycleRegistry is constructable', () => {
			expect(new LifecycleRegistry()).toBeTruthy();
		});
	});

	describe('adapters/fetch', () => {
		it('defaultFetch is a function', () => {
			expect(typeof defaultFetch).toBe('function');
		});
	});

	describe('adapters/clock', () => {
		it('systemClock has expected shape', () => {
			expect(systemClock).toBeTruthy();
			expect(typeof systemClock.now).toBe('function');
		});
	});

	describe('adapters/id-generator', () => {
		it('defaultIdGenerator has a next() method', () => {
			expect(typeof defaultIdGenerator.next).toBe('function');
		});
	});

	describe('adapters/element-factory', () => {
		it('createElement is a function', () => {
			expect(typeof createElement).toBe('function');
		});
	});

	describe('adapters/class-manager', () => {
		it('addClasses is a function', () => {
			expect(typeof addClasses).toBe('function');
		});
	});

	describe('adapters/auth (type-only)', () => {
		it('AuthConfig is importable as a type', () => {
			const ref: AuthConfig | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/drm (type-only)', () => {
		it('DrmConfig is importable as a type', () => {
			const ref: DrmConfig | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('adapters/url-resolver (type-only)', () => {
		it('IUrlResolver is importable as a type', () => {
			const ref: IUrlResolver | undefined = undefined;
			expect(ref).toBeUndefined();
		});
	});

	describe('testing', () => {
		it('StubPlayer is constructable', () => {
			expect(typeof StubPlayer).toBe('function');
		});
	});
});
