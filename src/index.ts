// Auth-aware fetch (shared between Plugin.fetch and the player core's setup-time loads)
export { authFetch, isAuthError, isNetworkError } from './core/auth-fetch';
export type { AuthFetchOptions } from './core/auth-fetch';
export { mergeConfig } from './core/config-merge';
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
	setPlayerAudioContext,
	KIT_VERSION,
	lifecycleMethods,
	playerCoreMethods,
	pluginError,
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
export { CueParserRegistry } from './adapters/cue-parser/registry';
export type { CueParser } from './adapters/cue-parser/ICueParser';
export { buildSubtitleFragment } from './adapters/subtitle-renderer/dom';
export { parseLrc } from './adapters/cue-parser/lrc';
export type { LrcPayload } from './adapters/cue-parser/lrc';
export { parseVtt, parseVttSprite, parseVttSubtitles } from './adapters/cue-parser/vtt';
export type { VTTSpritePayload, VTTSubtitlePayload } from './adapters/cue-parser/vtt';
export { CueTracker } from './cues/tracker';

export type { CueTrackerOptions } from './cues/tracker';
// Shared cancellable-event dispatcher (used by both kit transport mixins and Plugin.dispatchBefore)
export { runDispatchBefore } from './core/dispatch';

export type { BeforeDispatchOutcome, DispatchBeforeOpts, DispatchTarget } from './core/dispatch';
// DOM helpers
export {
	addClasses,
	createButton,
	createElement,
	createSVG,
	removeClasses,
} from './core/mixins/dom-mixin';
export type { AddClasses, AppendTo, CreateElement } from './core/mixins/dom-mixin';
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
	NotImplementedError,
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
export { EventEmitter } from './adapters/event-bus/default';

// i18n — default English bundle (audit I7)
export { defaultTranslations, enTranslations } from './i18n/en';
export { LifecycleRegistry } from './adapters/lifecycle-registry/default';

export { Logger } from './adapters/logger/default';
export type { ILogger, LoggerOptions } from './adapters/logger/ILogger';

// Media list (cursor-aware list — both libs' queue surface delegates here)
export { MediaList } from './adapters/media-list/default';
export type { MediaListEvent } from './adapters/media-list/default';

// Mixin + factory
export { composeMixins } from './core/compose';
// Platform bundle (wake-lock, network, visibility, capabilities, fullscreen, pip)
export { browserPlatform } from './adapters/platform/browser';

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
} from './adapters/platform/browser';
// Plugin runtime
export { Plugin, PluginThrow } from './plugin';

export type {
	BeforeDispatchResult,
	DispatchBeforeOptions,
	FetchOptions,
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

export { embedPlugin, EmbedPlugin } from './plugins/embed';
export type { EmbedCommand, EmbedEventMessage, EmbedOptions } from './plugins/embed';

// Realtime channel abstraction (WebSocket / SignalR / Socket.IO via factory)
export { nativeWebSocketAdapter } from './adapters/realtime/websocket';

export type { IRealtimeChannel, RealtimeFactory, RealtimeFactoryOptions } from './adapters/realtime/IRealtimeChannel';
export { buildResolvedUrl } from './core/resolved-url';
export { IndexedDBBackend, LocalStorageBackend, MemoryStorageBackend } from './adapters/storage';
export type { IStorage } from './adapters/storage';
// Streams (re-exported here too for convenience; subpath imports also work)
export { HLS_EXT_RE } from './adapters/stream/hls';
export { StreamRegistry } from './adapters/stream/registry';
export type {
	StreamCapabilities,
	StreamEvent,
	StreamFactory,
	StreamFactoryOptions,
	StreamInterceptor,
	StreamLevel,
	StreamSource,
	StreamSourceState,
} from './adapters/stream/IStreamSource';
export { createNetworkTranslationLoader } from './adapters/translator/loaders/translation-loader';
export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './adapters/translator/loaders/translation-loader';
export { translationsFromGlob } from './adapters/translator/loaders/translations-glob';
export type { GlobModule } from './adapters/translator/loaders/translations-glob';
// Translator (i18n engine — swap for i18next / FormatJS / custom)
export { bcp47FallbackChain, DefaultTranslator } from './adapters/translator/translator';
export type { DefaultTranslatorOptions, ITranslator } from './adapters/translator/translator';
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
	CanPlayResult,
	Chapter,
	CueEventPayload,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
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
	PluginCtorWithId,
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

// Preload + transition strategy interfaces and default implementations
export {
	CrossfadeTransitionStrategy,
	DefaultPreloadStrategy,
	GaplessTransitionStrategy,
} from './adapters/preload/default';
export type {
	PreloadAsset,
	PreloadContext,
	PreloadStrategy,
	TransitionBackend,
	TransitionContext,
	TransitionStrategy,
} from './adapters/preload/default';
export { preloadStrategyMethods } from './base-player';
