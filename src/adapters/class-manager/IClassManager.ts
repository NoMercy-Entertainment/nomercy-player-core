import type { AddClasses } from '../../core/mixins/dom-mixin';

export type { AddClasses };

/**
 * Pluggable class-management surface. The default implementations operate on
 * real DOM elements via `classList`. Consumers can supply a test double that
 * records class mutations without requiring a full DOM environment.
 */
export interface IClassManager {
	addClasses<T extends Element>(el: T, names: string[]): AddClasses<T>;
	removeClasses<T extends Element>(el: T, names: string[]): T;
}
