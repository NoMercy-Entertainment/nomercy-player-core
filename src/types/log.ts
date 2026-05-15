/**
 * Logger verbosity level. Controls how much output the player and its plugins
 * produce. Set via `BasePlayerConfig.logLevel`. Ordered from least to most
 * verbose: `silent` → `error` → `warn` → `info` → `debug` → `trace`.
 */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * A log sink function that receives every log entry the player produces.
 * Supply via a custom `ILogger` implementation or directly to a logging
 * bridge (Sentry breadcrumbs, Datadog, etc.).
 */
export type LogSink = (level: LogLevel, prefix: string, args: unknown[]) => void;
