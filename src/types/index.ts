// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export type { Chapter } from './chapter';
export type {
	AuthConfig,
	AuthHeaderValue,
	BasePlayerConfig,
	CastConfig,
	CastTarget,
	DrmConfig,
} from './config';
export type { CueEventPayload, SubtitleCue, SubtitleCueChange } from './cues';
export type { DeviceCapabilities } from './device';
export type { BaseEventMap, BeforeEvent } from './events';
export type { PlayerExperimental } from './experimental';
export type { LogLevel, LogSink } from './log';
export type { PlaybackMetrics } from './metrics';
export type { AriaLiveLevel, TimeState } from './playback';
export type {
	ActionOptions,
	ActionSource,
	IPlayer,
	IPlayerBackend,
	LoadOptions,
	PlayerConstructorId,
	PlayerPhase,
	PreventedReason,
	WithCurrentItem,
} from './player';
export type { BasePlaylistItem } from './playlist';
export type {
	PluginAdvisory,
	PluginCtorWithId,
	PluginSpec,
	RequireSpec,
} from './plugin';
export {
	AudioTrackState,
	BufferState,
	CastState,
	NetworkState,
	PlayState,
	QualityState,
	RepeatState,
	SetupState,
	ShuffleState,
	VisibilityState,
	VolumeState,
} from './state';
export type {
	AudioTrack,
	CanPlayResult,
	CurrentAudioTrackSelection,
	CurrentQualitySelection,
	CurrentSubtitleSelection,
	QualityLevel,
	SubtitleStyle,
	SubtitleTrack,
} from './tracks';
export type { TranslationLoader, Translations } from './translations';
export type {
	IUrlResolver,
	ResolvedUrl,
	UrlCategory,
	UrlResolverContext,
} from './url';
