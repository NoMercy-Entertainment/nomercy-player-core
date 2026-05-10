// Auth-aware fetch (shared between Plugin.fetch and the player core's setup-time loads)
export { authFetch, isAuthError, isNetworkError } from './auth-fetch';
export type { AuthFetchOptions } from './auth-fetch';
// Player core — shared logic composed onto NMMusicPlayer + NMVideoPlayer
// prototypes via `composeMixins`. Lives here so neither library can drift
// from the spec; one fix lands once and applies everywhere.
export {
	authMethods,
	baseUrlAudioContextMethods,
	containerClassEmitMethods,
	cueParserMethods,
	experimentalDescriptor,
	i18nMethods,
	initPlayerCoreState,
	KIT_VERSION,
	lifecycleMethods,
	playerCoreMethods,
	pluginErrorFactory,
	playerStateMethods,
	pluginRegistrationMethods,
	queueMethods,
	resolvePlayerConstructor,
	resourceError,
	stateError,
	stateMethods,
	timeMethods,
	transportMethods,
	volumeMethods,
} from './base-player';

export type {
	PlayerCtorResolution,
	PlayStateToken,
	RepeatStateToken,
	ShuffleStateToken,
	VolumeStateToken,
} from './base-player';
// Cues
export { createCueList, createMutableCueList } from './cues/cue';
export type { Cue, CueList, MutableCueList } from './cues/cue';
export { CueParserRegistry } from './cues/parser-registry';
export type { CueParser } from './cues/parser-registry';
export { buildSubtitleFragment } from './cues/subtitle-fragment';
export { parseLrc } from './cues/parsers/lrc';
export type { LrcPayload } from './cues/parsers/lrc';
export { parseVtt, parseVttSprite, parseVttSubtitles } from './cues/parsers/vtt';
export type { VTTSpritePayload, VTTSubtitlePayload } from './cues/parsers/vtt';
export { CueTracker } from './cues/tracker';

export type { CueTrackerOptions } from './cues/tracker';
// Shared cancellable-event dispatcher (used by both kit transport mixins and Plugin.dispatchBefore)
export { runDispatchBefore } from './dispatch';

export type { BeforeDispatchOutcome, DispatchBeforeOpts, DispatchTarget } from './dispatch';
// DOM helpers
export {
	addClasses,
	createButton,
	createElement,
	createSVG,
	removeClasses,
} from './dom';
export type { AddClasses, AppendTo, CreateElement } from './dom';
// Errors
export {
	AuthError,
	BrowserPolicyError,
	DEFAULT_RETRY_POLICY,
	DrmError,
	formatCode,
	makeCode,
	MediaFormatError,
	NetworkError,
	parseCode,
	PlayerError,
	PluginError,
	ResourceError,
	SEVERITY,
	SEVERITY_LEVEL,
	StateError,
	StreamError,
	VENDOR,
} from './errors';
export type {
	CodeFields,
	ErrorScope,
	PlayerErrorEvent,
	PlayerErrorInit,
	RetryConfig,
	RetryPolicy,
	Severity,
} from './errors';
// Primitives
export { EventEmitter } from './events';

// i18n — default English bundle (audit I7)
export { defaultTranslations, enTranslations } from './i18n/en';
export { LifecycleRegistry } from './lifecycle';

export { Logger } from './logger';
export type { ILogger, LoggerOptions } from './logger';

// Media list (cursor-aware list — both libs' queue surface delegates here)
export { MediaList } from './medialist';
export type { MediaListEvent } from './medialist';

// Mixin + factory
export { composeMixins } from './mixins';
// Platform bundle (wake-lock, network, visibility, capabilities, fullscreen, pip)
export { browserPlatform } from './platform';

export type {
	DecodeCapability,
	DecodeProfile,
	ICapabilitiesProbe,
	IFullscreenController,
	INetworkMonitor,
	IPipController,
	IPlatform,
	IVisibilityMonitor,
	IWakeLock,
	NetworkType,
} from './platform';
// Plugin runtime
export { Plugin, PluginThrow } from './plugin';

export type {
	BeforeDispatchResult,
	DispatchBeforeOptions,
	PluginRecoveryAction,
	PluginState,
	ThrowPayload,
} from './plugin';
// Audio-graph + canvas plugins (opt-in, layered) — every Web Audio / canvas
// plugin builds on these. Apps that don't add them pay zero AudioContext /
// canvas / RAF cost.
export { audioGraphPlugin, AudioGraphPlugin } from './plugins/audio-graph';

export type { AudioGraphEvents, AudioGraphOptions } from './plugins/audio-graph';

export { canvasPlugin, CanvasPlugin } from './plugins/canvas';
export type { CanvasEvents, CanvasOptions, CanvasRenderFn } from './plugins/canvas';

export { castSenderPlugin, CastSenderPlugin } from './plugins/cast-sender';
export type { CastSenderEvents, CastSenderOptions, ChromeCastMediaCtors } from './plugins/cast-sender';

export { equalizerPlugin, EqualizerPlugin } from './plugins/equalizer/index';
export type {
	EqBand,
	EqPreset,
	EqualizerEvents,
	EqualizerOptions,
} from './plugins/equalizer/index';
export { mixerPlugin, MixerPlugin } from './plugins/mixer';
export type { MixerEvents, MixerOptions } from './plugins/mixer';
export { spectrumPlugin, SpectrumPlugin } from './plugins/spectrum';
export type { SpectrumOptions } from './plugins/spectrum';

export { VisualizationPlugin } from './plugins/visualization';
export type { VisualizationFrame, VisualizationOptions } from './plugins/visualization';

// Realtime channel abstraction (WebSocket / SignalR / Socket.IO via factory)
export { nativeWebSocketAdapter } from './realtime';

export type { IRealtimeChannel, RealtimeFactory, RealtimeFactoryOptions } from './realtime';
export { buildResolvedUrl } from './resolved-url';
export { IndexedDBBackend, LocalStorageBackend, MemoryStorageBackend } from './storage';
export type { IStorage } from './storage';
// Streams (re-exported here too for convenience; subpath imports also work)
export { StreamRegistry } from './streams/registry';
export type {
	StreamCapabilities,
	StreamEvent,
	StreamFactory,
	StreamFactoryOptions,
	StreamInterceptor,
	StreamLevel,
	StreamSource,
	StreamSourceState,
} from './streams/source';
export { createNetworkTranslationLoader } from './translation-loader';
export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './translation-loader';
export { translationsFromGlob } from './translations-glob';
export type { GlobModule } from './translations-glob';
// Translator (i18n engine — swap for i18next / FormatJS / custom)
export { bcp47FallbackChain, DefaultTranslator } from './translator';
export type { DefaultTranslatorOptions, ITranslator } from './translator';
// Core types
export type {
	ActionOptions,
	ActionSource,
	AudioTrack,
	AuthConfig,
	AuthHeaderValue,
	BaseEventMap,
	BasePlayerConfig,
	BasePlaylistItem,
	BeforeEvent,
	Chapter,
	CueEventPayload,
	DeviceCapabilities,
	DrmConfig,
	IPlayer,
	LoadOptions,
	LogLevel,
	LogSink,
	PlaybackMetrics,
	PlayerConstructorId,
	PlayerExperimental,
	PlayerPhase,
	PluginAdvisory,
	PreventedReason,
	QualityLevel,
	RequireSpec,
	ResolvedUrl,
	SubtitleCue,
	SubtitleCueChange,
	SubtitleStyle,
	SubtitleTrack,
	TimeState,
	TranslationLoader,
	Translations,
	UrlCategory,
	UrlResolver,
	UrlResolverContext,
} from './types';
export {
	AudioTrackState,
	BufferState,
	CastState,
	NetworkState,
	QualityState,
	SetupState,
	VisibilityState,
} from './types';
