/**
 * Shared player core — the **logic** that both NMMusicPlayer and NMVideoPlayer
 * exhibit. Lives in the kit so neither library can drift from the spec, and so
 * any behavior change lands once and applies everywhere.
 *
 * This file is a re-export façade. All implementations live under `src/core/`.
 * Import paths that previously pointed here continue to resolve correctly.
 */

export type { PlayerCtorResolution } from './core/constructor';

export { resolvePlayerConstructor } from './core/constructor';

export { playerCoreMethods } from './core/index';
export { KIT_VERSION } from './core/kit-version';

export { abrMethods } from './core/mixins/abr';
export { audioOutputMethods } from './core/mixins/audio-output';

export { authMethods } from './core/mixins/auth';
export { baseUrlAudioContextMethods } from './core/mixins/base-url-audio-context';
export { castMethods } from './core/mixins/cast';
export { containerClassEmitMethods } from './core/mixins/container-class-emit';
export { cueParserMethods } from './core/mixins/cue-parser';
export { deviceMethods } from './core/mixins/device';
export { domMethods } from './core/mixins/dom-mixin';
export { experimentalDescriptor } from './core/mixins/experimental';
export { i18nMethods } from './core/mixins/i18n';
export { lifecycleMethods } from './core/mixins/lifecycle';
export { loadingMethods } from './core/mixins/loading';
export { mediaTracksMethods, normalizeLanguage } from './core/mixins/media-tracks';
export { metricsMethods } from './core/mixins/metrics';
export { playerStateMethods } from './core/mixins/player-state';
export { playQueueMethods } from './core/mixins/play-queue';
export { pluginRegistrationMethods } from './core/mixins/plugin-registration';
export { preloadStrategyMethods } from './core/mixins/preload-strategy-mixin';
export { queueMethods } from './core/mixins/queue';
export { stateMethods } from './core/mixins/state-mutators';
export { streamRegistrationMethods } from './core/mixins/stream-registration';
export { timeMethods } from './core/mixins/time';
export { transportMethods } from './core/mixins/transport';
export { volumeMethods } from './core/mixins/volume';
export type {
	PlayStateToken,
	RepeatStateToken,
	ShuffleStateToken,
	VolumeStateToken,
} from './core/state';
export {
	initPlayerCoreState,
	setPlayerAudioContext,
} from './core/state';

export {
	pluginError,
	resourceError,
	stateError,
} from './errors';
