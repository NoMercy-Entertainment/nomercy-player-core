/**
 * Public surface of the kit's core layer. `NMMusicPlayer` and `NMVideoPlayer`
 * import from here (or from `../../base-player` which re-exports everything
 * below) to pick up all shared primitives: version, errors, constructor
 * resolution, state initialisation, and the full mixin set.
 */

export { KIT_VERSION } from './kit-version';
export { stateError, resourceError, pluginError, browserPolicyError, mediaFormatError } from '../errors';
export { resolvePlayerConstructor } from './constructor';
export type { PlayerCtorResolution } from './constructor';
export {
	initPlayerCoreState,
	setPlayerAudioContext,
} from './state';
export type {
	SidecarSubtitleContext,
	PlayStateToken,
	VolumeStateToken,
	RepeatStateToken,
	ShuffleStateToken,
	PlayerCoreState,
	MixinSurface,
	Internals,
} from './state';

export { lifecycleMethods } from './mixins/lifecycle';
export { baseUrlAudioContextMethods } from './mixins/base-url-audio-context';
export { experimentalDescriptor } from './mixins/experimental';
export { i18nMethods } from './mixins/i18n';
export { cueParserMethods } from './mixins/cue-parser';
export { transportMethods } from './mixins/transport';
export { timeMethods } from './mixins/time';
export { volumeMethods } from './mixins/volume';
export { stateMethods } from './mixins/state-mutators';
export { playerStateMethods } from './mixins/player-state';
export { queueMethods } from './mixins/queue';
export { pluginRegistrationMethods } from './mixins/plugin-registration';
export { authMethods } from './mixins/auth';
export { streamRegistrationMethods } from './mixins/stream-registration';
export { mediaTracksMethods } from './mixins/media-tracks';
export { deviceMethods } from './mixins/device';
export { audioOutputMethods } from './mixins/audio-output';
export { castMethods } from './mixins/cast';
export { abrMethods } from './mixins/abr';
export { metricsMethods } from './mixins/metrics';
export { domMethods } from './mixins/dom-mixin';
export { loadingMethods } from './mixins/loading';
export { containerClassEmitMethods } from './mixins/container-class-emit';
export { preloadStrategyMethods } from './mixins/preload-strategy-mixin';

export type { BackendShape } from './mixins/player-state';
export type { SidecarTrack, ItemWithTracks, ItemWithDefinedTracks } from './mixins/media-tracks';
export { HOT_MUTATIONS } from './mixins/state-mutators';


import { lifecycleMethods } from './mixins/lifecycle';
import { baseUrlAudioContextMethods } from './mixins/base-url-audio-context';
import { experimentalDescriptor } from './mixins/experimental';
import { i18nMethods } from './mixins/i18n';
import { cueParserMethods } from './mixins/cue-parser';
import { transportMethods } from './mixins/transport';
import { timeMethods } from './mixins/time';
import { volumeMethods } from './mixins/volume';
import { stateMethods } from './mixins/state-mutators';
import { playerStateMethods } from './mixins/player-state';
import { queueMethods } from './mixins/queue';
import { pluginRegistrationMethods } from './mixins/plugin-registration';
import { authMethods } from './mixins/auth';
import { streamRegistrationMethods } from './mixins/stream-registration';
import { mediaTracksMethods } from './mixins/media-tracks';
import { deviceMethods } from './mixins/device';
import { audioOutputMethods } from './mixins/audio-output';
import { castMethods } from './mixins/cast';
import { abrMethods } from './mixins/abr';
import { metricsMethods } from './mixins/metrics';
import { domMethods } from './mixins/dom-mixin';
import { loadingMethods } from './mixins/loading';
import { containerClassEmitMethods } from './mixins/container-class-emit';
import { preloadStrategyMethods } from './mixins/preload-strategy-mixin';

/**
 * Every shared mixin collected into a single `as const` tuple.
 *
 * Player libraries call `composeMixins(MyPlayer.prototype, ...playerCoreMethods)`
 * to wire all shared behaviour onto their prototype in one shot. Adding a new
 * kit mixin means appending it here and to the parallel export above — the
 * `as const` preserves element-level types so `composeMixins` can assert that
 * each entry is a valid mixin object.
 */
export const playerCoreMethods = [
	lifecycleMethods,
	baseUrlAudioContextMethods,
	experimentalDescriptor,
	i18nMethods,
	cueParserMethods,
	transportMethods,
	timeMethods,
	volumeMethods,
	stateMethods,
	playerStateMethods,
	queueMethods,
	pluginRegistrationMethods,
	authMethods,
	streamRegistrationMethods,
	mediaTracksMethods,
	deviceMethods,
	audioOutputMethods,
	castMethods,
	abrMethods,
	metricsMethods,
	domMethods,
	loadingMethods,
	containerClassEmitMethods,
	preloadStrategyMethods,
] as const;
