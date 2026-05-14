import type { BasePlaylistItem, LoadOptions } from '../../types';
import { authFetch } from '../../auth-fetch';
import { MediaFormatError, StateError } from '../../errors';

import type { Internals } from '../state';
import { assertReady, dispatchBefore } from '../util/guards';
import { transitionPhase } from '../util/phase';
import { resolveBackend } from '../util/backend';
import { resolveItemTrackUrls } from '../util/tracks';


// ──────────────────────────────────────────────────────────────────────────
// Mixin: loading — `load(item, opts)` / `loadQueue(url, parser?)`.
//
// Spec §L: `load(item)` fires `beforeLoad` (cancellable), then delegates to
// the active backend's `load(url)`. The library overrides `backend()` to
// return its concrete `IAudioBackend` / `IVideoBackend`; the mixin pulls
// the URL from the item, resolves auth.transformUrl, and emits the standard
// post-load events.
// ──────────────────────────────────────────────────────────────────────────

export const loadingMethods = {
	async load<T extends BasePlaylistItem & { url?: string }>(
		this: Internals,
		item: T,
		opts?: LoadOptions,
	): Promise<void> {
		assertReady(this);

		// Capture phase before any async work so the loading transition
		// reflects the actual state at call time — not the state after
		// awaited setup-pipeline steps have already moved to 'ready'.
		const priorPhase = this._phase;

		const beforeResult = await dispatchBefore<{ item: T; source?: string }>(
			this,
			'beforeLoad',
			{
				item,
				source: opts?.source,
			},
		);
		if (beforeResult.prevented) {
			this.emit('loadPrevented', {
				reason: beforeResult.reason ?? 'listener-prevented',
				cause: beforeResult.cause,
			});
			return;
		}

		// Resolve URL — `item.url` is the canonical field; `auth.transformUrl`
		// rewrites it (e.g. for custom-scheme streams or pre-signed URLs).
		const item2 = beforeResult.data.item;
		let url = (item2 as { url?: string }).url;
		if (!url) {
			throw new MediaFormatError({
				code: 'core:media/missing-url',
				severity: 'error',
				scope: { kind: 'core' },
				message: 'load(item) requires `item.url` to be present.',
				context: { id: item2.id },
			});
		}
		const transformer = this._authConfig?.transformUrl;
		if (transformer) {
			url = await transformer(url);
		}

		const resolvedItem = await resolveItemTrackUrls(this, item2);
		if (resolvedItem !== item2) {
			this._queueList.replaceItem(resolvedItem);
		}

		// Phase: ready/playing/paused/starting → loading while the backend
		// mounts. idle/setup are excluded: when load() is called before the
		// setup pipeline has finished (initial auto-load pattern), the player
		// has never shown content, so flashing loading→paused is noise and
		// causes a test-visible oscillation. The setup pipeline ends with
		// _transitionPhase('ready') which maps to 'paused' on the container,
		// giving a clean settled state once backend.load() completes.
		if (priorPhase === 'ready' || priorPhase === 'playing' || priorPhase === 'paused' || priorPhase === 'starting') {
			transitionPhase(this, 'loading');
		}

		// Race-guard: bump a monotonic load epoch and capture it. When the
		// consumer fires p.load(A) and p.load(B) in quick succession, the
		// older call's continuation otherwise lands AFTER the newer one and
		// drags cursor / phase / opts back to A — bridges that listen to
		// `current` then chase B again, producing a load-loop. Anything
		// observably side-effectful AFTER the awaited backend.load only
		// runs when our epoch is still the latest.
		const epoch = (this._loadEpoch ?? 0) + 1;
		this._loadEpoch = epoch;
		const isLatest = (): boolean => this._loadEpoch === epoch;

		try {
			const backend = resolveBackend(this);
			if (!backend || typeof backend.load !== 'function') {
				throw new StateError({
					code: 'core:player/backend-missing',
					severity: 'error',
					scope: { kind: 'core' },
					message: 'No backend wired — backend() returned null/undefined.',
				});
			}
			await backend.load(url);
			if (!isLatest()) return;

			// Move cursor to the loaded item so consumer-facing `current()` reflects it.
			// Use setCurrent directly — calling this.current() here would re-trigger load().
			// Guard: skip if the cursor is already at this item (e.g. current() mixin
			// moved it before calling load()) to prevent a duplicate `current` event.
			const alreadyCurrent = this._queueList.current()?.id === item2.id;
			if (!alreadyCurrent) {
				this._queueList.setCurrent(item2.id ?? item2);
			}

			// Honour LoadOptions.startAt by seeking once metadata is available.
			if (typeof opts?.startAt === 'number' && opts.startAt > 0) {
				const ret = this.currentTime(opts.startAt);
				if (ret instanceof Promise)
					await ret;
				if (!isLatest()) return;
			}

			// Honour LoadOptions.fadeIn by ramping volume from 0→current over the configured seconds.
			// Trivial fade — no easing curve. Plugins extend.
			if (typeof opts?.fadeIn === 'number' && opts.fadeIn > 0) {
				const rawVolume = this.volume();
				const target = typeof rawVolume === 'number' ? rawVolume : 1;
				this.volume(0);
				const steps = 20;
				const stepMs = (opts.fadeIn * 1000) / steps;
				for (let i = 1; i <= steps; i++) {
					await new Promise(r => setTimeout(r, stepMs));
					if (!isLatest()) return;
					this.volume((target * i) / steps);
				}
			}

			if (!isLatest()) return;
			// Restore phase to ready (or whatever state the backend resolved to).
			if (this._phase === 'loading') {
				transitionPhase(this, 'ready');
			}
			this.emit('mediaReady');
		}
		catch (err) {
			// Restore phase on failure.
			if (this._phase === 'loading' && (priorPhase === 'ready' || priorPhase === 'playing' || priorPhase === 'paused')) {
				transitionPhase(this, priorPhase);
			}
			throw err;
		}
	},

	async loadQueue<T extends BasePlaylistItem>(
		this: Internals,
		url: string,
		parser?: (raw: string) => T[],
	): Promise<void> {
		assertReady(this);

		this.emit('playlistResolving', { url });

		// Use authFetch under the hood so the consumer's auth pipeline is honored.
		const config = this.options ?? {};
		const ctrl = new AbortController();
		try {
			const items = await authFetch<T[]>({
				url,
				auth: this._authConfig ?? config.auth,
				parser: parser ?? ((raw: string): T[] => JSON.parse(raw)),
				emit: (event: string, data: unknown) => this.emit(event, data),
				pluginId: undefined,
				scope: 'player',
				signal: ctrl.signal,
			});
			this.queue(items);
			this.emit('playlistReady', { length: items.length });
		}
		catch (err) {
			const errorPayload = {
				error: err instanceof Error ? err : new Error(String(err)),
				severity: 'error' as const,
				scope: { kind: 'core' as const },
				timestamp: Date.now(),
				markHandled: () => {},
				isHandled: () => false,
				stopImmediatePropagation: () => {},
				isPropagationStopped: () => false,
				preventDefault: () => {},
				isDefaultPrevented: () => false,
			};
			this.emit('playlistResolveError', errorPayload);
			this.emit('error', errorPayload);
			throw err;
		}
	},
} as const;
