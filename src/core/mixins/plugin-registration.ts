import type { IPlayer, PluginCtorWithId, Translations } from '../../types';
import type { Plugin } from '../plugin';
import type { Internals } from '../state';
import { bcp47FallbackChain } from '../../adapters/language-matcher/bcp47';
import { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import { Logger } from '../../adapters/logger/default';
import { getLazyTranslationLoader } from '../../adapters/translator/loaders/translations-glob';

import { pluginError, stateError } from '../../errors';
import { KIT_VERSION } from '../kit-version';

/**
 * The plugin-registration mixin's slice of player state — composed into
 * `PlayerCoreState`. Declared here, beside `_registerPlugin` / `addPlugin`
 * which are the sole writers of the live registry and the pre-setup queue.
 */
export interface PluginRegistrationState {
	/**
	 * Live plugin registry. Each entry holds the plugin instance, its
	 * `LifecycleRegistry` (for disposal), and the constructor (for `getPlugin`
	 * type-safe lookup). Written by `pluginRegistrationMethods._registerPlugin`.
	 */
	_plugins: Array<{ instance: Plugin; lifecycle: LifecycleRegistry; ctor: PluginCtorWithId }>;

	/**
	 * Pre-setup plugin queue. `addPlugin` calls during `'idle'` or `'setup'` phase
	 * push entries here; the `pluginsRegistering` stage drains them, calling
	 * `initialize` then awaiting `use()` for each, bounded by `pluginInitTimeoutMs`.
	 *
	 * Post-setup `addPlugin` runs the same pipeline inline.
	 */
	_pluginQueue: Array<{ ctor: PluginCtorWithId; opts?: unknown }>;
}

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
	const configured = self.options.logger;
	const root = configured instanceof Logger
		? configured
		: new Logger({
				prefix: 'nmplayer',
				level: self.options.logLevel,
			});
	return root.child(scope) as Logger;
}

/**
 * Disable every plugin that depends on a failed plugin, cascading through the
 * dependency tree. Called from `_registerPlugin` when a plugin's `use()` throws —
 * keeps the dependent set in a sane state instead of leaving them wired to a
 * partly-disposed peer. Each `disable()` call is wrapped defensively so one
 * plugin's misbehaving teardown doesn't block the rest of the cascade.
 */
function _cascadeDisable(self: Internals, failedId: string, reason: string, findDependents: (id: string) => string[]): void {
	const dependents = findDependents(failedId);
	for (const depId of dependents) {
		const entry = self._plugins.find(p => p.ctor.id === depId);
		if (!entry)
			continue;
		if (!entry.instance.enabled())
			continue;
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
// Mixin: pluginRegistration — owns the plugin lifecycle. Handles enqueueing
// during setup, post-setup inline registration, dependency + version checks,
// the `static replaces` opt-in same-id swap, cascade-on-remove, plugin
// translation merging, and the `plugin:installed` / `plugin:failed` /
// `plugin:disposed` event surface (both bare and id-namespaced).
// ──────────────────────────────────────────────────────────────────────────

export const pluginRegistrationMethods = {
	/**
	 * Read the per-player set of `pluginId::lang` pairs whose lazy translation
	 * bundles have already been fetched. Returns `undefined` if no plugin has
	 * loaded a translation yet (the WeakMap entry is created lazily). Used by
	 * `i18nMethods.setLanguage` to avoid double-fetching.
	 */
	_pluginLangLoadedSet(this: Internals): Set<string> | undefined {
		return _pluginLangLoaded.get(this);
	},

	/**
	 * Record that a plugin's lazy translation bundle for a specific language has
	 * been loaded into the translator. Creates the per-player set on first call.
	 */
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
				if (Object.hasOwn(cur, 'translations')) {
					const withT = cur as { translations?: Translations };
					if (withT.translations)
						stack.unshift(withT.translations);
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

			try {
				instance.dispose();
			}
			catch { /* defensive */ }
			try {
				lifecycle.dispose();
			}
			catch { /* defensive */ }

			const failPayload = {
				id,
				error: failError,
			};

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

	/**
	 * Register a plugin with the player.
	 *
	 * Pre-setup or mid-setup (`idle` / `setup` phase): the plugin is queued and
	 * gets registered during the `pluginsRegistering` pipeline stage. Returns
	 * the player for chaining.
	 *
	 * Post-setup: registration runs inline (fire-and-forget). The plugin's
	 * `use()` is invoked immediately, bounded by `options.pluginInitTimeoutMs`
	 * (default 30s); listen for `plugin:installed` or `plugin:failed` to know
	 * when it settled.
	 *
	 * Throws on:
	 *  - `core:lifecycle/use-plugin-after-dispose` — `addPlugin` called after
	 *    `dispose()` has run or started.
	 *  - `core:plugin/duplicate-id` — another plugin with the same id is already
	 *    registered or queued. Use `static replaces = 'other-id'` to opt in to
	 *    same-id swap.
	 *  - `core:plugin/missing-dep` — `static requires` lists a plugin that isn't
	 *    registered (and isn't marked `optional`).
	 *  - `core:plugin/version-mismatch` — a required dependency's version is
	 *    below the `minVersion` declared in the requires spec.
	 *  - `core:plugin/incompatible-core-version` — `static minCoreVersion`
	 *    exceeds the running kit version.
	 *
	 * The `opts?: P['opts']` parameter is type-bound to the plugin's options
	 * generic (the second slot in `Plugin<P, O, E>`), so consumers get full
	 * autocomplete and type-checking on the inline literal — no `satisfies`
	 * needed at the call site.
	 */
	addPlugin<P extends Plugin<any, any, any>>(this: Internals, PluginClass: PluginCtorWithId & (new () => P), opts?: P['opts']): unknown {
		const id = PluginClass.id;

		if (this._phase === 'disposed' || this._phase === 'disposing') {
			throw stateError('core:lifecycle/use-plugin-after-dispose', `addPlugin("${id}") called after dispose().`, { id });
		}

		// `static replaces` opt-in: when a plugin declares it replaces another
		// id, dispose the existing peer (firing `plugin:disposed`) before this
		// one registers (which will fire `plugin:installed`). Non-matching id
		// is not an error — registration proceeds as a fresh install.
		if (PluginClass.replaces) {
			const existingIdx = this._plugins.findIndex(p => p.ctor.id === PluginClass.replaces);
			const queuedIdx = this._pluginQueue.findIndex(q => q.ctor.id === PluginClass.replaces);
			if (existingIdx >= 0) {
				this.removePluginById(PluginClass.replaces);
			}
			else if (queuedIdx >= 0) {
				this._pluginQueue.splice(queuedIdx, 1);
			}
		}

		if (this._plugins.some(p => p.ctor.id === id) || this._pluginQueue.some(q => q.ctor.id === id)) {
			throw pluginError('core:plugin/duplicate-id', `Plugin "${id}" is already registered.`, { context: { id } });
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
				throw pluginError('core:plugin/missing-dep', `Plugin "${id}" requires "${reqId}" but it is not registered.`, {
					context: {
						id,
						requires: reqId,
					},
				});
			}
			if (present && minVersion !== undefined) {
				// Resolve the actual ctor we'd be using (registered first, queued fallback).
				const reg = this._plugins.find(p => p.ctor.id === reqId);
				const queued = this._pluginQueue.find(q => q.ctor.id === reqId);
				const installedVersion = (reg?.ctor.version ?? queued?.ctor.version ?? '0.0.0');
				if (_compareSemver(installedVersion, minVersion) < 0) {
					throw pluginError(
						'core:plugin/version-mismatch',
						`Plugin "${id}" requires "${reqId}" >= ${minVersion} but ${installedVersion} is registered.`,
						{
							context: {
								id,
								requires: reqId,
								requiredVersion: minVersion,
								installedVersion,
							},
						},
					);
				}
			}
		}

		// Kit version compatibility — `static minCoreVersion` lets a plugin
		// declare it needs at least this kit version to run.
		if (PluginClass.minCoreVersion && _compareSemver(KIT_VERSION, PluginClass.minCoreVersion) < 0) {
			throw pluginError(
				'core:plugin/incompatible-core-version',
				`Plugin "${id}" requires kit version >= ${PluginClass.minCoreVersion} but ${KIT_VERSION} is running.`,
				{
					context: {
						id,
						requiredCoreVersion: PluginClass.minCoreVersion,
						kitVersion: KIT_VERSION,
					},
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

	/**
	 * Look up a registered plugin instance by class. Returns the instance typed
	 * as the class's `P` generic, or `undefined` when not registered. Prefer
	 * this over `getPluginById` whenever the class is in scope — you get
	 * full type information instead of `object`.
	 */
	getPlugin<P extends object>(this: Internals, PluginClass: PluginCtorWithId & (new () => P)): P | undefined {
		const entry = this._plugins.find(registration => registration.ctor.id === PluginClass.id);
		return entry?.instance as P | undefined;
	},

	/**
	 * Look up a registered plugin instance by string id. Returns the instance
	 * cast to the caller-provided generic, or `undefined` when not registered.
	 * Use when the class isn't in scope (e.g. cross-plugin discovery by id).
	 */
	getPluginById<P extends object = object>(this: Internals, id: string): P | undefined {
		return this._plugins.find(reg => reg.ctor.id === id)?.instance as P | undefined;
	},

	/**
	 * Remove a plugin by class. Disposes its instance, drops its lifecycle
	 * resources, removes its translations, and emits `plugin:disposed`.
	 *
	 * Cascade behaviour: when other plugins depend on the one being removed,
	 * they're removed first (recursively). Pass `{ cascade: false }` to opt
	 * out and have the call throw `core:plugin/has-dependents` instead. The
	 * default is cascade because removing a dependency without its dependents
	 * leaves them in a broken state.
	 */
	removePlugin<P extends Plugin<any, any, any>>(this: Internals, PluginClass: PluginCtorWithId & (new () => P), opts?: { cascade?: boolean }): void {
		this.removePluginById(PluginClass.id, opts);
	},

	/**
	 * String-id version of `removePlugin` — see that method for cascade semantics.
	 * Also clears any pending queue entry for the same id, so a plugin queued
	 * pre-setup that gets removed before `pluginsRegistering` runs won't
	 * register later.
	 */
	removePluginById(this: Internals, id: string, opts?: { cascade?: boolean }): void {
		// Reverse-walk registered AND queued plugins to find anything that
		// requires `id`. Cascade is the default — pass `{ cascade: false }`
		// to opt out and surface a hard error instead.
		const dependents = _findDependents(this, id);
		if (dependents.length > 0) {
			if (opts?.cascade === false) {
				throw pluginError(
					'core:plugin/has-dependents',
					`Cannot remove plugin "${id}" — ${dependents.length} plugin(s) depend on it: ${dependents.join(', ')}. Remove cascade:false or remove the dependents explicitly first.`,
					{
						context: {
							id,
							dependents,
						},
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

	/**
	 * All registered plugin instances in registration order (both enabled and
	 * disabled). Returns a fresh array; mutating it does not affect the player's
	 * internal list. For only-enabled, ordered by priority, use `enabledPlugins`.
	 */
	plugins(this: Internals): ReadonlyArray<Plugin> {
		return this._plugins.map(p => p.instance);
	},

	/**
	 * Registered plugins that are currently enabled, ordered by `static priority`
	 * descending. Ties break by registration order (the natural insertion order).
	 * Use this when running plugins in priority sequence — e.g. for `before*`
	 * dispatch chains where higher-priority plugins should see the event first.
	 */
	enabledPlugins(this: Internals): ReadonlyArray<Plugin> {
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
