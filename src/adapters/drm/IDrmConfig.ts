/**
 * DRM configuration. Passed to a library-specific DRM plugin (e.g. the video
 * package's `DrmPlugin`) via `addPlugin(DrmPlugin, config)`.
 *
 * DRM is a video-only concern — this type is defined in the kit for
 * cross-package type sharing, but `BasePlayerConfig` does not include a `drm`
 * field. Configure DRM through the plugin directly.
 */
export interface DrmConfig {
	/** EME key system string (e.g. `'com.widevine.alpha'`, `'com.apple.fps'`). */
	keySystem: string;
	/** License server URL. The kit's fetch pipeline (including auth headers) is used. */
	licenseUrl: string;
	/** Optional server certificate for FairPlay and some Widevine deployments. */
	certificate?: ArrayBuffer | string;
	/** Optional per-request signing override — same contract as `AuthConfig.signRequest`. */
	customSignRequest?: (request: Request) => Request | Promise<Request>;
}
