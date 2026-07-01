// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export const BACKEND_STATE = {
	IDLE: 'idle',
	LOADING: 'loading',
	READY: 'ready',
	PLAYING: 'playing',
	PAUSED: 'paused',
	ERROR: 'error',
} as const;

/** Backend lifecycle state. Returned by a backend's `state()`. */
export type BackendState = typeof BACKEND_STATE[keyof typeof BACKEND_STATE];

export const BACKEND_LOADER_STATE = {
	RUNNING: 'running',
	PAUSED: 'paused',
} as const;

/** Backend loader state — backpressure when an upstream gate needs the buffer to drain. */
export type BackendLoaderState = typeof BACKEND_LOADER_STATE[keyof typeof BACKEND_LOADER_STATE];
