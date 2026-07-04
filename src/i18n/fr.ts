// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * French core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'fr',
 *   translations: {
 *     ...defaultTranslations,
 *     fr: frTranslations,
 *   },
 * });
 */
export const frTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Pas de connexion Internet.',
	'core.network.timeout': 'Connexion expirée. Nouvelle tentative…',
	'core.network.serverError': 'Le serveur a des problèmes. Réessayez dans un instant.',
	'core.network.notFound': 'Ce contenu n\'a pas pu être trouvé.',
	'core.network.rateLimited': 'Trop de demandes. Veuillez ralentir.',

	// Auth
	'core.auth.unauthenticated': 'Connectez-vous à nouveau pour actualiser votre session.',
	'core.auth.forbidden': 'Votre compte n\'a pas accès à ce contenu.',
	'core.auth.refreshFailed': 'Impossible d\'actualiser votre session. Connectez-vous à nouveau.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Appuyez ou cliquez n\'importe où pour commencer la lecture.',
	'core.policy.userGestureRequired': 'Appuyez pour activer le son.',
	'core.policy.pipDenied': 'L\'image dans l\'image n\'est pas autorisée dans ce contexte.',
	'core.policy.fullscreenDenied': 'Le plein écran n\'est pas autorisé dans ce contexte.',
	'core.policy.wakeLockDenied': 'L\'écran peut s\'assombrir pendant la lecture.',

	// Media
	'core.media.unsupported': 'Ce format n\'est pas pris en charge par votre navigateur.',
	'core.media.decodeFailed': 'Échec de la lecture — passage à la source suivante disponible.',
	'core.media.allDecodeFailed': 'Aucune source lisible n\'est disponible pour ce contenu.',

	// DRM
	'core.drm.outputProtection': 'Votre écran ne répond pas aux exigences de protection pour ce contenu.',
	'core.drm.licenseFailed': 'Impossible d\'obtenir une licence pour ce contenu.',
	'core.drm.keySystemUnsupported': 'Votre navigateur ne prend pas en charge le système de protection requis.',

	// State / dev
	'core.state.queueEmpty': 'Il n\'y a rien dans la queue.',
	'core.state.notReady': 'Le lecteur n\'est pas encore prêt.',

	// A11y announcements
	'core.a11y.playing': 'Lecture en cours de {title}',
	'core.a11y.paused': 'En pause',
	'core.a11y.stopped': 'Arrêté',
	'core.a11y.seeking': 'Recherche à {time}',
	'core.a11y.trackChange': 'Lecture en cours de {title}',
	'core.a11y.error': 'Une erreur s\'est produite pendant la lecture',
	'core.a11y.muted': 'Coupé',
	'core.a11y.unmuted': 'Son activé',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Lecture suspendue — un autre onglet est maintenant en lecture.',
	'plugin.media-session.unsupported': 'Les contrôles média du système d\'exploitation ne sont pas disponibles dans ce navigateur.',
};

export default frTranslations;
