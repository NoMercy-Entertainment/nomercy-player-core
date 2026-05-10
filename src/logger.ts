import type { LogLevel, LogSink } from './types';

export interface LoggerOptions {
	/** @deprecated — use `level: 'debug'`. Kept for v1 compatibility. */
	debug?: boolean;
	/** Verbosity threshold. Default `'info'`. */
	level?: LogLevel;
	prefix?: string;
}

/**
 * Pluggable logger contract. Default kit impl (`Logger`) is a multi-sink
 * console wrapper. Consumers using Pino, Winston, Bunyan, or telemetry-tapped
 * loggers ship a wrapper class implementing this interface and pass it via
 * `setup({ logger })`.
 *
 * Plugin authors never construct one — they receive `this.logger` from the
 * kit, scoped to their plugin id. `child(suffix)` lets the kit derive scoped
 * sub-loggers without the consumer's adapter caring how scoping works on the
 * underlying engine.
 */
export interface ILogger {
	trace(...args: unknown[]): void;
	debug(...args: unknown[]): void;
	info(...args: unknown[]): void;
	warn(...args: unknown[]): void;
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
	 * Pipe future log lines to a sink. Multiple sinks compose. Returns an
	 * unsubscribe fn. Adapters wrapping engines without a multi-sink concept
	 * may keep one sink active and noop additional registrations — document it.
	 */
	addSink(fn: LogSink): () => void;

	/**
	 * Derive a scoped sub-logger that prepends an additional prefix. Used by
	 * the kit to scope plugin loggers to `[nmplayer][<plugin-id>]`.
	 */
	child(suffix: string): ILogger;
}

const LEVEL_RANK: Record<LogLevel, number> = {
	silent: -1,
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
	trace: 4,
};

/**
 * Lightweight scoped logger. The kit and plugins share a single instance per
 * player; verbosity is gated by the player's `logLevel` config.
 *
 * Multiple sinks compose: register sinks via `addSink(fn)` to pipe logs to
 * console + Sentry + Datadog + custom telemetry simultaneously.
 *
 * Level ranks `silent < error < warn < info < debug < trace`; each level emits
 * at its level and any lower rank.
 */
export class Logger implements ILogger {
	private _level: LogLevel;
	private prefix: string;
	private readonly sinks: LogSink[] = [];

	constructor(opts?: LoggerOptions) {
		// Resolve level: explicit `level` wins, then legacy `debug` boolean,
		// then default to 'info'.
		if (opts?.level) {
			this._level = opts.level;
		}
		else if (opts?.debug === true) {
			this._level = 'debug';
		}
		else {
			this._level = 'info';
		}
		this.prefix = opts?.prefix ? `[${opts.prefix}]` : '[nmplayer]';
	}

	/**
	 * Read or write the verbosity threshold.
	 *
	 * `level()` — returns the active `LogLevel`.
	 * `level(value)` — switches the threshold at runtime.
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
	 * Pipe future log lines to a sink. The sink receives `(level, prefix, args)`
	 * so it can route to console / Sentry / Datadog with full context. Multiple
	 * sinks compose in registration order.
	 */
	addSink(fn: LogSink): () => void {
		this.sinks.push(fn);
		return () => {
			const idx = this.sinks.indexOf(fn);
			if (idx >= 0)
				this.sinks.splice(idx, 1);
		};
	}

	trace(...args: unknown[]): void {
		this.dispatch('trace', args);
	}

	debug(...args: unknown[]): void {
		this.dispatch('debug', args);
	}

	info(...args: unknown[]): void {
		this.dispatch('info', args);
	}

	warn(...args: unknown[]): void {
		this.dispatch('warn', args);
	}

	error(...args: unknown[]): void {
		this.dispatch('error', args);
	}

	/**
	 * Create a sub-logger that prepends an additional prefix. Useful for plugins
	 * to get scoped logging without each plugin reaching into console directly.
	 *
	 * Example:
	 *   const log = playerLogger.child('lyrics');
	 *   log.debug('cue loaded');  // → "[nmplayer][lyrics] cue loaded"
	 */
	child(suffix: string): Logger {
		const child = Logger._withPrefix(`${this.prefix}[${suffix}]`, this._level);
		// Children share their parent's sinks so consumer-installed pipes
		// (Sentry, Datadog) capture every plugin's logs uniformly.
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
		// Default console sink — preserved if no other sinks are registered.
		if (this.sinks.length === 0 && typeof console !== 'undefined') {
			const fn = lvl === 'trace'
				? console.trace
				: lvl === 'debug'
					? (console.debug ?? console.log)
					: lvl === 'info'
						? (console.info ?? console.log)
						: lvl === 'warn'
							? console.warn
							: console.error;
			if (fn)
				fn.call(console, this.prefix, ...args);
		}
		// Always run user-registered sinks (gives consumer full control).
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
