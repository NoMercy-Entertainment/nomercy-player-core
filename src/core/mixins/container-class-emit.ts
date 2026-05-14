import type { PlayerPhase } from '../../types';
import { EventEmitter } from '../../events';

import type { Internals } from '../state';


// ──────────────────────────────────────────────────────────────────────────
// Container class rules — driven by player events to keep CSS state in sync.
// ──────────────────────────────────────────────────────────────────────────

const PLAY_STATE_CLASSES: ReadonlyArray<string> = ['playing', 'paused', 'stopped', 'ended', 'loading', 'buffering'] as const;

type ContainerClassRule =
	| { kind: 'swap'; add: string; remove: readonly string[] }
	| { kind: 'drop'; remove: readonly string[] }
	| { kind: 'toggle'; cls: string; payloadKey: string }
	| { kind: 'binary'; whenTrue: string; whenFalse: string; payloadKey: string }
	| { kind: 'phase' };

const CONTAINER_CLASS_RULES: ReadonlyMap<string, ContainerClassRule> = new Map<string, ContainerClassRule>([
	['play', { kind: 'swap', add: 'playing', remove: PLAY_STATE_CLASSES.filter(c => c !== 'playing') }],
	['pause', { kind: 'swap', add: 'paused', remove: PLAY_STATE_CLASSES.filter(c => c !== 'paused') }],
	['stop', { kind: 'swap', add: 'stopped', remove: PLAY_STATE_CLASSES.filter(c => c !== 'stopped') }],
	['ended', { kind: 'swap', add: 'ended', remove: PLAY_STATE_CLASSES.filter(c => c !== 'ended') }],
	['waiting', { kind: 'swap', add: 'buffering', remove: ['playing'] }],
	['stalled', { kind: 'swap', add: 'buffering', remove: ['playing'] }],
	['canplay', { kind: 'drop', remove: ['buffering'] }],
	['mute', { kind: 'toggle', cls: 'muted', payloadKey: 'muted' }],
	['fullscreen', { kind: 'toggle', cls: 'fullscreen', payloadKey: 'active' }],
	['pip', { kind: 'toggle', cls: 'pip', payloadKey: 'active' }],
	['theater', { kind: 'toggle', cls: 'theater', payloadKey: 'active' }],
	['phase', { kind: 'phase' }],
	['activity', { kind: 'binary', whenTrue: 'active', whenFalse: 'inactive', payloadKey: 'active' }],
]);

function _applyContainerClassRule(container: HTMLElement | undefined, rule: ContainerClassRule, data: unknown): void {
	if (!container || typeof container.classList === 'undefined') return;

	if (rule.kind === 'swap') {
		for (const cls of rule.remove) container.classList.remove(cls);
		container.classList.add(rule.add);
		return;
	}

	if (rule.kind === 'drop') {
		for (const cls of rule.remove) container.classList.remove(cls);
		return;
	}

	if (rule.kind === 'toggle') {
		const payload: Record<string, unknown> = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
		container.classList.toggle(rule.cls, Boolean(payload[rule.payloadKey]));
		return;
	}

	if (rule.kind === 'binary') {
		const payload: Record<string, unknown> = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {};
		const on = Boolean(payload[rule.payloadKey]);
		container.classList.add(on ? rule.whenTrue : rule.whenFalse);
		container.classList.remove(on ? rule.whenFalse : rule.whenTrue);
		return;
	}

	if (rule.kind === 'phase') {
		const phasePayload = typeof data === 'object' && data !== null && 'to' in data
			? (data as { to: PlayerPhase })
			: undefined;
		if (!phasePayload) return;

		if (PLAY_STATE_CLASSES.includes(phasePayload.to)) {
			for (const cls of PLAY_STATE_CLASSES) container.classList.remove(cls);
			container.classList.add(phasePayload.to);
			return;
		}

		if (phasePayload.to === 'ready') {
			for (const cls of PLAY_STATE_CLASSES) container.classList.remove(cls);
			container.classList.add('paused');
		}
	}
}


// ──────────────────────────────────────────────────────────────────────────
// Mixin: containerClassEmit — wraps `emit` to keep `.nomercyplayer` CSS
// state classes in sync with every player event.
// ──────────────────────────────────────────────────────────────────────────

export const containerClassEmitMethods = {
	emit(this: Internals, event: any, data?: any): void {
		const rule = CONTAINER_CLASS_RULES.get(String(event));
		if (rule) {
			_applyContainerClassRule(this.container, rule, data);
		}
		EventEmitter.prototype.emit.call(this, event, data);
	},
} as const;
