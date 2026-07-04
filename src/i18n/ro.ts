// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Romanian core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'ro',
 *   translations: {
 *     ...defaultTranslations,
 *     ro: roTranslations,
 *   },
 * });
 */
export const roTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Nicio conexiune la Internet.',
	'core.network.timeout': 'Conexiunea a expirat. Se încearcă din nou…',
	'core.network.serverError': 'Serverul are probleme. Încercați din nou într-un moment.',
	'core.network.notFound': 'Acel conținut nu a putut fi găsit.',
	'core.network.rateLimited': 'Prea multe cereri. Vă rog, încetiniți.',

	// Auth
	'core.auth.unauthenticated': 'Conectați-vă din nou pentru a vă reîmprospăta sesiunea.',
	'core.auth.forbidden': 'Contul dvs. nu are acces la acest conținut.',
	'core.auth.refreshFailed': 'Nu s-a putut reîmprospăta sesiunea. Conectați-vă din nou.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Atingeți sau faceți clic oriunde pentru a începe redarea.',
	'core.policy.userGestureRequired': 'Atingeți pentru a activa audio.',
	'core.policy.pipDenied': 'Imaginea în imagine nu este permisă în acest context.',
	'core.policy.fullscreenDenied': 'Ecran complet nu este permis în acest context.',
	'core.policy.wakeLockDenied': 'Ecranul poate să se stingă în timpul redării.',

	// Media
	'core.media.unsupported': 'Acest format nu este suportat de browserul dvs.',
	'core.media.decodeFailed': 'Redarea a eșuat — se comută la următoarea sursă disponibilă.',
	'core.media.allDecodeFailed': 'Nicio sursă de redare disponibilă pentru acest conținut.',

	// DRM
	'core.drm.outputProtection': 'Afișajul dvs. nu îndeplinește cerințele de protecție pentru acest conținut.',
	'core.drm.licenseFailed': 'Nu s-a putut obține o licență pentru acest conținut.',
	'core.drm.keySystemUnsupported': 'Browserul dvs. nu suportă sistemul de protecție necesar.',

	// State / dev
	'core.state.queueEmpty': 'Nu este nimic în coadă.',
	'core.state.notReady': 'Playerul nu este încă gata.',

	// A11y announcements
	'core.a11y.playing': 'Se redă {title}',
	'core.a11y.paused': 'Pus pe pauză',
	'core.a11y.stopped': 'Oprit',
	'core.a11y.seeking': 'Caut {time}',
	'core.a11y.trackChange': 'Se redă acum {title}',
	'core.a11y.error': 'O eroare s-a produs în timpul redării',
	'core.a11y.muted': 'Negăsit',
	'core.a11y.unmuted': 'Sunet pornit',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Redarea a fost pusă pe pauză — o altă filă se redă acum.',
	'plugin.media-session.unsupported': 'Controalele media ale SO nu sunt disponibile în acest browser.',
};

export default roTranslations;
