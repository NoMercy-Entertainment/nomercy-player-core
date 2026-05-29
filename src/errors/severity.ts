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

/** Literal union for typo-safe severity. */
export type Severity = typeof SEVERITY[keyof typeof SEVERITY];

/** Map literal severity string → 1/2/3/4 used in numeric codes. */
export const SEVERITY_LEVEL: Record<Severity, 1 | 2 | 3 | 4> = {
	[SEVERITY.INFO]: 1,
	[SEVERITY.WARNING]: 2,
	[SEVERITY.ERROR]: 3,
	[SEVERITY.FATAL]: 4,
};
