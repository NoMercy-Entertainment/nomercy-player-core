// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Plugin base public API — the surface `plugin.test.ts` leaves unpinned,
 * exercised through the kit's own `describePlugin` harness (which also
 * auto-asserts use()/dispose() and zero listener leak per test).
 *
 * Test groups:
 *  - enable() / disable() — the plugin-scoped `plugin:<id>:enabled|disabled`
 *    channels (the generic channels are covered in plugin.test.ts)
 *  - state() — full snapshot shape through the harness
 *  - export() — deep-cloned snapshot independence
 *  - static derive() — id retention, prototype chain, opts baking + shallow merge
 *  - clone() — flows through export(), including subclass export() overrides
 *  - static priority — default value and derive() retention
 *    (enabledPlugins() priority ordering is covered in
 *    mixin-plugin-registration-depth.test.ts)
 *  - static moduleUrl — default + appendStyles href resolution
 */

import type { StubPlayer } from '../testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LifecycleRegistry } from '../adapters/lifecycle-registry/default';
import { Plugin } from '../core/plugin';
import { describePlugin } from '../testing';

interface ProbeOptions {
	tone?: string;
	level?: number;
	nested?: Record<string, number>;
}

class ApiProbePlugin extends Plugin<StubPlayer, ProbeOptions> {
	static override readonly id: string = 'api-probe';
	static override readonly version: string = '3.1.4';
	static override readonly description: string = 'Probes the Plugin base public API';

	publicAppendStyles(href: string, styleId: string): void {
		this.appendStyles(href, styleId);
	}
}

describePlugin(ApiProbePlugin, (ctx) => {
	describe('enable() / disable() — plugin-scoped channels', () => {
		it('disable() emits plugin:api-probe:disabled with id and reason', () => {
			const received: Array<{ id: string; reason?: string }> = [];
			const handler = (data: { id: string; reason?: string }): void => {
				received.push(data);
			};
			ctx.player.on('plugin:api-probe:disabled', handler);

			ctx.plugin.disable('maintenance');

			ctx.player.off('plugin:api-probe:disabled', handler);
			expect(received).toEqual([
				{
					id: 'api-probe',
					reason: 'maintenance',
				},
			]);
		});

		it('enable() emits plugin:api-probe:enabled with the plugin id', () => {
			const received: Array<{ id: string }> = [];
			const handler = (data: { id: string }): void => {
				received.push(data);
			};
			ctx.plugin.disable();
			ctx.player.on('plugin:api-probe:enabled', handler);

			ctx.plugin.enable();

			ctx.player.off('plugin:api-probe:enabled', handler);
			expect(received).toEqual([{ id: 'api-probe' }]);
		});

		it('enable() emits the generic and the plugin-scoped channel together', () => {
			const channels: string[] = [];
			const genericHandler = (): void => {
				channels.push('plugin:enabled');
			};
			const scopedHandler = (): void => {
				channels.push('plugin:api-probe:enabled');
			};
			ctx.plugin.disable();
			ctx.player.on('plugin:enabled', genericHandler);
			ctx.player.on('plugin:api-probe:enabled', scopedHandler);

			ctx.plugin.enable();

			ctx.player.off('plugin:enabled', genericHandler);
			ctx.player.off('plugin:api-probe:enabled', scopedHandler);
			expect(channels).toEqual([
				'plugin:enabled',
				'plugin:api-probe:enabled',
			]);
		});

		it('enable() while already enabled emits nothing on the plugin-scoped channel', () => {
			const received: unknown[] = [];
			const handler = (data: unknown): void => {
				received.push(data);
			};
			ctx.player.on('plugin:api-probe:enabled', handler);

			ctx.plugin.enable();

			ctx.player.off('plugin:api-probe:enabled', handler);
			expect(received).toEqual([]);
		});

		it('disable() while already disabled emits nothing on the plugin-scoped channel', () => {
			ctx.plugin.disable();
			const received: unknown[] = [];
			const handler = (data: unknown): void => {
				received.push(data);
			};
			ctx.player.on('plugin:api-probe:disabled', handler);

			ctx.plugin.disable();

			ctx.player.off('plugin:api-probe:disabled', handler);
			expect(received).toEqual([]);
		});
	});

	describe('state() snapshot', () => {
		it('returns the exact snapshot shape', () => {
			expect(ctx.plugin.state()).toEqual({
				id: 'api-probe',
				version: '3.1.4',
				enabled: true,
				opts: {
					tone: 'warm',
					level: 3,
				},
				runtime: {},
			});
		});

		it('tracks the enabled flag through a disable/enable cycle', () => {
			ctx.plugin.disable();
			expect(ctx.plugin.state().enabled).toBe(false);
			ctx.plugin.enable();
			expect(ctx.plugin.state().enabled).toBe(true);
		});
	});

	describe('export()', () => {
		it('returns a detached deep clone — mutating it does not touch live opts', () => {
			const exported = ctx.plugin.export();
			expect(exported).toEqual({
				tone: 'warm',
				level: 3,
			});
			expect(exported).not.toBe(ctx.plugin.opts);

			exported.tone = 'mutated';
			expect(ctx.plugin.options().tone).toBe('warm');
		});
	});

	describe('static derive()', () => {
		it('keeps the same static id when newId is omitted', () => {
			const Derived = ApiProbePlugin.derive({ level: 9 });
			expect((Derived as unknown as { id: string }).id).toBe('api-probe');
		});

		it('derived instances remain instanceof the source class', () => {
			const Derived = ApiProbePlugin.derive({ level: 9 });
			const instance = new Derived();
			expect(instance).toBeInstanceOf(ApiProbePlugin);
			expect(instance).toBeInstanceOf(Plugin);
		});

		it('pre-baked opts flow through when no consumer opts are supplied', () => {
			const Derived = ApiProbePlugin.derive({
				level: 9,
				tone: 'baked',
			});
			const instance = new Derived();
			const lifecycle = new LifecycleRegistry();
			instance.initialize(ctx.player, undefined as unknown as ProbeOptions, lifecycle);

			expect(instance.opts).toEqual({
				level: 9,
				tone: 'baked',
			});
			lifecycle.dispose();
		});

		it('consumer opts win over baked defaults on a shallow merge', () => {
			const Derived = ApiProbePlugin.derive({
				level: 9,
				tone: 'baked',
				nested: { alpha: 1 },
			});
			const instance = new Derived();
			const lifecycle = new LifecycleRegistry();
			instance.initialize(ctx.player, {
				tone: 'consumer',
				nested: { beta: 2 },
			}, lifecycle);

			expect(instance.opts).toEqual({
				level: 9,
				tone: 'consumer',
				nested: { beta: 2 },
			});
			lifecycle.dispose();
		});

		it('derive(opts, newId) renames the derived class and leaves the source untouched', () => {
			const Renamed = ApiProbePlugin.derive({ level: 1 }, 'api-probe-renamed');
			expect((Renamed as unknown as { id: string }).id).toBe('api-probe-renamed');
			expect(ApiProbePlugin.id).toBe('api-probe');
		});
	});

	describe('clone()', () => {
		it('bakes the current exported state into the derived class', () => {
			ctx.plugin.options({
				tone: 'live-tuned',
				level: 8,
			});
			const Clone = ctx.plugin.clone();
			const instance = new (Clone as unknown as new () => ApiProbePlugin)();
			const lifecycle = new LifecycleRegistry();
			instance.initialize(ctx.player, undefined as unknown as ProbeOptions, lifecycle);

			expect(instance.opts).toEqual({
				tone: 'live-tuned',
				level: 8,
			});
			lifecycle.dispose();
		});

		it('keeps the source static id on the cloned class', () => {
			const Clone = ctx.plugin.clone();
			expect((Clone as unknown as { id: string }).id).toBe('api-probe');
		});

		it('flows through export() — a subclass export() override enriches the clone', () => {
			class SnapshottingPlugin extends Plugin<StubPlayer, ProbeOptions> {
				static override readonly id: string = 'snapshotting';
				static override readonly description: string = 'export() override probe';

				override export(): ProbeOptions {
					return {
						...(this.opts ?? {}),
						tone: 'from-export',
					};
				}
			}

			const source = new SnapshottingPlugin();
			const sourceLifecycle = new LifecycleRegistry();
			source.initialize(ctx.player, { level: 5 }, sourceLifecycle);

			const Clone = source.clone();
			const cloned = new (Clone as unknown as new () => SnapshottingPlugin)();
			const cloneLifecycle = new LifecycleRegistry();
			cloned.initialize(ctx.player, undefined as unknown as ProbeOptions, cloneLifecycle);

			expect(cloned.opts).toEqual({
				level: 5,
				tone: 'from-export',
			});
			sourceLifecycle.dispose();
			cloneLifecycle.dispose();
		});
	});

	describe('static priority', () => {
		it('defaults to 0 on the base class and on subclasses that do not override', () => {
			expect(Plugin.priority).toBe(0);
			expect(ApiProbePlugin.priority).toBe(0);
		});

		it('subclass override is visible on the class', () => {
			class PrioritizedPlugin extends Plugin<StubPlayer, ProbeOptions> {
				static override readonly id: string = 'prioritized';
				static override readonly priority: number = 25;
			}
			expect(PrioritizedPlugin.priority).toBe(25);
		});

		it('derive() keeps the source priority', () => {
			class PrioritizedPlugin extends Plugin<StubPlayer, ProbeOptions> {
				static override readonly id: string = 'prioritized-derive';
				static override readonly priority: number = 42;
			}
			const Derived = PrioritizedPlugin.derive({ level: 1 });
			expect((Derived as unknown as { priority: number }).priority).toBe(42);
		});
	});

	describe('static moduleUrl + appendStyles()', () => {
		interface HappyDomSettings {
			disableCSSFileLoading?: boolean;
			handleDisabledFileLoadingAsSuccess?: boolean;
		}

		interface HappyDomWindow {
			happyDOM?: { settings?: HappyDomSettings };
		}

		let previousSettings: HappyDomSettings | undefined;

		beforeEach(() => {
			// appendStyles inserts a <link rel="stylesheet">; stop happy-dom from
			// actually fetching the URL — these tests assert href resolution only.
			const settings = (window as unknown as HappyDomWindow).happyDOM?.settings;
			if (settings) {
				previousSettings = {
					disableCSSFileLoading: settings.disableCSSFileLoading,
					handleDisabledFileLoadingAsSuccess: settings.handleDisabledFileLoadingAsSuccess,
				};
				settings.disableCSSFileLoading = true;
				settings.handleDisabledFileLoadingAsSuccess = true;
			}
		});

		afterEach(() => {
			const settings = (window as unknown as HappyDomWindow).happyDOM?.settings;
			if (settings && previousSettings) {
				settings.disableCSSFileLoading = previousSettings.disableCSSFileLoading;
				settings.handleDisabledFileLoadingAsSuccess = previousSettings.handleDisabledFileLoadingAsSuccess;
			}
		});

		it('moduleUrl is undefined by default', () => {
			expect(Plugin.moduleUrl).toBeUndefined();
			expect(ApiProbePlugin.moduleUrl).toBeUndefined();
		});

		it('appendStyles resolves a relative href against document.baseURI when moduleUrl is unset', () => {
			const styleId = 'api-probe-fallback-styles';
			ctx.plugin.publicAppendStyles('./probe-fallback.css', styleId);

			const link = document.getElementById(styleId) as HTMLLinkElement | null;
			expect(link?.tagName).toBe('LINK');
			expect(link?.rel).toBe('stylesheet');
			expect(link?.href).toBe(new URL('./probe-fallback.css', document.baseURI).href);
			link?.remove();
		});

		it('appendStyles resolves a relative href against the static moduleUrl when set', () => {
			class StyledPlugin extends ApiProbePlugin {
				static override readonly id: string = 'styled-probe';
				static override readonly moduleUrl: string = 'https://cdn.example.com/plugins/styled/plugin.js';
			}
			const styleId = 'styled-probe-styles';
			const styled = new StyledPlugin();
			styled.publicAppendStyles('./theme.css', styleId);

			const link = document.getElementById(styleId) as HTMLLinkElement | null;
			expect(link?.href).toBe('https://cdn.example.com/plugins/styled/theme.css');
			link?.remove();
		});

		it('appendStyles dedupes by style id — the second call is a no-op', () => {
			const styleId = 'api-probe-dedupe-styles';
			ctx.plugin.publicAppendStyles('./first.css', styleId);
			ctx.plugin.publicAppendStyles('./second.css', styleId);

			const links = document.querySelectorAll(`#${styleId}`);
			expect(links).toHaveLength(1);
			expect((links[0] as HTMLLinkElement).href).toBe(new URL('./first.css', document.baseURI).href);
			links[0]?.remove();
		});
	});
}, {
	opts: {
		tone: 'warm',
		level: 3,
	},
});
