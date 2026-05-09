import type { BaseEventMap, IPlayer } from '../types';
import { Plugin } from '../plugin';

/** Options for {@link MessagePlugin}. */
export interface MessageOptions {
	durationMs?: number;
	mountSelector?: string;
}

/** Accepted input for `show` / `queue` — either a plain string or an object with per-message duration. */
export type MessageInput = string | { text: string; durationMs?: number };

/**
 * Toast/message overlay. UI plugins call `show('text')` (or the legacy
 * `displayMessage` alias) and the helper handles timing + cleanup.
 *
 * ARIA: the toast surface is wired with `role="status"` and `aria-live="polite"`
 * so screen readers announce updates without stealing focus.
 */
export class MessagePlugin<P extends IPlayer<BaseEventMap> = IPlayer> extends Plugin<P, MessageOptions> {
	static override readonly id: string = 'message';
	static override readonly version: string = '2.0.0';
	static override readonly description: string = 'Toast / message overlay with persistent + transient modes';

	private toast: HTMLDivElement | null = null;
	private hideTimeout: number | null = null;
	private queueRunId: number = 0;
	private persistent = new Map<string, HTMLDivElement>();

	/** Mounts the toast element into the player container with ARIA live-region attributes. */
	override use(): void {
		const el = this.mount('toast');
		el.setAttribute('role', 'status');
		el.setAttribute('aria-live', 'polite');
		el.style.display = 'none';
		this.toast = el;
	}

	/**
	 * Display a transient toast that auto-clears after `ms` (default 3000).
	 * Replaces any in-flight toast and cancels any pending auto-hide.
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

	/** Hide the current transient toast and cancel any pending auto-hide. */
	hide(): void {
		const el = this.toast;
		this.cancelHideTimeout();
		if (!el)
			return;
		el.textContent = '';
		el.style.display = 'none';
	}

	/**
	 * Alias for `show` accepting either a raw string or `{ text, durationMs? }`.
	 * Kept for back-compat with the original v1 API.
	 */
	displayMessage(data: MessageInput, ms?: number): void {
		if (typeof data === 'string') {
			this.show(data, ms ?? this.opts?.durationMs);
			return;
		}
		this.show(data.text, ms ?? data.durationMs ?? this.opts?.durationMs);
	}

	/**
	 * Show a sequence of messages back-to-back, each gated by its own `durationMs`
	 * (falls back to the plugin default). Calling `queue` again, or `clear`,
	 * cancels the previous run.
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

	/** Cancel any in-flight queue, hide the toast, and clear pending timers. */
	clear(): void {
		this.queueRunId++;
		this.hide();
	}

	/**
	 * Display a persistent message that stays until `removePersistent(id)` is
	 * called. Useful for blocking states like an autoplay-blocked "Tap to play"
	 * overlay.
	 */
	displayPersistent(text: string, id: string): void {
		const existing = this.persistent.get(id);
		if (existing) {
			existing.textContent = text;
			return;
		}
		const container = (this.player as IPlayer<any> & { container: HTMLElement }).container;
		const el = document.createElement('div');
		el.className = `nmplayer-message-persistent`;
		el.dataset['persistentId'] = id;
		el.setAttribute('role', 'status');
		el.setAttribute('aria-live', 'polite');
		el.textContent = text;
		container.appendChild(el);
		this.persistent.set(id, el);
	}

	/** Remove a persistent message by id. */
	removePersistent(id: string): void {
		const el = this.persistent.get(id);
		if (!el)
			return;
		el.remove();
		this.persistent.delete(id);
	}

	/** Cancels any pending timers, removes all persistent messages, and clears the toast element. */
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
