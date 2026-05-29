/**
 * Public surface of the kit's core layer. `NMMusicPlayer` and `NMVideoPlayer`
 * import from here (or from `../../base-player` which re-exports everything
 * below) to pick up all shared primitives: version, errors, constructor
 * resolution, state initialisation, and the full mixin set.
 */

import { abrMethods } from './mixins/abr';
import { audioOutputMethods } from './mixins/audio-output';
import { authMethods } from './mixins/auth';
import { baseUrlAudioContextMethods } from './mixins/base-url-audio-context';
import { castMethods } from './mixins/cast';
import { containerClassEmitMethods } from './mixins/container-class-emit';
import { cueParserMethods } from './mixins/cue-parser';
import { deviceMethods } from './mixins/device';
import { domMethods } from './mixins/dom-mixin';
import { experimentalDescriptor } from './mixins/experimental';
import { i18nMethods } from './mixins/i18n';
import { lifecycleMethods } from './mixins/lifecycle';
import { loadingMethods } from './mixins/loading';
import { mediaTracksMethods } from './mixins/media-tracks';
import { metricsMethods } from './mixins/metrics';
import { playerStateMethods } from './mixins/player-state';
import { pluginRegistrationMethods } from './mixins/plugin-registration';
import { preloadStrategyMethods } from './mixins/preload-strategy-mixin';
import { queueMethods } from './mixins/queue';
import { stateMethods } from './mixins/state-mutators';
import { streamRegistrationMethods } from './mixins/stream-registration';
import { timeMethods } from './mixins/time';
import { transportMethods } from './mixins/transport';
import { volumeMethods } from './mixins/volume';

export {
	browserPolicyError,
	mediaFormatError,
	pluginError,
	resourceError,
	stateError,
} from '../errors';
export { resolvePlayerConstructor } from './constructor';
export type { PlayerCtorResolution } from './constructor';
export { KIT_VERSION } from './kit-version';
export { abrMethods } from './mixins/abr';
export { audioOutputMethods } from './mixins/audio-output';

export { authMethods } from './mixins/auth';
export { baseUrlAudioContextMethods } from './mixins/base-url-audio-context';
export { castMethods } from './mixins/cast';
export { containerClassEmitMethods } from './mixins/container-class-emit';
export { cueParserMethods } from './mixins/cue-parser';
export { deviceMethods } from './mixins/device';
export { domMethods } from './mixins/dom-mixin';
export { experimentalDescriptor } from './mixins/experimental';
export { i18nMethods } from './mixins/i18n';
export { lifecycleMethods } from './mixins/lifecycle';
export { loadingMethods } from './mixins/loading';
export { mediaTracksMethods } from './mixins/media-tracks';
export type { ItemWithDefinedTracks, ItemWithTracks, SidecarTrack } from './mixins/media-tracks';
export { metricsMethods } from './mixins/metrics';
export { playerStateMethods } from './mixins/player-state';
export type { BackendShape } from './mixins/player-state';
export { pluginRegistrationMethods } from './mixins/plugin-registration';
export { preloadStrategyMethods } from './mixins/preload-strategy-mixin';
export { queueMethods } from './mixins/queue';
export { stateMethods } from './mixins/state-mutators';
export { HOT_MUTATIONS } from './mixins/state-mutators';
export { streamRegistrationMethods } from './mixins/stream-registration';
export { timeMethods } from './mixins/time';
export { transportMethods } from './mixins/transport';

export { volumeMethods } from './mixins/volume';
export {
	initPlayerCoreState,
	setPlayerAudioContext,
} from './state';
export type {
	Internals,
	MixinSurface,
	PlayerCoreState,
	PlayStateToken,
	RepeatStateToken,
	ShuffleStateToken,
	SidecarSubtitleContext,
	VolumeStateToken,
} from './state';

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
