import type { IClock } from './IClock';

/**
 * Default `IClock` implementation — delegates to `Date.now()`. Zero overhead
 * in production; tests replace this with a controllable fake.
 */
export const systemClock: IClock = {
	now: () => Date.now(),
};
