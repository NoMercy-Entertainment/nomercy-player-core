import type { Internals } from '../state';

import { browserPolicyError } from '../../errors';

// ──────────────────────────────────────────────────────────────────────────
// Narrow backend interface — local to this mixin
// ──────────────────────────────────────────────────────────────────────────

interface _BackendWithMediaElement { mediaElement?: () => HTMLMediaElement & { setSinkId?: (id: string) => Promise<void>; sinkId?: string } }

// ──────────────────────────────────────────────────────────────────────────
// Mixin: audio output device routing.
// ──────────────────────────────────────────────────────────────────────────

export const audioOutputMethods = {
	/**
	 * Enumerate audio output devices. Resolves to `MediaDeviceInfo[]` via
	 * `navigator.mediaDevices.enumerateDevices()`. Browsers gate output-device
	 * enumeration behind a permission grant — call `selectAudioOutput()` first
	 * to trigger the grant.
	 */
	async audioOutputs(this: Internals): Promise<MediaDeviceInfo[]> {
		if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
			return [];
		}
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter(d => d.kind === 'audiooutput');
	},
	/**
	 * Open the browser's audio-output picker. Chrome ≥105 exposes
	 * `selectAudioOutput()`; other browsers throw a structured BrowserPolicyError.
	 * Returns the selected device or `null` when the user cancels.
	 */
	async selectAudioOutput(this: Internals): Promise<MediaDeviceInfo | null> {
		// selectAudioOutput is Chrome ≥105 only — not yet in TypeScript's bundled DOM lib.
		type MediaDevicesWithPicker = MediaDevices & { selectAudioOutput?: () => Promise<MediaDeviceInfo> };
		const md: MediaDevicesWithPicker | undefined = typeof navigator !== 'undefined' ? navigator.mediaDevices as MediaDevicesWithPicker : undefined;
		if (!md?.selectAudioOutput) {
			throw browserPolicyError('core:policy/audioOutputPickerUnsupported', 'Audio output picker not supported in this browser. Chrome ≥105 only.');
		}
		try {
			return await md.selectAudioOutput();
		}
		catch (err) {
			const name = err instanceof Error ? err.name : '';
			if (name === 'AbortError' || name === 'NotAllowedError')
				return null;
			throw err;
		}
	},

	/**
	 * Read or write the active audio output device.
	 *
	 * `currentAudioOutput()` — returns the current `sinkId` (device id string),
	 * or `null` when using the system default output.
	 *
	 * `currentAudioOutput(deviceId)` — route audio to the device with the given
	 * id. Calls `HTMLMediaElement.setSinkId(deviceId)` on the backend's media
	 * element when available. Throws `BrowserPolicyError` when `setSinkId` is
	 * not supported. Returns a `Promise<void>` that resolves once the switch
	 * completes.
	 */
	async currentAudioOutput(this: Internals, deviceId?: string): Promise<string | null | void> {
		if (deviceId === undefined) {
			return this._currentAudioOutputId;
		}
		const backend = this._peekBackendTyped<_BackendWithMediaElement>();
		const el = backend?.mediaElement?.();
		if (!el || typeof el.setSinkId !== 'function') {
			throw browserPolicyError('core:policy/setSinkIdUnsupported', 'setSinkId() is not supported in this browser or no media element is bound.');
		}
		await el.setSinkId(deviceId);
		this._currentAudioOutputId = deviceId;
	},
} as const;
