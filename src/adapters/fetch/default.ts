import type { IFetch } from './IFetch';

/**
 * Default `IFetch` implementation — a thin wrapper around the browser's
 * native `fetch` global. The kit's `authFetch` orchestrator uses this unless
 * the consumer injects a custom transport.
 */
export const defaultFetch: IFetch = (url, opts) => fetch(url, opts);
