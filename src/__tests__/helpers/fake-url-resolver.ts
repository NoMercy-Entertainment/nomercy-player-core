// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { IUrlResolver, ResolvedUrl, UrlResolverContext } from '../../adapters/url-resolver/IUrlResolver';

export interface FakeUrlResolver extends IUrlResolver {
	resolveCalls: string[];
}

/**
 * Recording URL resolver for DI tests. Records every URL passed to `resolve`
 * and returns a fixed `ResolvedUrl` with `href === 'RESOLVED'`.
 */
export function makeFakeUrlResolver(): FakeUrlResolver {
	const resolveCalls: string[] = [];

	const resolved: ResolvedUrl = {
		raw: 'RESOLVED',
		href: 'RESOLVED',
		scheme: 'https',
		origin: 'https://fake',
		pathname: '/resolved',
		ext: 'mp4',
		search: '',
		searchParams: new URLSearchParams(),
		hash: '',
		relative: false,
		toString(): string { return 'RESOLVED'; },
	};

	const resolver = Object.assign(
		function fakeResolver(url: string, _ctx: UrlResolverContext): ResolvedUrl {
			resolveCalls.push(url);
			return resolved;
		},
		{ resolveCalls },
	) as FakeUrlResolver;

	return resolver;
}
