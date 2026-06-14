/**
 * The minimum shape every item in a player queue must satisfy. Both music and
 * video libraries extend this with their own domain-specific fields. The `id`
 * is the stable identity used by the queue, backlog, and cursor; it must be
 * unique within a session but does not need to be globally unique.
 *
 * `title`, `image`, and `url` are the canonical cross-library fields for
 * display name, cover art, and media source URL. Music adds `name: string`
 * (required, aliases `title` for one release cycle) and `cover?: string`
 * (aliases `image`). Video adds `poster?` and `thumbnail?` as aliases for
 * `image`. Code targeting both player libraries should populate `title`,
 * `image`, and `url`; domain-specific code may use the library's own field
 * names.
 */
export interface BasePlaylistItem {
	id: string | number;
	/** Cross-library canonical display name for the item. */
	title?: string;
	/** Cross-library canonical cover art / poster URL. */
	image?: string;
	/**
	 * Cross-library canonical media source URL. The `load()` pipeline resolves
	 * this field through the auth transformer and passes it to the backend.
	 * Declaring it on the base type removes the need for intersection constraints
	 * at call sites and lets queue items carry their URL without casts.
	 */
	url?: string;
}
