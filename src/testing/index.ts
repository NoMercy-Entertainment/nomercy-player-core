/**
 * Testing utilities. Exported via the kit's `/testing` subpath so downstream
 * packages (music-v2, video-v2, third-party plugin authors) get a stable API
 * surface for writing tests against the player contract.
 *
 * Usage:
 *
 * ```ts
 * import {
 *   describePlugin,
 *   runIPlayerContract,
 *   StubPlayer,
 *   assertNoListenerLeak,
 * } from '@nomercy-entertainment/nomercy-player-core/testing';
 * ```
 */

export { runIPlayerContract } from './contract';
export { describePlugin } from './describe-plugin';

export type { DescribePluginOptions, PluginTestContext } from './describe-plugin';

export { describePluginAgainst } from './describe-plugin-against';
export type { DescribePluginAgainstOptions, PluginAgainstTestContext } from './describe-plugin-against';

export {
	assertNoListenerLeak,
	assertNoListenerLeakOverCycles,
	countAllListeners,
} from './leak-harness';
export type { LeakAssertionResult } from './leak-harness';

export { mockFetch } from './mock-fetch';

export type { MockFetch, MockFetchCall, MockFetchResponse } from './mock-fetch';
export { createStubPlayer, StubPlayer } from './stub-player';
