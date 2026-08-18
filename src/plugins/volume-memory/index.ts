// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import type { BaseEventMap, IPlayer } from '../../types';
import { Plugin } from '../../core/plugin';
import { VolumeState } from '../../core/state';

/** Options for {@link VolumeMemoryPlugin}. */
export interface VolumeMemoryOptions {
	/**
	 * Storage key volume/mute state is persisted under. Uses the plugin's
	 * `this.storage` facade (auto-namespaced `nmplayer-<playerId>-`), never
	 * raw `localStorage` — see `Plugin.storage`.
	 */
	persistKey?: string;
}

interface PersistedVolumeState {
	level?: number;
	muted?: boolean;
}

const DEFAULT_PERSIST_KEY = 'volume';

/**
 * Opt-in plugin that remembers the player's volume and mute state across
 * sessions via the kit's `IStorage` adapter. Shared by video and music — the
 * `volume()` / `mute()` / `unmute()` surface it restores from and saves to
 * is identical on both, so one plugin covers both consumers.
 *
 * Restores the persisted level on `use()` (before `ready` fires) and saves
 * on every `volume` / `mute` event. Consumers that want a different storage
 * backend or key scheme configure it the same way `MixerPlugin.persistKey`
 * works — via `setup({ storage })` for the backend, `persistKey` for the key.
 *
 * **Usage**
 *
 * ```ts
 * player.addPlugin(volumeMemoryPlugin);
 * ```
 */
export class VolumeMemoryPlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, VolumeMemoryOptions, BaseEventMap> {
	static override readonly id: string = 'volume-memory';
	static override readonly version: string = '1.0.0';
	static override readonly description: string = 'Persists volume + mute state across sessions via the storage adapter';

	private _unsubscribeVolume: (() => void) | null = null;
	private _unsubscribeMute: (() => void) | null = null;

	/** Restores persisted volume/mute state and subscribes to future changes. */
	override use(): void {
		const key = this.opts?.persistKey ?? DEFAULT_PERSIST_KEY;
		const restored = this._loadPersisted(key);

		if (restored?.level !== undefined)
			void this.player.volume(restored.level);
		if (restored?.muted)
			void this.player.mute();

		const onVolume = (): void => this._save(key);
		const onMute = (): void => this._save(key);

		this.player.on('volume', onVolume);
		this.player.on('mute', onMute);
		this._unsubscribeVolume = () => this.player.off('volume', onVolume);
		this._unsubscribeMute = () => this.player.off('mute', onMute);
	}

	/** Unsubscribes from `volume` / `mute` events. */
	override dispose(): void {
		this._unsubscribeVolume?.();
		this._unsubscribeMute?.();
		this._unsubscribeVolume = null;
		this._unsubscribeMute = null;
	}

	private _save(key: string): void {
		const state: PersistedVolumeState = {
			level: this.player.volume(),
			muted: this.player.volumeState() === VolumeState.MUTED,
		};
		void this.storage?.setJSON?.(key, state);
	}

	private _loadPersisted(key: string): PersistedVolumeState | undefined {
		try {
			const raw = this.storage?.getJSON?.<PersistedVolumeState>(key);
			// Storage may be sync OR async. Only synchronous values are honoured
			// at `use()` time — async backends restore lazily on the next setter.
			if (raw !== null && typeof raw === 'object' && !('then' in (raw as object)))
				return raw as PersistedVolumeState;
		}
		catch {
			/* swallow */
		}
		return undefined;
	}
}

/** Plugin alias for {@link VolumeMemoryPlugin}. Pass to `addPlugin(volumeMemoryPlugin)`. */
export const volumeMemoryPlugin = VolumeMemoryPlugin;
