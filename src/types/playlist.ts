/**
 * The minimum shape every item in a player queue must satisfy. Both music and
 * video libraries extend this with their own domain-specific fields. The `id`
 * is the stable identity used by the queue, backlog, and cursor; it must be
 * unique within a session but does not need to be globally unique.
 *
 * `title` and `image` are the canonical cross-library fields for display name
 * and cover art. Music adds `name: string` (required, aliases `title` for one
 * release cycle) and `cover?: string` (aliases `image`). Video adds `title?`,
 * `image?`, `poster?`, `thumbnail?`. Code targeting both player libraries should
 * populate `title` and `image`; domain-specific code may use the library's own
 * field names.
 */
export interface BasePlaylistItem {
	id: string | number;
	/** Cross-library canonical display name for the item. */
	title?: string;
	/** Cross-library canonical cover art / poster URL. */
	image?: string;
}
