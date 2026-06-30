// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

export type { IPreloadStrategy, PreloadAsset, PreloadContext } from './default';
export type { ITransitionBackend, ITransitionStrategy, TransitionContext } from './default';
export {
	CrossfadeTransitionStrategy,
	DefaultPreloadStrategy,
	GaplessTransitionStrategy,
} from './default';
