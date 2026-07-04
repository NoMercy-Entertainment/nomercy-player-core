// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { Translations } from './types';

import { translationsFromGlob } from './adapters/translator/loaders/translations-glob';

/**
 * The kit's own `core.*` translation bundles, one file per language under
 * `src/i18n/`. Lazy by the same `translationsFromGlob` mechanism plugins use —
 * `_initTranslator` (`core/mixins/lifecycle.ts`) only fetches the active
 * language's bundle (plus its BCP-47 parents), never all of them.
 *
 * English is the deliberate exception: `_initTranslator` seeds it eagerly from
 * `./i18n/en` directly, so `t('core.*')` resolves before any async load
 * completes. This map still includes `en.ts` — harmless, since English is
 * already marked loaded by the time this loader could fire for it.
 */
export const kitTranslations: Translations = translationsFromGlob('./i18n/*.ts');
