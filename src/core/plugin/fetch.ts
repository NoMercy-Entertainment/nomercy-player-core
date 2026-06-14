// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { LifecycleRegistry } from '../../adapters/lifecycle-registry/default';
import type { RetryConfig } from '../../errors';
import type { AuthConfig, BasePlayerConfig, IPlayer } from '../../types';
import type { AuthFetchOptions } from '../auth-fetch';
import { authFetch } from '../auth-fetch';

/**
 * Options accepted by `Plugin.fetch<T>(url, options)`.
 * The discriminated `responseType` controls how the response body is decoded.
 * `pluginId` and `scope` are injected internally — plugin authors never set them.
 */
interface FetchHttp {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';
	body?: BodyInit;
	headers?: Record<string, string>;
	timeoutMs?: number;
	retry?: RetryConfig;
	scope?: 'plugin' | 'player' | 'silent';
}

export type FetchOptions<T>
	= | (FetchHttp & { responseType?: 'text'; parser?: (raw: string) => T })
		| (FetchHttp & { responseType: 'json' })
		| (FetchHttp & { responseType: 'arrayBuffer' });

type InternalFetchOptions<T> = AuthFetchOptions<T> & {
	pluginId: string;
	scope: 'plugin' | 'player' | 'silent';
};

/** Structural view of the player state `pluginFetch` reads. */
type PluginFetchPlayer = IPlayer & {
	options?: BasePlayerConfig;
	auth?: () => AuthConfig | undefined;
	emit: (event: string, data?: unknown) => void;
};

/** State `pluginFetch` needs from the calling plugin. */
interface PluginFetchHost {
	id: string;
	lifecycle: LifecycleRegistry;
	player: PluginFetchPlayer;
}

/**
 * Auth-aware fetch shared by every plugin. Gathers the live/config auth, scopes
 * telemetry events, and binds the request to the plugin's lifecycle so it aborts
 * on `dispose()`. Backs `Plugin.fetch()`.
 */
export function pluginFetch<T = string>(host: PluginFetchHost, url: string, options?: FetchOptions<T>): Promise<T> {
	const ctrl = host.lifecycle.abortable();
	const config = host.player.options ?? {};
	const liveAuth = host.player.auth?.();
	const auth = liveAuth ?? config.auth;
	const scope = options?.scope ?? 'plugin';
	return authFetch<T>({
		...options,
		url,
		auth,
		signal: ctrl.signal,
		pluginId: host.id,
		scope,
		emit: (event: string, data: unknown) => host.player.emit(event, data),
	} as InternalFetchOptions<T>);
}
