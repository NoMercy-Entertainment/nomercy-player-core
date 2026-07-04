// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Polish core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'pl',
 *   translations: {
 *     ...defaultTranslations,
 *     pl: plTranslations,
 *   },
 * });
 */
export const plTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Brak połączenia internetowego.',
	'core.network.timeout': 'Upłynął limit czasu połączenia. Próbuję ponownie…',
	'core.network.serverError': 'Serwer ma problemy. Spróbuj ponownie za moment.',
	'core.network.notFound': 'Nie znaleziono tej zawartości.',
	'core.network.rateLimited': 'Zbyt wiele żądań. Proszę zwolnij.',

	// Auth
	'core.auth.unauthenticated': 'Zaloguj się ponownie, aby odświeżyć sesję.',
	'core.auth.forbidden': 'Twoje konto nie ma dostępu do tej zawartości.',
	'core.auth.refreshFailed': 'Nie można odświeżyć sesji. Zaloguj się ponownie.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Dotknij lub kliknij gdziekolwiek, aby rozpocząć odtwarzanie.',
	'core.policy.userGestureRequired': 'Dotknij, aby włączyć dźwięk.',
	'core.policy.pipDenied': 'Obraz w obrazie nie jest dozwolony w tym kontekście.',
	'core.policy.fullscreenDenied': 'Pełny ekran nie jest dozwolony w tym kontekście.',
	'core.policy.wakeLockDenied': 'Ekran może zgasnąć podczas odtwarzania.',

	// Media
	'core.media.unsupported': 'Ten format nie jest obsługiwany przez Twoją przeglądarkę.',
	'core.media.decodeFailed': 'Odtwarzanie nie powiodło się — przełączanie na następne dostępne źródło.',
	'core.media.allDecodeFailed': 'Brak dostępnego źródła odtwarzania dla tej zawartości.',

	// DRM
	'core.drm.outputProtection': 'Twój wyświetlacz nie spełnia wymagań ochrony dla tej zawartości.',
	'core.drm.licenseFailed': 'Nie można uzyskać licencji na tę zawartość.',
	'core.drm.keySystemUnsupported': 'Twoja przeglądarka nie obsługuje wymaganego systemu ochrony.',

	// State / dev
	'core.state.queueEmpty': 'W kolejce nie ma nic.',
	'core.state.notReady': 'Odtwarzacz nie jest jeszcze gotowy.',

	// A11y announcements
	'core.a11y.playing': 'Odtwarzanie {title}',
	'core.a11y.paused': 'Wstrzymane',
	'core.a11y.stopped': 'Zatrzymane',
	'core.a11y.seeking': 'Wyszukiwanie do {time}',
	'core.a11y.trackChange': 'Teraz odtwarzam {title}',
	'core.a11y.error': 'Błąd podczas odtwarzania',
	'core.a11y.muted': 'Wyciszony',
	'core.a11y.unmuted': 'Dźwięk włączony',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Odtwarzanie wstrzymane — inna karta jest teraz odtwarzana.',
	'plugin.media-session.unsupported': 'Kontrolki mediów systemu operacyjnego nie są dostępne w tej przeglądarce.',
};

export default plTranslations;
