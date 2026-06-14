// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export type { DefaultTranslatorOptions, ITranslator } from './ITranslator';
export { createNetworkTranslationLoader } from './loaders/translation-loader';
export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './loaders/translation-loader';
export { getLazyTranslationLoader, LAZY_TRANSLATIONS_MARKER, translationsFromGlob } from './loaders/translations-glob';
export type { GlobModule } from './loaders/translations-glob';
export { DefaultTranslator } from './translator';
