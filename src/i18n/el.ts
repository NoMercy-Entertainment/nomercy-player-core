// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Greek core translations bundle. Mirrors every key in `en.ts`.
 *
 * Consumers load this alongside the English bundle:
 *
 * @example
 * setup({
 *   language: 'el',
 *   translations: {
 *     ...defaultTranslations,
 *     el: elTranslations,
 *   },
 * });
 */
export const elTranslations: Record<string, string> = {
	// Network
	'core.network.offline': 'Χωρίς σύνδεση διαδικτύου.',
	'core.network.timeout': 'Σύνδεση λήξη. Δοκιμή ξανά…',
	'core.network.serverError': 'Ο διακομιστής αντιμετωπίζει προβλήματα. Δοκιμάστε ξανά σε λίγο.',
	'core.network.notFound': 'Δεν ήταν δυνατή η εύρεση αυτού του περιεχομένου.',
	'core.network.rateLimited': 'Πολλά αιτήματα. Παρακαλώ επιβραδύνετε.',

	// Auth
	'core.auth.unauthenticated': 'Συνδεθείτε ξανά για να ανανεώσετε τη συνεδρία σας.',
	'core.auth.forbidden': 'Ο λογαριασμός σας δεν έχει πρόσβαση σε αυτό το περιεχόμενο.',
	'core.auth.refreshFailed': 'Δεν ήταν δυνατή η ανανέωση της συνεδρίας σας. Συνδεθείτε ξανά.',

	// Browser policy
	'core.policy.autoplayBlocked': 'Αγγίξτε ή κάντε κλικ οπουδήποτε για να ξεκινήσετε την αναπαραγωγή.',
	'core.policy.userGestureRequired': 'Αγγίξτε για ενεργοποίηση ήχου.',
	'core.policy.pipDenied': 'Το picture-in-picture δεν επιτρέπεται σε αυτό το πλαίσιο.',
	'core.policy.fullscreenDenied': 'Ο πλήρης οθόνη δεν επιτρέπεται σε αυτό το πλαίσιο.',
	'core.policy.wakeLockDenied': 'Η οθόνη μπορεί να σκοτεινιάσει κατά την αναπαραγωγή.',

	// Media
	'core.media.unsupported': 'Αυτή η μορφή δεν υποστηρίζεται από τον προγράμματος περιήγησής σας.',
	'core.media.decodeFailed': 'Αποτυχία αναπαραγωγής — εναλλαγή στην επόμενη διαθέσιμη πηγή.',
	'core.media.allDecodeFailed': 'Δεν υπάρχει διαθέσιμη αναπαραγόμενη πηγή για αυτό το περιεχόμενο.',

	// DRM
	'core.drm.outputProtection': 'Η οθόνη σας δεν πληροί τις απαιτήσεις προστασίας για αυτό το περιεχόμενο.',
	'core.drm.licenseFailed': 'Δεν ήταν δυνατή η λήψη άδειας για αυτό το περιεχόμενο.',
	'core.drm.keySystemUnsupported': 'Το πρόγραμμα περιήγησής σας δεν υποστηρίζει το απαιτούμενο σύστημα προστασίας.',

	// State / dev
	'core.state.queueEmpty': 'Δεν υπάρχει τίποτα στην ουρά.',
	'core.state.notReady': 'Ο αναπαραγωγός δεν είναι ακόμη έτοιμος.',

	// A11y announcements
	'core.a11y.playing': 'Αναπαραγωγή {title}',
	'core.a11y.paused': 'Σε παύση',
	'core.a11y.stopped': 'Διακοπή',
	'core.a11y.seeking': 'Αναζήτηση σε {time}',
	'core.a11y.trackChange': 'Τώρα αναπαράγεται {title}',
	'core.a11y.error': 'Σφάλμα κατά την αναπαραγωγή',
	'core.a11y.muted': 'Σίγαση',
	'core.a11y.unmuted': 'Ενεργοποίηση ήχου',

	// Kit plugin lifecycle
	'plugin.tab-leader.lost': 'Η αναπαραγωγή σταμάτησε — μια άλλη καρτέλα αναπαράγεται τώρα.',
	'plugin.media-session.unsupported': 'Τα στοιχεία ελέγχου μέσων του λειτουργικού συστήματος δεν είναι διαθέσιμα σε αυτό το πρόγραμμα περιήγησης.',
};

export default elTranslations;
