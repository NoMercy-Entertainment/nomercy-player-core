// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import noCompatVocab from './rules/no-compat-vocab.js';
import noHistoryComments from './rules/no-history-comments.js';
import noObjectLiteralCast from './rules/no-object-literal-cast.js';
import noSingleLetterIdent from './rules/no-single-letter-ident.js';
import noUnknownCast from './rules/no-unknown-cast.js';

const plugin = {
	meta: {
		name: '@nomercy-entertainment/eslint-plugin-player',
		version: '0.1.0',
	},
	rules: {
		'no-single-letter-ident': noSingleLetterIdent,
		'no-compat-vocab': noCompatVocab,
		'no-history-comments': noHistoryComments,
		'no-object-literal-cast': noObjectLiteralCast,
		'no-unknown-cast': noUnknownCast,
	},
};

/**
 * Flat-config preset. Spread `player.configs.recommended` into a config object,
 * or apply the rules by hand. The cast rules are best relaxed inside test files
 * where mock construction legitimately casts — see the README.
 */
plugin.configs = {
	recommended: {
		plugins: { player: plugin },
		rules: {
			'player/no-single-letter-ident': 'error',
			'player/no-compat-vocab': 'error',
			'player/no-history-comments': 'error',
			'player/no-object-literal-cast': 'error',
			'player/no-unknown-cast': 'error',
		},
	},
};

export default plugin;
