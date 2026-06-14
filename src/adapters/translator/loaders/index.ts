// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export type { GlobModule } from './ITranslationLoader';
export type { NetworkTranslationLoader, NetworkTranslationLoaderOptions } from './ITranslationLoader';
export { createNetworkTranslationLoader } from './translation-loader';
export { translationsFromGlob } from './translations-glob';
