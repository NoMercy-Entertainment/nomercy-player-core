// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Translation concern marker file.
 *
 * Plugin translation behaviour is implemented on the Plugin class (base.ts):
 *  - `static readonly translations` — static bundles merged on `use()`
 *  - `protected t(key, vars?)` — plugin-scoped key lookup
 *  - `protected loadTranslations?(lang)` — async override hook for on-demand loading
 *
 * No standalone runtime state lives here — the player's translator owns the
 * merged table. This file exists as an explicit concern boundary marker for W3
 * so W6/W12 know where to insert a `ITranslationLoader` adapter when the
 * plugin-scoped async-load surface grows into a named port.
 */

export type {};
