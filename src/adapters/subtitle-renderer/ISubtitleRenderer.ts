/**
 * Pluggable subtitle renderer contract. The default implementation (`dom.ts`)
 * builds a `DocumentFragment` from parsed VTT cue markup. Alternative
 * implementations can render to a canvas (Octopus/libass) or a WebGL surface.
 *
 * Consumers inject a custom renderer via a plugin — the kit does not expose
 * this as a direct `setup()` field because rendering is always plugin-driven.
 */
export interface ISubtitleRenderer {
	/**
	 * Render the cue markup string into a container. The caller provides the
	 * target element; the renderer is responsible only for building and
	 * appending the content.
	 *
	 * `markup` is the raw string from `VTTSubtitlePayload.markup`. May contain
	 * inline tags (`<i>`, `<b>`, `<u>`) but no arbitrary HTML.
	 */
	render(markup: string): DocumentFragment | HTMLElement;
}
