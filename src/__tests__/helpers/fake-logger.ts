// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ILogger, LogLevel, LogSink } from '../../adapters/logger/ILogger';

export interface FakeLogger extends ILogger {
	calls: string[];
}

/**
 * Recording logger for DI tests. Every call to trace/debug/info/warn/error
 * pushes a `"<level>:<args>"` entry into `calls`. The `level()` getter returns
 * `'debug'` so the player's `_wireLogger` `all`-listener actually invokes the
 * logger (the listener gates on `LEVEL_RANK[logger.level()] >= LEVEL_RANK.debug`).
 */
export function makeFakeLogger(): FakeLogger {
	const calls: string[] = [];
	let currentLevel: LogLevel = 'debug';

	const record = (level: string, args: unknown[]): void => {
		calls.push(`${level}:${args.map(String).join(' ')}`);
	};

	const logger: FakeLogger = {
		calls,

		trace(...args: unknown[]): void { record('trace', args); },
		debug(...args: unknown[]): void { record('debug', args); },
		info(...args: unknown[]): void { record('info', args); },
		warn(...args: unknown[]): void { record('warn', args); },
		error(...args: unknown[]): void { record('error', args); },

		level(value?: LogLevel): LogLevel | void {
			if (value === undefined)
				return currentLevel;
			currentLevel = value;
		},

		addSink(_fn: LogSink): () => void {
			return (): void => {};
		},

		child(_suffix: string): ILogger {
			return logger;
		},
	} as unknown as FakeLogger;

	return logger;
}
