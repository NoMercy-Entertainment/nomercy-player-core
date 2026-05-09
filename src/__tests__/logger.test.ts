/**
 * Logger tests — multi-sink scoped logger that satisfies the ILogger contract.
 *
 * Test groups:
 *  - Construction (default level, prefix, legacy `debug` boolean)
 *  - Level gating (silent/error/warn/info/debug/trace)
 *  - addSink() / unsubscribe + multi-sink composition
 *  - child() — derived sub-logger with prefix appended
 *  - Default console fallback when no sinks registered
 *  - level() runtime switching
 *  - Sink misbehavior — throwing sinks don't kill dispatch
 */

import type { ILogger } from '../logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '../logger';

describe('Logger', () => {
	let consoleSpies: {
		error: ReturnType<typeof vi.spyOn>;
		warn: ReturnType<typeof vi.spyOn>;
		info: ReturnType<typeof vi.spyOn>;
		debug: ReturnType<typeof vi.spyOn>;
		log: ReturnType<typeof vi.spyOn>;
		trace: ReturnType<typeof vi.spyOn>;
	};

	beforeEach(() => {
		consoleSpies = {
			error: vi.spyOn(console, 'error').mockImplementation(() => {}),
			warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
			info: vi.spyOn(console, 'info').mockImplementation(() => {}),
			debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
			log: vi.spyOn(console, 'log').mockImplementation(() => {}),
			trace: vi.spyOn(console, 'trace').mockImplementation(() => {}),
		};
	});

	afterEach(() => {
		Object.values(consoleSpies).forEach(s => s.mockRestore());
	});

	// ─────────────────────────────────────────────────────────────────────
	// Construction
	// ─────────────────────────────────────────────────────────────────────

	describe('construction', () => {
		it('defaults to level "info" with prefix [nmplayer]', () => {
			const logger = new Logger();
			logger.info('hello');
			expect(consoleSpies.info).toHaveBeenCalledWith('[nmplayer]', 'hello');
		});

		it('honors explicit level option', () => {
			const logger = new Logger({ level: 'debug' });
			logger.debug('hello');
			expect(consoleSpies.debug).toHaveBeenCalled();
		});

		it('legacy `debug: true` maps to level "debug"', () => {
			const logger = new Logger({ debug: true });
			logger.debug('hello');
			expect(consoleSpies.debug).toHaveBeenCalled();
		});

		it('explicit level overrides legacy debug flag', () => {
			const logger = new Logger({ level: 'silent', debug: true });
			logger.error('hello');
			expect(consoleSpies.error).not.toHaveBeenCalled();
		});

		it('honors explicit prefix option', () => {
			const logger = new Logger({ prefix: 'custom' });
			logger.info('hello');
			expect(consoleSpies.info).toHaveBeenCalledWith('[custom]', 'hello');
		});

		it('Logger satisfies the ILogger interface', () => {
			const logger: ILogger = new Logger();
			expect(typeof logger.trace).toBe('function');
			expect(typeof logger.debug).toBe('function');
			expect(typeof logger.info).toBe('function');
			expect(typeof logger.warn).toBe('function');
			expect(typeof logger.error).toBe('function');
			expect(typeof logger.level).toBe('function');
			expect(typeof logger.addSink).toBe('function');
			expect(typeof logger.child).toBe('function');
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// Level gating
	// ─────────────────────────────────────────────────────────────────────

	describe('level gating', () => {
		it('silent suppresses every level', () => {
			const logger = new Logger({ level: 'silent' });
			logger.error('e');
			logger.warn('w');
			logger.info('i');
			logger.debug('d');
			logger.trace('t');
			expect(consoleSpies.error).not.toHaveBeenCalled();
			expect(consoleSpies.warn).not.toHaveBeenCalled();
			expect(consoleSpies.info).not.toHaveBeenCalled();
			expect(consoleSpies.debug).not.toHaveBeenCalled();
			expect(consoleSpies.trace).not.toHaveBeenCalled();
		});

		it('error allows only error', () => {
			const logger = new Logger({ level: 'error' });
			logger.error('e');
			logger.warn('w');
			logger.info('i');
			logger.debug('d');
			expect(consoleSpies.error).toHaveBeenCalled();
			expect(consoleSpies.warn).not.toHaveBeenCalled();
			expect(consoleSpies.info).not.toHaveBeenCalled();
			expect(consoleSpies.debug).not.toHaveBeenCalled();
		});

		it('warn allows error + warn', () => {
			const logger = new Logger({ level: 'warn' });
			logger.error('e');
			logger.warn('w');
			logger.info('i');
			expect(consoleSpies.error).toHaveBeenCalled();
			expect(consoleSpies.warn).toHaveBeenCalled();
			expect(consoleSpies.info).not.toHaveBeenCalled();
		});

		it('info allows error + warn + info', () => {
			const logger = new Logger({ level: 'info' });
			logger.error('e');
			logger.warn('w');
			logger.info('i');
			logger.debug('d');
			expect(consoleSpies.info).toHaveBeenCalled();
			expect(consoleSpies.debug).not.toHaveBeenCalled();
		});

		it('debug allows error + warn + info + debug', () => {
			const logger = new Logger({ level: 'debug' });
			logger.debug('d');
			logger.trace('t');
			expect(consoleSpies.debug).toHaveBeenCalled();
			expect(consoleSpies.trace).not.toHaveBeenCalled();
		});

		it('trace allows everything', () => {
			const logger = new Logger({ level: 'trace' });
			logger.trace('t');
			expect(consoleSpies.trace).toHaveBeenCalled();
		});

		it('level() switches level at runtime', () => {
			const logger = new Logger({ level: 'silent' });
			logger.error('first');
			expect(consoleSpies.error).not.toHaveBeenCalled();
			logger.level('error');
			logger.error('second');
			expect(consoleSpies.error).toHaveBeenCalled();
		});

		it('level("debug") enables debug output', () => {
			const logger = new Logger({ level: 'silent' });
			logger.level('debug');
			logger.debug('hello');
			expect(consoleSpies.debug).toHaveBeenCalled();
		});

		it('level("info") suppresses debug output', () => {
			const logger = new Logger({ level: 'debug' });
			logger.level('info');
			logger.debug('hello');
			expect(consoleSpies.debug).not.toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// addSink()
	// ─────────────────────────────────────────────────────────────────────

	describe('addSink()', () => {
		it('routes log lines to the sink', () => {
			const logger = new Logger();
			const sink = vi.fn();
			logger.addSink(sink);
			logger.info('hello', 'world');
			expect(sink).toHaveBeenCalledWith('info', '[nmplayer]', ['hello', 'world']);
		});

		it('returns an unsubscribe function', () => {
			const logger = new Logger();
			const sink = vi.fn();
			const unsubscribe = logger.addSink(sink);
			expect(typeof unsubscribe).toBe('function');
			unsubscribe();
			logger.info('hello');
			expect(sink).not.toHaveBeenCalled();
		});

		it('multiple sinks all receive each log line', () => {
			const logger = new Logger();
			const a = vi.fn();
			const b = vi.fn();
			logger.addSink(a);
			logger.addSink(b);
			logger.info('hello');
			expect(a).toHaveBeenCalledTimes(1);
			expect(b).toHaveBeenCalledTimes(1);
		});

		it('console fallback is suppressed when at least one sink is registered', () => {
			const logger = new Logger();
			const sink = vi.fn();
			logger.addSink(sink);
			logger.info('hello');
			expect(consoleSpies.info).not.toHaveBeenCalled();
			expect(sink).toHaveBeenCalled();
		});

		it('sinks receive even level-gated calls — wait, they do NOT — gated calls return before sink dispatch', () => {
			const logger = new Logger({ level: 'silent' });
			const sink = vi.fn();
			logger.addSink(sink);
			logger.error('hello');
			expect(sink).not.toHaveBeenCalled();
		});

		it('throwing sink does not kill the dispatch chain', () => {
			const logger = new Logger();
			const a = vi.fn(() => {
				throw new Error('boom');
			});
			const b = vi.fn();
			logger.addSink(a);
			logger.addSink(b);
			expect(() => logger.info('hello')).not.toThrow();
			expect(b).toHaveBeenCalled();
		});
	});

	// ─────────────────────────────────────────────────────────────────────
	// child()
	// ─────────────────────────────────────────────────────────────────────

	describe('child()', () => {
		it('returns a new Logger with the prefix appended', () => {
			const parent = new Logger({ prefix: 'parent' });
			const child = parent.child('child');
			child.info('hello');
			expect(consoleSpies.info).toHaveBeenCalledWith('[parent][child]', 'hello');
		});

		it('child inherits the parent level', () => {
			const parent = new Logger({ level: 'silent' });
			const child = parent.child('child');
			child.error('hello');
			expect(consoleSpies.error).not.toHaveBeenCalled();
		});

		it('child shares the parent sinks at creation time', () => {
			const parent = new Logger();
			const sink = vi.fn();
			parent.addSink(sink);
			const child = parent.child('child');
			child.info('hello');
			expect(sink).toHaveBeenCalled();
		});

		it('child satisfies ILogger', () => {
			const parent = new Logger();
			const child: ILogger = parent.child('child');
			expect(typeof child.error).toBe('function');
			expect(typeof child.addSink).toBe('function');
			expect(typeof child.child).toBe('function');
		});
	});
});
