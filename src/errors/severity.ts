/** Literal union for typo-safe severity. */
export type Severity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Runtime constants — paired with the Severity type via `as const` so
 * consumers who prefer constant comparisons get them, while typing stays
 * a clean literal union.
 */
export const SEVERITY = {
	FATAL: 'fatal',
	ERROR: 'error',
	WARNING: 'warning',
	INFO: 'info',
} as const;

/** Map literal severity string → 1/2/3/4 used in numeric codes. */
export const SEVERITY_LEVEL: Record<Severity, 1 | 2 | 3 | 4> = {
	info: 1,
	warning: 2,
	error: 3,
	fatal: 4,
};
