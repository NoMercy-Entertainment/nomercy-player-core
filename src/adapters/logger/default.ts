// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type {
	ILogger,
	LoggerOptions,
	LogLevel,
	LogSink,
} from './ILogger';
import { LEVEL_RANK } from './ILogger';

/**
 * Lightweight scoped logger. The kit and every plugin share a single root
 * instance per player; verbosity is gated by the player's `logLevel` config.
 *
 * Multiple sinks compose — register via `addSink(fn)` to pipe logs to console,
 * Sentry, Datadog, or custom telemetry simultaneously.
 *
 * Level ranks from least to most verbose: `silent < error < warn < info < debug < trace`.
 * Each level emits when the configured threshold is at or above that rank.
 */
export class Logger implements ILogger {
	private _level: LogLevel;
	private prefix: string;
	private readonly sinks: LogSink[] = [];

	constructor(opts?: LoggerOptions) {
		this._level = opts?.level ?? 'info';
		this.prefix = opts?.prefix ? `[${opts.prefix}]` : '[nmplayer]';
	}

	/**
	 * Read or write the verbosity threshold.
	 *
	 * `level()` — returns the active `LogLevel`.
	 * `level(value)` — switches the threshold at runtime without restarting the player.
	 */
	level(): LogLevel;
	level(value: LogLevel): void;
	level(value?: LogLevel): LogLevel | void {
		if (value === undefined) {
			return this._level;
		}
		this._level = value;
	}

	/**
	 * Pipe future log lines to an additional sink. The sink receives
	 * `(level, prefix, args)` so it can route to console / Sentry / Datadog with
	 * full context. Multiple sinks compose in registration order.
	 *
	 * Returns an unsubscribe function — call it to stop routing to this sink.
	 */
	addSink(fn: LogSink): () => void {
		this.sinks.push(fn);
		return () => {
			const idx = this.sinks.indexOf(fn);
			if (idx >= 0)
				this.sinks.splice(idx, 1);
		};
	}

	/** Emit a trace-level message (most verbose). */
	trace(...args: unknown[]): void {
		this.dispatch('trace', args);
	}

	/** Emit a debug-level message. */
	debug(...args: unknown[]): void {
		this.dispatch('debug', args);
	}

	/** Emit an info-level message. */
	info(...args: unknown[]): void {
		this.dispatch('info', args);
	}

	/** Emit a warning. */
	warn(...args: unknown[]): void {
		this.dispatch('warn', args);
	}

	/** Emit an error. */
	error(...args: unknown[]): void {
		this.dispatch('error', args);
	}

	/**
	 * Derive a scoped sub-logger that prepends an additional prefix segment.
	 *
	 * ```ts
	 * const log = playerLogger.child('lyrics');
	 * log.debug('cue loaded');  // → "[nmplayer][lyrics] cue loaded"
	 * ```
	 *
	 * Children share the parent's registered sinks so consumer-installed pipes
	 * capture every plugin's output uniformly.
	 */
	child(suffix: string): Logger {
		const child = Logger._withPrefix(`${this.prefix}[${suffix}]`, this._level);
		for (const sink of this.sinks) child.sinks.push(sink);
		return child;
	}

	/** Internal factory — creates a Logger with a pre-formatted prefix string. */
	private static _withPrefix(rawPrefix: string, level: LogLevel): Logger {
		const instance = new Logger({ level });
		instance.prefix = rawPrefix;
		return instance;
	}

	private dispatch(lvl: LogLevel, args: unknown[]): void {
		if (LEVEL_RANK[lvl] > LEVEL_RANK[this._level])
			return;

		// When no sinks are registered, write directly to the console.
		if (this.sinks.length === 0 && typeof console !== 'undefined') {
			const consoleFor: Record<LogLevel, (...a: unknown[]) => void> = {
				trace: console.trace,
				debug: console.debug ?? console.log,
				info: console.info ?? console.log,
				warn: console.warn,
				error: console.error,
				silent: () => {},
			};
			const fn = consoleFor[lvl];
			if (fn)
				fn.call(console, this.prefix, ...args);
		}

		for (const sink of this.sinks) {
			try {
				sink(lvl, this.prefix, args);
			}
			catch {
				// Sink misbehavior must never kill the dispatch chain.
			}
		}
	}
}
