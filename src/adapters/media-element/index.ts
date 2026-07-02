// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export { bridgeBackendPlayState } from './backend-lifecycle-bridge';

export type {
	BackendLifecycleBridgeOptions,
	BackendLifecycleSource,
} from './backend-lifecycle-bridge';

export {
	BACKEND_LOADER_STATE,
	BACKEND_STATE,
} from './backend-state';

export type {
	BackendLoaderState,
	BackendState,
} from './backend-state';

export {
	attachDomBridgesTo,
	attachHlsOrFallback,
	captureStreamFromElement,
	createAuthorizationXhrSetup,
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
	MinimalBackendEventPayload,
} from './MediaElementBackend';
