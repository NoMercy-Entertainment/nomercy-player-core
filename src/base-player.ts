/**
 * Shared player core — the **logic** that both NMMusicPlayer and NMVideoPlayer
 * exhibit. Lives in the kit so neither library can drift from the spec, and so
 * any behavior change lands once and applies everywhere.
 *
 * This file is a re-export façade. All implementations live under `src/core/`.
 * Import paths that previously pointed here continue to resolve correctly.
 */

export {
	stateError,
	resourceError,
	pluginError,
} from './errors';

export { KIT_VERSION } from './core/kit-version';

export type { PlayerCtorResolution } from './core/constructor';
export { resolvePlayerConstructor } from './core/constructor';

export type {
	PlayStateToken,
	VolumeStateToken,
	RepeatStateToken,
	ShuffleStateToken,
} from './core/state';
export {
	initPlayerCoreState,
	setPlayerAudioContext,
} from './core/state';

export { lifecycleMethods } from './core/mixins/lifecycle';
export { containerClassEmitMethods } from './core/mixins/container-class-emit';
export { baseUrlAudioContextMethods } from './core/mixins/base-url-audio-context';
export { experimentalDescriptor } from './core/mixins/experimental';
export { i18nMethods } from './core/mixins/i18n';
export { cueParserMethods } from './core/mixins/cue-parser';
export { transportMethods } from './core/mixins/transport';
export { timeMethods } from './core/mixins/time';
export { volumeMethods } from './core/mixins/volume';
export { stateMethods } from './core/mixins/state-mutators';
export { playerStateMethods } from './core/mixins/player-state';
export { queueMethods } from './core/mixins/queue';
export { pluginRegistrationMethods } from './core/mixins/plugin-registration';
export { authMethods } from './core/mixins/auth';
export { streamRegistrationMethods } from './core/mixins/stream-registration';
export { mediaTracksMethods } from './core/mixins/media-tracks';
export { deviceMethods } from './core/mixins/device';
export { audioOutputMethods } from './core/mixins/audio-output';
export { castMethods } from './core/mixins/cast';
export { abrMethods } from './core/mixins/abr';
export { metricsMethods } from './core/mixins/metrics';
export { domMethods } from './core/mixins/dom-mixin';
export { loadingMethods } from './core/mixins/loading';
export { preloadStrategyMethods } from './core/mixins/preload-strategy-mixin';

export { playerCoreMethods } from './core/index';
