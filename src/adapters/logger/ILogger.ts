// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export const LOG_LEVEL = {
	SILENT: 'silent',
	ERROR: 'error',
	WARN: 'warn',
	INFO: 'info',
	DEBUG: 'debug',
	TRACE: 'trace',
} as const;

/**
 * Logger verbosity level. Controls how much output the player and its plugins
 * produce. Set via `BasePlayerConfig.logLevel`. Ordered from least to most
 * verbose: `silent` → `error` → `warn` → `info` → `debug` → `trace`.
 */
export type LogLevel = typeof LOG_LEVEL[keyof typeof LOG_LEVEL];

/**
 * Log level ranks for quick comparison. Higher is more verbose. `silent` is
 * special-cased as -1 so it ranks below all other levels.
 */
export const LEVEL_RANK: Record<LogLevel, number> = {
	[LOG_LEVEL.SILENT]: -1,
	[LOG_LEVEL.ERROR]: 0,
	[LOG_LEVEL.WARN]: 1,
	[LOG_LEVEL.INFO]: 2,
	[LOG_LEVEL.DEBUG]: 3,
	[LOG_LEVEL.TRACE]: 4,
};

/**
 * A log sink function that receives every log entry the player produces.
 * Supply via a custom `ILogger` implementation or directly to a logging
 * bridge (Sentry breadcrumbs, Datadog, etc.).
 */
export type LogSink = (level: LogLevel, prefix: string, args: unknown[]) => void;

export interface LoggerOptions {
	/** Verbosity threshold. Default `'info'`. */
	level?: LogLevel;
	prefix?: string;
}

/**
 * Pluggable logger contract. The default kit implementation (`Logger`) is a
 * multi-sink console wrapper. Consumers using Pino, Winston, Bunyan, or a
 * telemetry-tapped logger ship a wrapper class that implements this interface
 * and pass it via `setup({ logger })`.
 *
 * Plugin authors never construct one — they receive `this.logger` from the kit,
 * already scoped to their plugin id. `child(suffix)` lets the kit derive
 * narrower sub-loggers without the consumer's adapter needing to know how
 * scoping works on the underlying engine.
 */
export interface ILogger {
	/** Emit a trace-level message (most verbose). */
	trace(...args: unknown[]): void;
	/** Emit a debug-level message. */
	debug(...args: unknown[]): void;
	/** Emit an info-level message. */
	info(...args: unknown[]): void;
	/** Emit a warning. */
	warn(...args: unknown[]): void;
	/** Emit an error. */
	error(...args: unknown[]): void;

	/**
	 * Read or write the verbosity threshold.
	 *
	 * `level()` — returns the active `LogLevel`.
	 * `level(value)` — switches the threshold at runtime.
	 */
	level(): LogLevel;
	level(value: LogLevel): void;

	/**
	 * Pipe future log lines to an additional sink. Multiple sinks compose in
	 * registration order. Returns an unsubscribe function.
	 *
	 * Adapters wrapping engines without a multi-sink concept may keep only one
	 * active sink and no-op additional registrations — document the behaviour.
	 */
	addSink(fn: LogSink): () => void;

	/**
	 * Derive a scoped sub-logger that prepends an additional prefix segment.
	 * Used by the kit to scope plugin loggers to `[nmplayer][<plugin-id>]`.
	 */
	child(suffix: string): ILogger;
}
