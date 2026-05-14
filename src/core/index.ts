// ──────────────────────────────────────────────────────────────────────────
// Core layer public surface.
//
// Consumers: `NMMusicPlayer` and `NMVideoPlayer` import from here (or from
// `../../base-player` which re-exports everything below).
// ──────────────────────────────────────────────────────────────────────────

export { KIT_VERSION } from './kit-version';
export { stateError, resourceError, pluginErrorFactory } from './errors';
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
export { transportMethods, seekingTransition } from './mixins/transport';
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
export { preloadStrategyMethods } from './mixins/preload-strategy';

export { transitionPhase } from './util/phase';
export { resolveBackend, peekBackend, peekBackendTyped } from './util/backend';
export type { BackendShape } from './util/backend';
export { assertReady, dispatchBefore } from './util/guards';
export { disposeSidecarSubtitle } from './util/sidecar';
export {
	hasTracksField,
	resolveItemTrackUrls,
	fetchChaptersVtt,
	resolveAndEmitChapters,
} from './util/tracks';
export type { SidecarTrack, ItemWithTracks, ItemWithDefinedTracks } from './util/tracks';
export { HOT_MUTATIONS, emitBeforeMutation } from './util/mutation-guard';
export { registerPlugin, markPluginLangLoaded, pluginLangLoadedSet } from './util/register-plugin';


// ──────────────────────────────────────────────────────────────────────────
// Convenience aggregator — every shared mixin in one tuple. Player libraries
// call `composeMixins(MyPlayer.prototype, ...playerCoreMethods)` to wire all
// shared behaviour onto their prototype.
// ──────────────────────────────────────────────────────────────────────────

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
import { preloadStrategyMethods } from './mixins/preload-strategy';

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
