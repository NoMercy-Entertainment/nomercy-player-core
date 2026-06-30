// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { ITranslator } from '../../adapters/translator/ITranslator';
import type { Translations } from '../../types';

export interface FakeTranslator extends ITranslator {
	translateCalls: string[];
}

/**
 * Recording translator for DI tests. Every call to `t(key)` records the key.
 * Returns `'FAKE:<key>'` so tests can assert the injected translator was used
 * rather than the DefaultTranslator.
 */
export function makeFakeTranslator(): FakeTranslator {
	const translateCalls: string[] = [];
	let currentLanguage = 'en';

	const translator: FakeTranslator = {
		translateCalls,

		t(key: string, _vars?: Record<string, string>): string {
			translateCalls.push(key);
			return `FAKE:${key}`;
		},

		language(lang?: string): string | Promise<void> {
			if (lang === undefined)
				return currentLanguage;
			currentLanguage = lang;
			return Promise.resolve();
		},

		addTranslations(_bundle: Translations): void {},

		translation(lang: string, key: string, value?: string): string | undefined | void {
			if (value === undefined)
				return undefined;
			void lang;
			void key;
			void value;
		},

		removeTranslations(_prefix: string, _lang?: string): void {},

		dispose(): void {},
	} as unknown as FakeTranslator;

	return translator;
}
