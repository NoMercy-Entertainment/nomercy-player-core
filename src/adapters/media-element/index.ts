// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export {
	attachDomBridgesTo,
	attachHlsOrFallback,
	captureStreamFromElement,
	createSecondaryAudioElement,
	destroyHlsInstance,
	getMediaKeysFromElement,
	getSinkIdFromElement,
	isHls,
	primeSecondaryElement,
	resetMediaElement,
	resolveOrCreateMediaElement,
	setMediaKeysOnElement,
	setSinkIdOnElement,
	supportsNativeHls,
	waitForMediaElementMetadata,
} from './helpers';

export type {
	BackendId,
	DomBridgeHandler,
	HlsHandle,
	HlsLoaderConfig,
} from './helpers';

export { MediaElementBackend } from './MediaElementBackend';

export type {
	AuthHeaderProvider,
	BaseLoaderState,
	MinimalBackendEventPayload,
} from './MediaElementBackend';
