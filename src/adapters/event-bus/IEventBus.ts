/**
 * Typed event bus contract. Mirrors the `EventEmitter` surface used by both
 * player classes and the plugin base. Consumers that want to inject a custom
 * event bus (e.g. a reactive store event system) implement this interface.
 */
export interface IEventBus<E extends Record<string, any> = Record<string, any>> {
	on<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	on(event: string, fn: (data: unknown) => void): void;

	once<K extends keyof E>(event: K, fn: (data: E[K]) => void): void;
	once(event: string, fn: (data: unknown) => void): void;

	off<K extends keyof E>(event: K, fn?: (data: E[K]) => void): void;
	off(event: 'all'): void;
	off(event: string, fn?: (data: unknown) => void): void;

	emit<K extends keyof E>(event: K, data?: E[K]): void;
	emit(event: string, data?: unknown): void;

	hasListeners<K extends keyof E>(event: K): boolean;
	hasListeners(event: string): boolean;

	listenerCount(): number;
}
