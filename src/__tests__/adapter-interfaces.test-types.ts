// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------
/**
 * Type-level proof that the default adapters match their interfaces, return
 * types included. Checked by `tsc --noEmit`.
 */

import type { LifecycleRegistry } from '../adapters/lifecycle-registry/default';
import type { ILifecycleRegistry } from '../adapters/lifecycle-registry/ILifecycleRegistry';
import type { MediaList } from '../adapters/media-list/default';
import type { IMediaList } from '../adapters/media-list/IMediaList';
import type { BasePlaylistItem } from '../types';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
declare function assertType<_T extends true>(): void;

assertType<Equal<ReturnType<LifecycleRegistry['frame']>, ReturnType<ILifecycleRegistry['frame']>>>();
assertType<Equal<ReturnType<LifecycleRegistry['timeout']>, ReturnType<ILifecycleRegistry['timeout']>>>();
assertType<Equal<ReturnType<LifecycleRegistry['abortable']>, ReturnType<ILifecycleRegistry['abortable']>>>();
assertType<Equal<ReturnType<MediaList<BasePlaylistItem>['get']>, ReturnType<IMediaList<BasePlaylistItem>['get']>>>();
assertType<Equal<ReturnType<MediaList<BasePlaylistItem>['current']>, ReturnType<IMediaList<BasePlaylistItem>['current']>>>();
