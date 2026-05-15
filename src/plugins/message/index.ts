import type { BaseEventMap, IPlayer } from '../../types';
import { Plugin } from '../../plugin';

/** Options for {@link MessagePlugin}. */
export interface MessageOptions {
	/**
	 * Default display duration in milliseconds for transient toasts. Applies
	 * when `show()`, `displayMessage()`, or `queue()` items do not specify their
	 * own duration. Default `3000`.
	 */
	durationMs?: number;

	/**
	 * CSS selector used to locate an existing element in which to mount the
	 * toast surface. When absent the plugin creates a `<div>` inside the player
	 * container.
	 */
	mountSelector?: string;
}

/**
 * Accepted input for {@link MessagePlugin.show} and {@link MessagePlugin.queue}.
 *
 * - `string` — plain text, uses the plugin's default duration.
 * - `{ text, durationMs? }` — explicit duration overrides the plugin default
 *   for that one message only.
 */
export type MessageInput = string | { text: string; durationMs?: number };

/**
 * Toast and overlay-message surface for the player. UI plugins and consumers
 * call `show('text')` to display a transient notification; the plugin handles
 * timing and teardown automatically.
 *
 * **Modes:**
 * - **Transient** (`show`, `queue`) — text appears for a configurable duration
 *   then hides automatically. Calling `show()` while a toast is visible
 *   replaces it and resets the timer.
 * - **Persistent** (`displayPersistent`, `removePersistent`) — a named overlay
 *   element that stays until explicitly removed. Useful for blocking states
 *   such as an autoplay-blocked "Tap to play" prompt.
 *
 * **Accessibility:** the toast surface carries `role="status"` and
 * `aria-live="polite"` so screen readers announce updates without stealing
 * focus. Persistent elements get the same ARIA attributes.
 *
 * **Queue:** `queue(messages)` plays a sequence of messages back-to-back, each
 * for its own `durationMs`. Calling `queue()` again, or `clear()`, cancels the
 * in-flight run immediately.
 */
export class MessagePlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, MessageOptions> {
	static override readonly id: string = 'message';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Toast / message overlay with persistent + transient modes';

	private toast: HTMLDivElement | null = null;
	private hideTimeout: number | null = null;
	private queueRunId: number = 0;
	private persistent = new Map<string, HTMLDivElement>();

	/**
	 * Creates and mounts the toast `<div>` into the player container with
	 * `role="status"` and `aria-live="polite"`. The element is hidden initially.
	 */
	override use(): void {
		const el = this.mount('toast');
		el.setAttribute('role', 'status');
		el.setAttribute('aria-live', 'polite');
		el.style.display = 'none';
		this.toast = el;
	}

	/**
	 * Display a transient toast message.
	 *
	 * Any toast currently on screen is replaced immediately and its auto-hide
	 * timer is cancelled. The new toast hides after `ms` milliseconds.
	 *
	 * @param text The message text to display.
	 * @param ms   Display duration in milliseconds. Defaults to `3000`.
	 */
	show(text: string, ms: number = 3000): void {
		const el = this.toast;
		if (!el)
			return;

		this.cancelHideTimeout();
		el.textContent = text;
		el.style.display = 'block';

		this.hideTimeout = this.timeout(() => {
			this.hideTimeout = null;
			this.hide();
		}, ms);
	}

	/**
	 * Hide the current transient toast and cancel any pending auto-hide timer.
	 * No-ops when the toast surface is not mounted.
	 */
	hide(): void {
		const el = this.toast;
		this.cancelHideTimeout();
		if (!el)
			return;
		el.textContent = '';
		el.style.display = 'none';
	}

	/**
	 * Display a message from a `string` or `{ text, durationMs? }` object.
	 *
	 * Kept for compatibility with callers that pass structured message objects.
	 * Prefer `show(text, ms)` for new call sites.
	 *
	 * @param data The message content.
	 * @param ms   Duration override — takes priority over `data.durationMs` and
	 *             `opts.durationMs` when provided.
	 */
	displayMessage(data: MessageInput, ms?: number): void {
		if (typeof data === 'string') {
			this.show(data, ms ?? this.opts?.durationMs);
			return;
		}
		this.show(data.text, ms ?? data.durationMs ?? this.opts?.durationMs);
	}

	/**
	 * Show a sequence of messages back-to-back, each displayed for its own
	 * `durationMs` (or the plugin default when not specified per-message).
	 *
	 * Calling `queue()` while a previous queue is running cancels the old run
	 * immediately. Calling `clear()` also cancels any in-flight queue.
	 *
	 * ```ts
	 * message.queue([
	 *   'Loading…',
	 *   { text: 'Almost there!', durationMs: 1500 },
	 *   'Done.',
	 * ]);
	 * ```
	 */
	queue(messages: ReadonlyArray<MessageInput>): void {
		const runId = ++this.queueRunId;
		const list = messages.slice();

		const next = (idx: number): void => {
			if (runId !== this.queueRunId)
				return;
			if (idx >= list.length) {
				this.cancelHideTimeout();
				return;
			}

			const item = list[idx]!;
			const text = typeof item === 'string' ? item : item.text;
			const ms = (typeof item === 'string' ? undefined : item.durationMs) ?? this.opts?.durationMs ?? 3000;

			this.cancelHideTimeout();
			const el = this.toast;
			if (el) {
				el.textContent = text;
				el.style.display = 'block';
			}

			this.hideTimeout = this.timeout(() => {
				this.hideTimeout = null;
				next(idx + 1);
			}, ms);
		};

		next(0);
	}

	/**
	 * Cancel any in-flight `queue()`, hide the current toast, and reset all
	 * pending timers. Persistent messages are unaffected — use
	 * `removePersistent(id)` to clear those.
	 */
	clear(): void {
		this.queueRunId++;
		this.hide();
	}

	/**
	 * Display a persistent overlay message that stays until `removePersistent(id)`
	 * is called.
	 *
	 * If a persistent message with the same `id` already exists its text is
	 * updated in-place without re-creating the element. Useful for blocking
	 * states such as autoplay-blocked "Tap to play" prompts.
	 *
	 * The element carries `role="status"` and `aria-live="polite"`.
	 *
	 * @param text Displayed text.
	 * @param id   Stable identifier for this persistent message. Use the same
	 *             `id` in `removePersistent(id)` to remove it.
	 */
	displayPersistent(text: string, id: string): void {
		const existing = this.persistent.get(id);
		if (existing) {
			existing.textContent = text;
			return;
		}

		const playerWithContainer = this.player as unknown as { container?: HTMLElement };
		const container = playerWithContainer.container;
		if (!container)
			return;

		const el = document.createElement('div');
		el.className = `nmplayer-message-persistent`;
		el.dataset['persistentId'] = id;
		el.setAttribute('role', 'status');
		el.setAttribute('aria-live', 'polite');
		el.textContent = text;
		container.appendChild(el);
		this.persistent.set(id, el);
	}

	/**
	 * Remove a persistent message by its `id`. No-ops when no message with that
	 * id exists.
	 */
	removePersistent(id: string): void {
		const el = this.persistent.get(id);
		if (!el)
			return;
		el.remove();
		this.persistent.delete(id);
	}

	/**
	 * Cancels any pending timers, removes all persistent overlay elements from
	 * the DOM, and releases the toast reference.
	 */
	override dispose(): void {
		this.cancelHideTimeout();
		this.queueRunId++;

		for (const el of this.persistent.values()) {
			try {
				el.remove();
			}
			catch { /* swallow */ }
		}
		this.persistent.clear();
		this.toast = null;
	}

	private cancelHideTimeout(): void {
		if (this.hideTimeout !== null) {
			clearTimeout(this.hideTimeout);
			this.hideTimeout = null;
		}
	}
}

/** Plugin alias for {@link MessagePlugin}. Pass to `addPlugin(messagePlugin)`. */
export const messagePlugin = MessagePlugin;
