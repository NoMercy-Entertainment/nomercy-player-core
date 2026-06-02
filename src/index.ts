export type { ICueParser } from './adapters/cue-parser/ICueParser';
export { parseLrc } from './adapters/cue-parser/lrc';
export type { LrcPayload } from './adapters/cue-parser/lrc';
export { CueParserRegistry } from './adapters/cue-parser/registry';

export { parseVtt, parseVttSprite, parseVttSubtitles } from './adapters/cue-parser/vtt';
export type { VTTSpritePayload, VTTSubtitlePayload } from './adapters/cue-parser/vtt';
// DOM helpers
export {
	addClasses,
	createButton,
	createElement,
	createSVG,
	removeClasses,
} from './adapters/element-factory';
export type { AddClasses, AppendTo, CreateElement } from './adapters/element-factory';
// Primitives
export { EventEmitter } from './adapters/event-bus/default';
// Language matcher (BCP-47 fallback chain — swap for a custom matching strategy)
export { bcp47FallbackChain } from './adapters/language-matcher';
export type { ILanguageMatcher } from './adapters/language-matcher';
export { LifecycleRegistry } from './adapters/lifecycle-registry/default';
export { Logger } from './adapters/logger/default';
export type { ILogger, LoggerOptions } from './adapters/logger/ILogger';
// Media list (cursor-aware list — both libs' queue surface delegates here)
export { MediaList } from './adapters/media-list/default';

export type { MediaListEvent } from './adapters/media-list/default';
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
// Preload + transition strategy interfaces and default implementations
export {
	CrossfadeTransitionStrategy,
	DefaultPreloadStrategy,
	GaplessTransitionStrategy,
} from './adapters/preload/default';
export type {
	CrossfadeCurve,
	IPreloadStrategy,
	ITransitionBackend,
	ITransitionStrategy,
	PreloadAsset,
	PreloadContext,
	TransitionContext,
} from './adapters/preload/default';
export type { IRealtimeChannel, RealtimeFactory, RealtimeFactoryOptions } from './adapters/realtime/IRealtimeChannel';
// Realtime channel abstraction (WebSocket / SignalR / Socket.IO via factory)
export { nativeWebSocketAdapter } from './adapters/realtime/websocket';
export { IndexedDBBackend, LocalStorageBackend, MemoryStorageBackend } from './adapters/storage';

export type { IStorage } from './adapters/storage';
// Streams (re-exported here too for convenience; subpath imports also work)
export { HLS_EXT_RE } from './adapters/stream/hls';

export type {
	IStreamFactory,
	IStreamSource,
	StreamCapabilities,
	StreamEvent,
	StreamFactoryOptions,
	StreamInterceptor,
	StreamLevel,
	StreamSourceState,
} from './adapters/stream/IStreamSource';
export { StreamRegistry } from './adapters/stream/registry';

export { buildSubtitleFragment } from './adapters/subtitle-renderer/dom';
export { createNetworkTranslationLoader } from './adapters/translator/loaders/translation-loader';

export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './adapters/translator/loaders/translation-loader';
export { translationsFromGlob } from './adapters/translator/loaders/translations-glob';

export type { GlobModule } from './adapters/translator/loaders/translations-glob';
// Translator (i18n engine — swap for i18next / FormatJS / custom)
export { DefaultTranslator } from './adapters/translator/translator';

export type { DefaultTranslatorOptions, ITranslator } from './adapters/translator/translator';
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
	playerStateMethods,
	pluginError,
	pluginRegistrationMethods,
	queueMethods,
	resolvePlayerConstructor,
	resourceError,
	setPlayerAudioContext,
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
export { preloadStrategyMethods } from './base-player';

// Auth-aware fetch (shared between Plugin.fetch and the player core's setup-time loads)
export { authFetch, isAuthError, isNetworkError } from './core/auth-fetch';

export type { AuthFetchOptions } from './core/auth-fetch';
// Mixin + factory
export { composeMixins } from './core/compose';

export { mergeConfig } from './core/config-merge';
// Cues
export { createCueList, createMutableCueList } from './core/cues/cue';

export type { Cue, CueList, MutableCueList } from './core/cues/cue';
export { CueTracker } from './core/cues/tracker';
export type { CueTrackerOptions } from './core/cues/tracker';
// Shared cancellable-event dispatcher (used by both kit transport mixins and Plugin.dispatchBefore)
export { runDispatchBefore } from './core/dispatch';
export type { BeforeDispatchOutcome, DispatchBeforeOpts, DispatchTarget } from './core/dispatch';
// Plugin runtime
export { Plugin, PluginThrow } from './core/plugin';

export type {
	BeforeDispatchResult,
	DispatchBeforeOptions,
	FetchOptions,
	PluginRecoveryAction,
	PluginState,
	ThrowPayload,
} from './core/plugin';
export { buildResolvedUrl } from './core/resolved-url';

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
	IRetryPolicy,
	PlayerErrorEvent,
	PlayerErrorInit,
	RetryConfig,
	Severity,
} from './errors';

// i18n — default English bundle (audit I7)
export { defaultTranslations, enTranslations } from './i18n/en';

// Audio-graph + canvas plugins (opt-in, layered) — every Web Audio / canvas
// plugin builds on these. Apps that don't add them pay zero AudioContext /
// canvas / RAF cost.
export { audioGraphPlugin, AudioGraphPlugin } from './plugins/audio-graph';
export type { AudioGraphEvents, AudioGraphOptions } from './plugins/audio-graph';
export { canvasPlugin, CanvasPlugin } from './plugins/canvas';
export type { CanvasEvents, CanvasOptions, CanvasRenderFn } from './plugins/canvas';
export { castSenderPlugin, CastSenderPlugin } from './plugins/cast-sender';
export type { CastSenderEvents, CastSenderOptions, ChromeCastMediaCtors } from './plugins/cast-sender';
export { embedPlugin, EmbedPlugin } from './plugins/embed';
export type { EmbedCommand, EmbedEventMessage, EmbedOptions } from './plugins/embed';
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
// Core types
export type {
	ActionOptions,
	ActionSource,
	AriaLiveLevel,
	AudioTrack,
	AuthConfig,
	AuthHeaderValue,
	BaseEventMap,
	BasePlayerConfig,
	BasePlaylistItem,
	BeforeEvent,
	CanPlayResult,
	CastConfig,
	CastTarget,
	Chapter,
	CueEventPayload,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	DeviceCapabilities,
	DrmConfig,
	IPlayer,
	IPlayerBackend,
	IUrlResolver,
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
	UrlResolverContext,
	WithCurrentItem,
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
