// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { AuthConfig } from '../../types';

function originOf(url: string): string | undefined {
	try {
		const base = typeof location === 'undefined' ? undefined : location.href;
		return new URL(url, base).origin;
	}
	catch {
		return undefined;
	}
}

function listedOrigins(cfg: AuthConfig): string[] {
	const raw = typeof cfg.mediaOrigins === 'function' ? cfg.mediaOrigins() : cfg.mediaOrigins;
	const entries = typeof raw === 'string' ? [raw] : [...(raw ?? [])];
	return entries.flatMap((entry) => {
		const origin = originOf(entry);
		return origin ? [origin] : [];
	});
}

// Origins are compared after parsing: a host that merely ends in a listed one
// does not match, and an unparseable url is a stranger. An async token yields
// nothing because media headers are resolved synchronously.
export function authorizeMediaOrigin(cfg: AuthConfig | undefined, url: string): string | undefined {
	if (!cfg || cfg.mediaOrigins === undefined || cfg.bearerToken === undefined)
		return undefined;

	const token = typeof cfg.bearerToken === 'function' ? cfg.bearerToken() : cfg.bearerToken;
	if (typeof token !== 'string' || token === '')
		return undefined;

	const target = originOf(url);
	if (!target || !listedOrigins(cfg).includes(target))
		return undefined;

	return `Bearer ${token}`;
}
