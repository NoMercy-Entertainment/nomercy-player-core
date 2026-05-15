/**
 * The minimum shape every item in a player queue must satisfy. Both music and
 * video libraries extend this with their own domain-specific fields. The `id`
 * is the stable identity used by the queue, backlog, and cursor; it must be
 * unique within a session but does not need to be globally unique.
 */
export interface BasePlaylistItem {
	id: string | number;
}
