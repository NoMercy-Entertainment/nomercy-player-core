/**
 * Structural base styles for the player container. Injected once per
 * document when the first player seeds its container class.
 *
 * Headless means no THEME — it does not mean the media element floats at
 * intrinsic size in the corner of an unpositioned box. These rules cover
 * layout only: the container establishes a positioning context and the
 * media / render surfaces fill it. Colors, fonts, control chrome and every
 * other visual decision stay with UI plugins and consumers.
 *
 * Consumers override freely: the sheet is appended to `<head>` before any
 * consumer stylesheet of equal specificity loaded later in the cascade, and
 * inline styles (e.g. the aspect-ratio menu's `object-fit`) always win.
 */

const BASE_STYLE_ID = 'nmplayer-base-styles';

const BASE_STYLES = `
.nomercyplayer {
	position: relative;
	overflow: hidden;
	width: 100%;
	height: 100%;
	background: #000;
}

.nomercyplayer video {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: contain;
	z-index: 0;
	outline: 0;
}

.nomercyplayer .libassjs-canvas-parent {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
}

.nomercyplayer .nmplayer-canvas-surface {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
`;

/** Inject the structural stylesheet into the container's document. Idempotent. */
export function ensureBaseStyles(container: Element): void {
	const doc = container.ownerDocument;
	if (!doc?.head || doc.getElementById(BASE_STYLE_ID)) {
		return;
	}

	const style = doc.createElement('style');
	style.id = BASE_STYLE_ID;
	style.textContent = BASE_STYLES;
	doc.head.appendChild(style);
}
