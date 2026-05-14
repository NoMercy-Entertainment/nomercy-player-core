import type { IPlayer, PluginCtorWithId, Translations } from '../../types';
import type { Plugin } from '../../plugin';
import { LifecycleRegistry } from '../../lifecycle';
import { Logger } from '../../logger';
import { bcp47FallbackChain } from '../../translator';
import { getLazyTranslationLoader } from '../../translations-glob';

import { stateError } from '../errors';
import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Helpers shared by the setup pipeline (lifecycle) and post-setup addPlugin
// (plugin-registration).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-player set of plugin-id|lang pairs whose runtime translation bundle has
 * already been loaded. Prevents `loadTranslations` from being invoked twice
 * for the same plugin+language pair when consumers call `setLanguage` repeatedly.
 */
const _pluginLangLoaded = new WeakMap<Internals, Set<string>>();

export function pluginLangLoadedSet(self: Internals): Set<string> | undefined {
	return _pluginLangLoaded.get(self);
}

export function markPluginLangLoaded(self: Internals, pluginId: string, lang: string): void {
	let set = _pluginLangLoaded.get(self);
	if (!set) {
		set = new Set();
		_pluginLangLoaded.set(self, set);
	}
	set.add(`${pluginId}::${lang}`);
}

/** Build a scoped child logger from the player's configured logger or a fallback. */
export function makePlayerLogger(self: Internals, scope: string): Logger {
	const configured = (self.options as unknown as { logger?: Logger } | undefined)?.logger;
	const root = configured ?? new Logger({ prefix: 'nmplayer', level: (self.options as unknown as { logLevel?: string } | undefined)?.logLevel as Parameters<Logger['level']>[0] | undefined });
	return root.child(scope) as Logger;
}

type _LoadTranslationsFn = (lang: string) => Promise<Record<string, string> | undefined>;

function _getLoadTranslations(instance: unknown): _LoadTranslationsFn | undefined {
	if (typeof instance !== 'object' || instance === null)
		return undefined;
	if (!('loadTranslations' in instance))
		return undefined;
	const fn: unknown = (instance as { loadTranslations: unknown }).loadTranslations;
	return typeof fn === 'function' ? (fn as _LoadTranslationsFn) : undefined;
}

function _cascadeDisable(self: Internals, failedId: string, reason: string, findDependents: (id: string) => string[]): void {
	const dependents = findDependents(failedId);
	for (const depId of dependents) {
		const entry = self._plugins.find(p => p.ctor.id === depId);
		if (!entry)
			continue;
		if (!entry.instance.enabled())
			continue; // already disabled
		try {
			entry.instance.disable(reason);
		}
		catch { /* defensive */ }
	}
}

function _findDependents(self: Internals, id: string): string[] {
	const directDependents: string[] = [];

	const requiresId = (ctor: PluginCtorWithId, target: string): boolean => {
		const requires = ctor.requires ?? [];
		for (const spec of requires) {
			const requiredCtor: PluginCtorWithId = typeof spec === 'function' ? spec : spec.plugin;
			if (requiredCtor.id === target)
				return true;
		}
		return false;
	};

	for (const { ctor } of self._plugins) {
		if (ctor.id === id)
			continue;
		if (requiresId(ctor, id))
			directDependents.push(ctor.id);
	}
	for (const { ctor } of self._pluginQueue) {
		if (ctor.id === id)
			continue;
		if (requiresId(ctor, id))
			directDependents.push(ctor.id);
	}

	const collected: string[] = [];
	for (const dep of directDependents) {
		const indirect = _findDependents(self, dep);
		for (const indirectDep of indirect) {
			if (!collected.includes(indirectDep))
				collected.push(indirectDep);
		}
		if (!collected.includes(dep))
			collected.push(dep);
	}
	return collected;
}

/**
 * Register a single plugin: instantiate, initialize, merge static translations,
 * await `use()` (bounded by timeout), push onto the registered list, emit
 * `plugin:installed`. Failures emit `plugin:failed`, mark plugin disabled, and
 * do NOT block the rest of the pipeline.
 */
export async function registerPlugin(
	self: Internals,
	ctor: PluginCtorWithId,
	opts: unknown,
	timeoutMs: number,
): Promise<void> {
	const id = ctor.id;
	if (self._plugins.some(p => p.ctor.id === id)) {
		// Already registered (post-setup `addPlugin` checks this earlier; queue
		// drain double-checks defensively).
		return;
	}

	type _InstantiableCtor = new () => Plugin;
	const lifecycle = new LifecycleRegistry();
	let instance: Plugin;
	try {
		instance = new (ctor as unknown as _InstantiableCtor)();
		instance.initialize(self as unknown as IPlayer, opts, lifecycle);
	}
	catch (err) {
		// Hard failure during construction / initialize — surface and bail.
		self.emit('plugin:failed', {
			id,
			error: err instanceof Error ? err : new Error(String(err)),
		});
		throw err;
	}

	// Walk the prototype chain so EVERY ancestor's `static translations`
	// gets registered, not just the subclass's. Without this, declaring
	// `static translations` on a subclass shadows the parent's static and
	// the parent's bundle is silently dropped. Subclasses ship ONLY their
	// own keys; the kit composes the chain.
	//
	// Each ancestor's bundle can be either eager (pre-resolved keys for
	// every language) OR lazy (the `LAZY_TRANSLATIONS_MARKER` is stamped
	// by `translationsFromGlob` when modules are function loaders). For
	// lazy bundles we ONLY fetch the active language + its BCP-47 parent
	// chain — Chinese never enters memory when the user wants Dutch.
	{
		const stack: Translations[] = [];
		let cur: unknown = ctor;
		while (cur && cur !== Function.prototype) {
			if (Object.prototype.hasOwnProperty.call(cur, 'translations')) {
				const withT = cur as { translations?: Translations };
				if (withT.translations) stack.unshift(withT.translations);
			}
			cur = Object.getPrototypeOf(cur);
		}
		const currentLang = String(self.language());
		const langChain = bcp47FallbackChain(currentLang);
		// Apply base → subclass so subclass keys override on collision.
		for (const translationBundle of stack) {
			const lazy = getLazyTranslationLoader(translationBundle);
			if (lazy) {
				// Lazy: load only the active language + parents. Static-translation
				// bundles ship keys with the `plugin.<id>.` prefix already
				// applied (matching the eager path) — we DO NOT re-namespace
				// here, otherwise keys end up as `plugin.<id>.plugin.<id>.foo`.
				for (const tag of langChain) {
					const bundle = await lazy(tag);
					if (!bundle)
						continue;
					self.addTranslations({ [tag]: bundle });
					markPluginLangLoaded(self, id, tag);
				}
			}
			else {
				// Eager: register the whole bundle as before.
				self.addTranslations(translationBundle);
			}
		}
	}

	// Await `use()` with timeout. Per spec, a plugin failure does NOT block the
	// player from reaching `ready` — the plugin is marked failed and skipped.
	let useFailed = false;
	let useError: unknown;
	try {
		const result = instance.use();
		if (result instanceof Promise) {
			let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
			const timeout = new Promise<never>((_, reject) => {
				timeoutHandle = setTimeout(
					() => reject(stateError('core:plugin/init-timeout', `Plugin "${id}" use() exceeded ${timeoutMs}ms`, {
						id,
						timeoutMs,
					})),
					timeoutMs,
				);
			});
			try {
				await Promise.race([result, timeout]);
			}
			finally {
				if (timeoutHandle)
					clearTimeout(timeoutHandle);
			}
		}
	}
	catch (err) {
		useFailed = true;
		useError = err;
	}

	if (useFailed) {
		// Soft-fail: dispose the partially-initialised instance so any DOM
		// mounted before the throw is removed, then emit plugin:failed and
		// cascade. Do NOT push onto _plugins — a plugin whose use() threw is
		// not usable and removePlugin would double-dispose it.
		const failError = useError instanceof Error ? useError : new Error(String(useError));

		// Always log through the plugin's own logger (wired during initialize())
		// so failures are never silent regardless of `plugin:failed` listener timing.
		// Fallback: construct a scoped logger from player options when the plugin's
		// logger field is somehow unset (defensive for subclasses that skip super.initialize).
		const pluginLogger = (instance as unknown as { logger?: { error: (...args: unknown[]) => void } }).logger
			?? makePlayerLogger(self, id);
		pluginLogger.error('plugin use() failed — plugin will not be registered', failError);

		try { instance.dispose(); }
		catch { /* defensive */ }
		try { lifecycle.dispose(); }
		catch { /* defensive */ }

		const failPayload = { id, error: failError };

		self.emit('plugin:failed', failPayload);
		self.emit(`plugin:${id}:failed`, failPayload);
		// Spec §C cascade: every plugin transitively depending on this one
		// gets disabled with reason `dep-failed:<id>`.
		_cascadeDisable(self, id, `dep-failed:${id}`, depId => _findDependents(self, depId));
		return;
	}

	self._plugins.push({
		instance,
		lifecycle,
		ctor,
	});
	const installedPayload = {
		id,
		version: ctor.version,
	};
	self.emit('plugin:installed', installedPayload);
	self.emit(`plugin:${id}:installed`, installedPayload);
}
