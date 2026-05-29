/**
 * Snapshot returned by `state()`. `runtime` is plugin-defined and intended for
 * debug overlays / save+restore tooling.
 */
export interface PluginState<O = unknown> {
	id: string;
	version: string;
	enabled: boolean;
	opts: Readonly<O>;
	runtime: Record<string, unknown>;
}
