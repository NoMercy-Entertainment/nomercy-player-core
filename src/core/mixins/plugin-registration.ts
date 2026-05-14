import type { IPlayer, PluginCtorWithId, Translations } from '../../types';
import type { Plugin } from '../../plugin';
import { LifecycleRegistry } from '../../lifecycle';
import { Logger } from '../../logger';
import { bcp47FallbackChain } from '../../translator';
import { getLazyTranslationLoader } from '../../translations-glob';

import { pluginErrorFactory, stateError } from '../errors';
import type { Internals } from '../state';
import { KIT_VERSION } from '../kit-version';


// ──────────────────────────────────────────────────────────────────────────
// Per-player lang-loaded tracking
// WeakMap lifetime is tied to the player instance — no manual cleanup needed.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-player set of plugin-id|lang pairs whose runtime translation bundle has
 * already been loaded. Prevents `loadTranslations` from being invoked twice
 * for the same plugin+language pair when consumers call `setLanguage` repeatedly.
 */
const _pluginLangLoaded = new WeakMap<Internals, Set<string>>();

/** Build a scoped child logger from the player's configured logger or a fallback. */
function makePlayerLogger(self: Internals, scope: string): Logger {
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


// ──────────────────────────────────────────────────────────────────────────
// Private helpers — only used by pluginRegistrationMethods
// ──────────────────────────────────────────────────────────────────────────

/**
 * Three-way semver compare: returns -1, 0, or +1 for `a` vs `b`. Tolerates
 * missing patch / minor (`'2'` → `'2.0.0'`). Pre-release tags (`-rc.1`) are
 * compared as strings after the numeric trio.
 */
function _compareSemver(a: string, b: string): -1 | 0 | 1 {
	const parse = (v: string): { nums: number[]; pre: string } => {
		const [main, pre = ''] = v.split('-', 2);
		const nums = (main ?? '').split('.').map(s => Number.parseInt(s, 10) || 0);
		while (nums.length < 3) nums.push(0);
		return {
			nums,
			pre,
		};
	};
	const aP = parse(a);
	const bP = parse(b);
	for (let i = 0; i < 3; i++) {
		const an = aP.nums[i] ?? 0;
		const bn = bP.nums[i] ?? 0;
		if (an < bn)
			return -1;
		if (an > bn)
			return 1;
	}
	if (aP.pre === bP.pre)
		return 0;
	if (!aP.pre && bP.pre)
		return 1; // a is final, b is pre-release
	if (aP.pre && !bP.pre)
		return -1;
	return aP.pre < bP.pre ? -1 : 1;
}

/**
 * Find every plugin (registered OR queued) whose `static requires` includes
 * the given id. Returns plugin ids in dependency-tree order.
 */
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


// ──────────────────────────────────────────────────────────────────────────
// Mixin: plugin registration
// ──────────────────────────────────────────────────────────────────────────

export const pluginRegistrationMethods = {
	_pluginLangLoadedSet(this: Internals): Set<string> | undefined {
		return _pluginLangLoaded.get(this);
	},

	_markPluginLangLoaded(this: Internals, pluginId: string, lang: string): void {
		let set = _pluginLangLoaded.get(this);
		if (!set) {
			set = new Set();
			_pluginLangLoaded.set(this, set);
		}
		set.add(`${pluginId}::${lang}`);
	},

	/**
	 * Register a single plugin: instantiate, initialize, merge static translations,
	 * await `use()` (bounded by timeout), push onto the registered list, emit
	 * `plugin:installed`. Failures emit `plugin:failed`, mark plugin disabled, and
	 * do NOT block the rest of the pipeline.
	 */
	async _registerPlugin(this: Internals, ctor: PluginCtorWithId, opts: unknown, timeoutMs: number): Promise<void> {
		const id = ctor.id;
		if (this._plugins.some(p => p.ctor.id === id)) {
			return;
		}

		type _InstantiableCtor = new () => Plugin;
		const lifecycle = new LifecycleRegistry();
		let instance: Plugin;
		try {
			instance = new (ctor as unknown as _InstantiableCtor)();
			instance.initialize(this as unknown as IPlayer, opts, lifecycle);
		}
		catch (err) {
			this.emit('plugin:failed', {
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
			const currentLang = String(this.language());
			const langChain = bcp47FallbackChain(currentLang);
			for (const translationBundle of stack) {
				const lazy = getLazyTranslationLoader(translationBundle);
				if (lazy) {
					for (const tag of langChain) {
						const bundle = await lazy(tag);
						if (!bundle)
							continue;
						this.addTranslations({ [tag]: bundle });
						this._markPluginLangLoaded(id, tag);
					}
				}
				else {
					this.addTranslations(translationBundle);
				}
			}
		}

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
			const failError = useError instanceof Error ? useError : new Error(String(useError));

			const pluginLogger = (instance as unknown as { logger?: { error: (...args: unknown[]) => void } }).logger
				?? makePlayerLogger(this, id);
			pluginLogger.error('plugin use() failed — plugin will not be registered', failError);

			try { instance.dispose(); }
			catch { /* defensive */ }
			try { lifecycle.dispose(); }
			catch { /* defensive */ }

			const failPayload = { id, error: failError };

			this.emit('plugin:failed', failPayload);
			this.emit(`plugin:${id}:failed`, failPayload);
			_cascadeDisable(this, id, `dep-failed:${id}`, depId => _findDependents(this, depId));
			return;
		}

		this._plugins.push({
			instance,
			lifecycle,
			ctor,
		});
		const installedPayload = {
			id,
			version: ctor.version,
		};
		this.emit('plugin:installed', installedPayload);
		this.emit(`plugin:${id}:installed`, installedPayload);
	},

	// `opts?: P['opts']` is the load-bearing line for autocomplete: the plugin's
	// options-generic `O` (the second `Plugin<P, O, E>` slot) flows back to the
	// `opts` parameter, so consumers get full type-checking + completion on the
	// inline literal — no `satisfies` needed at the call site.
	addPlugin<P extends Plugin>(this: Internals, PluginClass: PluginCtorWithId & (new () => P), opts?: P['opts']): unknown {
		const id = PluginClass.id;

		// Spec §23.6: post-dispose addPlugin throws.
		if (this._phase === 'disposed' || this._phase === 'disposing') {
			throw stateError('core:lifecycle/use-plugin-after-dispose', `addPlugin("${id}") called after dispose().`, { id });
		}

		// Spec §3.1 / §8.1: opt-in same-id replacement via `static replaces`.
		// When the existing-plugin id matches, dispose+remove it before
		// continuing — `plugin:disposed` fires for the old, then
		// `plugin:installed` for the new.
		if (PluginClass.replaces) {
			const existingIdx = this._plugins.findIndex(p => p.ctor.id === PluginClass.replaces);
			const queuedIdx = this._pluginQueue.findIndex(q => q.ctor.id === PluginClass.replaces);
			if (existingIdx >= 0) {
				this.removePluginById(PluginClass.replaces);
			}
			else if (queuedIdx >= 0) {
				this._pluginQueue.splice(queuedIdx, 1);
			}
			// If no match, registration proceeds as a fresh install (spec §3.1
			// "replaces is opt-in — non-matching id is not an error").
		}

		if (this._plugins.some(p => p.ctor.id === id) || this._pluginQueue.some(q => q.ctor.id === id)) {
			throw pluginErrorFactory('core:plugin/duplicate-id', `Plugin "${id}" is already registered.`, { id });
		}

		// Required-dependency presence + version check. Looks across registered
		// AND queued plugins so pre-setup ordering doesn't matter.
		const requires = PluginClass.requires ?? [];
		for (const spec of requires) {
			const requiredCtor: PluginCtorWithId = typeof spec === 'function' ? spec : spec.plugin;
			const optional = typeof spec === 'function' ? false : (spec.optional ?? false);
			const minVersion = typeof spec === 'function' ? undefined : spec.minVersion;
			const reqId = requiredCtor.id;
			const present = this._plugins.some(p => p.ctor.id === reqId)
				|| this._pluginQueue.some(q => q.ctor.id === reqId);
			if (!present && !optional) {
				throw pluginErrorFactory('core:plugin/missing-dep', `Plugin "${id}" requires "${reqId}" but it is not registered.`, {
					id,
					requires: reqId,
				});
			}
			if (present && minVersion !== undefined) {
				// Resolve the actual ctor we'd be using (registered first, queued fallback).
				const reg = this._plugins.find(p => p.ctor.id === reqId);
				const queued = this._pluginQueue.find(q => q.ctor.id === reqId);
				const installedVersion = (reg?.ctor.version ?? queued?.ctor.version ?? '0.0.0');
				if (_compareSemver(installedVersion, minVersion) < 0) {
					throw pluginErrorFactory(
						'core:plugin/version-mismatch',
						`Plugin "${id}" requires "${reqId}" >= ${minVersion} but ${installedVersion} is registered.`,
						{
							id,
							requires: reqId,
							requiredVersion: minVersion,
							installedVersion,
						},
					);
				}
			}
		}

		// Spec §23.6: minCoreVersion check. Kit declares its own version via
		// the static `_kitVersion` constant exported below.
		if (PluginClass.minCoreVersion && _compareSemver(KIT_VERSION, PluginClass.minCoreVersion) < 0) {
			throw pluginErrorFactory(
				'core:plugin/incompatible-core-version',
				`Plugin "${id}" requires kit version >= ${PluginClass.minCoreVersion} but ${KIT_VERSION} is running.`,
				{
					id,
					requiredCoreVersion: PluginClass.minCoreVersion,
					kitVersion: KIT_VERSION,
				},
			);
		}

		// Pre-setup / mid-setup: queue for the pluginsRegistering pipeline stage.
		if (this._phase === 'idle' || this._phase === 'setup') {
			this._pluginQueue.push({
				ctor: PluginClass,
				opts,
			});
			return this;
		}

		// Post-setup: run the same pipeline inline so `plugin:installed` fires
		// AFTER `use()` resolves (or `plugin:failed` if it doesn't).
		const timeoutMs = this.options.pluginInitTimeoutMs ?? 30_000;
		// Fire-and-forget — consumer can `await player.ready()`-style by
		// listening to `plugin:installed` / `plugin:failed`.
		void this._registerPlugin(PluginClass, opts, timeoutMs);
		return this;
	},

	getPlugin<P extends object>(this: Internals, PluginClass: PluginCtorWithId & (new () => P)): P | undefined {
		const entry = this._plugins.find(registration => registration.ctor.id === PluginClass.id);
		return entry?.instance as P | undefined;
	},

	getPluginById<P extends object = object>(this: Internals, id: string): P | undefined {
		return this._plugins.find(reg => reg.ctor.id === id)?.instance as P | undefined;
	},

	removePlugin<P extends Plugin>(this: Internals, PluginClass: PluginCtorWithId & (new () => P), opts?: { cascade?: boolean }): void {
		this.removePluginById(PluginClass.id, opts);
	},

	removePluginById(this: Internals, id: string, opts?: { cascade?: boolean }): void {
		// Spec §C: required-dependency awareness. Reverse-walk both registered
		// AND queued plugins to find anything that requires `id`. Cascade is the
		// default — pass `{ cascade: false }` to opt out and surface a hard error
		// instead. Removing a dep without its dependents leaves them in a broken
		// state so cascading is the correct default.
		const dependents = _findDependents(this, id);
		if (dependents.length > 0) {
			if (opts?.cascade === false) {
				throw pluginErrorFactory(
					'core:plugin/has-dependents',
					`Cannot remove plugin "${id}" — ${dependents.length} plugin(s) depend on it: ${dependents.join(', ')}. Remove cascade:false or remove the dependents explicitly first.`,
					{
						id,
						dependents,
					},
				);
			}
			for (const dep of dependents) {
				this.removePluginById(dep, { cascade: true });
			}
		}

		// Also clear pending queue entries so a queued-then-removed plugin
		// doesn't get registered later.
		const queueIdx = this._pluginQueue.findIndex(q => q.ctor.id === id);
		if (queueIdx >= 0) {
			this._pluginQueue.splice(queueIdx, 1);
		}

		const idx = this._plugins.findIndex(p => p.ctor.id === id);
		if (idx < 0)
			return;
		const { instance, lifecycle, ctor } = this._plugins[idx]!;
		instance.dispose();
		lifecycle.dispose();
		if (ctor.translations) {
			this.removeTranslations(`plugin.${id}.`);
		}
		this._plugins.splice(idx, 1);
		const payload = { id };
		this.emit('plugin:disposed', payload);
		this.emit(`plugin:${id}:disposed`, payload);
	},

	plugins(this: Internals): ReadonlyArray<Plugin> {
		return this._plugins.map(p => p.instance);
	},

	enabledPlugins(this: Internals): ReadonlyArray<Plugin> {
		// Spec §3.2: order by `static priority` descending, ties broken by
		// registration order (which is the array's natural insertion order).
		const enabled = this._plugins
			.map((entry, index) => ({
				entry,
				index,
			}))
			.filter(({ entry }) => entry.instance.enabled());
		enabled.sort((a, b) => {
			const ap = a.entry.ctor.priority ?? 0;
			const bp = b.entry.ctor.priority ?? 0;
			if (ap !== bp)
				return bp - ap;
			return a.index - b.index;
		});
		return enabled.map(({ entry }) => entry.instance);
	},
} as const;
