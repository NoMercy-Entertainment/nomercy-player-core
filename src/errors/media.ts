// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { PlayerError } from './player';

/**
 * Thrown when the browser cannot decode the media — unsupported codec, corrupt
 * container, or a format the current rendition cannot handle. Codes follow the
 * pattern `core:media/<reason>` (e.g. `core:media/codec-unsupported`). The
 * retry policy defaults to `attempts: 0`; ABR logic handles rendition fallback.
 */
export class MediaFormatError extends PlayerError {
	override readonly name = 'MediaFormatError';
}

/**
 * Thrown when a streaming pipeline fails — HLS fragment fetch, DASH segment
 * parse, or MSE `appendBuffer` rejection. Scope is always
 * `{ kind: 'stream', id: 'hls' | 'dash' | 'native' }`. Codes follow
 * `core:stream/<reason>`.
 */
export class StreamError extends PlayerError {
	override readonly name = 'StreamError';
}

/**
 * Thrown when a required resource cannot be loaded — a Web Worker, a WASM
 * module, a stylesheet, or a dynamically-imported chunk. Codes follow
 * `core:resource/<reason>`. Use `resourceError()` to construct.
 */
export class ResourceError extends PlayerError {
	override readonly name = 'ResourceError';
}

/**
 * Construct a `MediaFormatError` scoped to the core with `severity: 'error'`.
 *
 * Use when the browser rejects a codec, container, or rendition. Pass diagnostic
 * data in `context` — at minimum the URL and (where available) the MIME type and
 * codec string.
 *
 * Code convention: `core:media/<reason>` — e.g. `core:media/codec-unsupported`.
 */
export function mediaFormatError(
	code: string,
	message: string,
	context?: Record<string, unknown>,
): MediaFormatError {
	return new MediaFormatError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}

/**
 * Construct a `ResourceError` scoped to the core with `severity: 'error'`.
 *
 * Use when a required resource (Worker, WASM binary, stylesheet, dynamic import)
 * cannot be loaded. The log message is auto-prefixed with `code`.
 *
 * Code convention: `core:resource/<reason>` — e.g. `core:resource/worker-init-failed`.
 */
export function resourceError(
	code: string,
	message: string,
	context?: Record<string, unknown>,
): ResourceError {
	return new ResourceError({
		code,
		severity: 'error',
		scope: { kind: 'core' },
		message: `${code}: ${message}`,
		context,
	});
}
