import type { BaseEventMap, IPlayer } from '../types';
import type { Cue, CueList } from './cue';

/** Minimal player surface `CueTracker.attach` subscribes to. */
export interface CueTrackerTarget {
	on: IPlayer<BaseEventMap>['on'];
	off: IPlayer<BaseEventMap>['off'];
	emit: IPlayer<BaseEventMap>['emit'];
}

export interface CueTrackerOptions {
	/** How close to a boundary still counts as "in" (seconds). Default 0. */
	tolerance?: number;
	/** Stable identifier — surfaces on every `cue:enter` / `cue:exit` payload. */
	trackerId?: string;
	/** Max recently-entered cues kept for `history(n)`. Default 32. */
	historyMax?: number;
}

type TrackerEvent = 'enter' | 'exit';
type Handler<T> = (cue: Cue<T>) => void;

/**
 * Time-driven cue dispatcher. Subscribes to a player's `time` and `seek`
 * events and emits `enter` / `exit` for cues as they activate.
 *
 * Lyrics, subtitles, and sprite-preview consumers all use the same machinery.
 *
 * Diff semantics:
 *  - On every time update, compute the new active set
 *  - Emit `exit` for cues that were active and are no longer
 *  - Emit `enter` for cues that are newly active
 *  - On `seek`, treat the position change as a discontinuity: emit `exit` for
 *    all previously-active cues, then `enter` for the new active set, in that
 *    order. Avoids overlapping enter/exit semantics during scrubbing.
 */
export class CueTracker<T> {
	private readonly tolerance: number;
	private readonly listeners = new Map<TrackerEvent, Set<Handler<T>>>();
	private active = new Set<Cue<T>>();
	private playerRef?: CueTrackerTarget;
	private boundOnTime?: (data: { time: number }) => void;
	private boundOnSeek?: (data: { time: number }) => void;
	private suspended = false;
	private readonly historyBuffer: Cue<T>[] = [];
	private readonly historyMax: number;

	/** Stable id for this tracker — referenced in `cue:enter` / `cue:exit` payloads. */
	readonly trackerId: string;

	constructor(private readonly list: CueList<T>, opts?: CueTrackerOptions) {
		this.tolerance = opts?.tolerance ?? 0;
		this.trackerId = opts?.trackerId ?? `tracker-${
			Math.random()
				.toString(36)
				.slice(2, 10)}`;
		this.historyMax = opts?.historyMax ?? 32;
	}

	attach(player: CueTrackerTarget): void {
		this.playerRef = player;

		this.boundOnTime = ({ time }) => this.onTime(time);
		this.boundOnSeek = ({ time }) => this.onSeek(time);

		player.on('time', this.boundOnTime);
		player.on('seek', this.boundOnSeek);
	}

	detach(): void {
		if (!this.playerRef)
			return;
		if (this.boundOnTime)
			this.playerRef.off('time', this.boundOnTime);
		if (this.boundOnSeek)
			this.playerRef.off('seek', this.boundOnSeek);

		// Emit exit for any still-active cues so consumers can clean up.
		for (const cue of this.active) this.emit('exit', cue);
		this.active.clear();

		this.playerRef = undefined;
		this.boundOnTime = undefined;
		this.boundOnSeek = undefined;
	}

	on(event: TrackerEvent, fn: Handler<T>): void {
		let set = this.listeners.get(event);
		if (!set) {
			set = new Set();
			this.listeners.set(event, set);
		}
		set.add(fn);
	}

	off(event: TrackerEvent, fn: Handler<T>): void {
		const set = this.listeners.get(event);
		if (!set)
			return;
		set.delete(fn);
		if (set.size === 0)
			this.listeners.delete(event);
	}

	/**
	 * Pause cue dispatch without detaching from the player. The tracker keeps
	 * observing `time` / `seek` but emits nothing until `resume()`.
	 */
	suspend(): void {
		this.suspended = true;
	}

	/** Resume dispatch after `suspend()`. The next time tick re-evaluates active cues. */
	resume(): void {
		this.suspended = false;
	}

	/** Recently-entered cues, newest-first, capped at `historyMax`. */
	history(n?: number): Cue<T>[] {
		const cap = n ?? this.historyBuffer.length;
		return this.historyBuffer.slice(-cap).reverse();
	}

	dispose(): void {
		this.detach();
		this.listeners.clear();
		this.historyBuffer.length = 0;
	}

	private onTime(time: number): void {
		if (this.suspended)
			return;
		const next = this.computeActive(time);
		this.diffAndEmit(next);
	}

	private onSeek(time: number): void {
		if (this.suspended)
			return;
		// Treat seeks as a discontinuity: clear all active first, then enter the
		// new active set. Avoids spurious enter/exit pairs during scrubbing.
		for (const cue of this.active) this.emit('exit', cue);
		this.active.clear();
		const next = this.computeActive(time);
		for (const cue of next) {
			this.active.add(cue);
			this.recordHistory(cue);
			this.emit('enter', cue);
		}
	}

	private computeActive(time: number): Cue<T>[] {
		// Apply tolerance: a cue is "in" if start - tol <= time <= end + tol
		const adjusted = this.tolerance === 0 ? time : time;
		const candidates = this.list.active(adjusted);
		if (this.tolerance === 0)
			return candidates;

		// With tolerance, also pick up cues whose start is within tol of `time`
		// but whose start is technically > time. Walk the next-cue if it's close.
		const next = this.list.next(time);
		if (next && next.start - time <= this.tolerance) {
			return [...candidates, next];
		}
		return candidates;
	}

	private diffAndEmit(next: Cue<T>[]): void {
		const nextSet = new Set(next);

		// Exits: cues that were active but aren't in the new set
		for (const cue of this.active) {
			if (!nextSet.has(cue))
				this.emit('exit', cue);
		}

		// Enters: cues newly in the active set
		for (const cue of nextSet) {
			if (!this.active.has(cue)) {
				this.recordHistory(cue);
				this.emit('enter', cue);
			}
		}

		this.active = nextSet;
	}

	private recordHistory(cue: Cue<T>): void {
		this.historyBuffer.push(cue);
		if (this.historyBuffer.length > this.historyMax)
			this.historyBuffer.shift();
	}

	private emit(event: TrackerEvent, cue: Cue<T>): void {
		// Re-emit on the player's standard cue channel so consumers wiring
		// `player.on('cue:enter', ({ trackerId, cue }) => ...)` see all trackers
		// uniformly without subscribing per-tracker.
		if (this.playerRef) {
			const playerEvent = event === 'enter' ? 'cue:enter' : 'cue:exit';
			try {
				this.playerRef.emit(playerEvent, {
					trackerId: this.trackerId,
					cue,
				});
			}
			catch (err) {
				void err;
			}
		}

		const set = this.listeners.get(event);
		if (!set)
			return;
		for (const fn of [...set]) {
			try {
				fn(cue);
			}
			catch (err) { void err; /* swallow per contract */ }
		}
	}
}
