/**
 * The kit's own version. Plugins declare `static readonly minCoreVersion` and
 * `addPlugin` rejects with `core:plugin/incompatible-core-version` when the
 * plugin's required minimum exceeds this. Bump alongside the kit's package.json
 * version on every release.
 */
export const KIT_VERSION = '0.1.0';
