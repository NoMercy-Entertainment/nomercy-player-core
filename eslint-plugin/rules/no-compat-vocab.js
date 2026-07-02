// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Ban v1/compat vocabulary from the v2 player libraries. The v2 code carries no
 * compat layer, so the old factory names, the `*StateToken` string-union types,
 * the `PlayerCore` class, and compat markers in comments must not reappear. The
 * canonical v2 classes `NMVideoPlayer` / `NMMusicPlayer` are case-sensitively
 * distinct from the banned `nmVideoPlayer` / `nmMusicPlayer` and stay allowed.
 */

const DEFAULT_IDENTIFIERS = ['nmVideoPlayer', 'nmMusicPlayer', 'nmMPlayer', 'trackEndingSoon'];
const DEFAULT_IDENTIFIER_PATTERNS = ['^(Play|Volume|Repeat|Shuffle)StateToken$'];
const DEFAULT_CLASSES = ['PlayerCore'];
const DEFAULT_COMMENT_SUBSTRINGS = ['@deprecated', 'compatible alias', 'compat alias', 'v1-compat'];

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Ban v1/compat vocabulary (identifiers, the PlayerCore class, compat comment markers) in v2.',
		},
		schema: [
			{
				type: 'object',
				properties: {
					identifiers: {
						type: 'array',
						items: { type: 'string' },
					},
					identifierPatterns: {
						type: 'array',
						items: { type: 'string' },
					},
					classes: {
						type: 'array',
						items: { type: 'string' },
					},
					commentSubstrings: {
						type: 'array',
						items: { type: 'string' },
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			bannedIdentifier: "Compat vocabulary '{{name}}' is banned in v2 — {{hint}}",
			bannedComment: "Compat marker '{{marker}}' in a comment — v2 carries no compat layer; drop it or move the rationale to the commit message.",
		},
	},

	create(context) {
		const options = context.options[0] ?? {};
		const identifiers = new Set(options.identifiers ?? DEFAULT_IDENTIFIERS);
		const patterns = (options.identifierPatterns ?? DEFAULT_IDENTIFIER_PATTERNS).map(source => new RegExp(source));
		const classes = new Set(options.classes ?? DEFAULT_CLASSES);
		const substrings = options.commentSubstrings ?? DEFAULT_COMMENT_SUBSTRINGS;
		const sourceCode = context.sourceCode ?? context.getSourceCode();

		function checkName(node, name, hint) {
			if (identifiers.has(name) || patterns.some(pattern => pattern.test(name))) {
				context.report({
					node,
					messageId: 'bannedIdentifier',
					data: {
						name,
						hint: hint ?? 'use the canonical v2 name.',
					},
				});
			}
		}

		return {
			Identifier(node) {
				checkName(node, node.name);
			},
			ClassDeclaration(node) {
				if (node.id && classes.has(node.id.name)) {
					context.report({
						node: node.id,
						messageId: 'bannedIdentifier',
						data: {
							name: node.id.name,
							hint: 'the v1 PlayerCore class has no place in v2.',
						},
					});
				}
			},
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					const lower = comment.value.toLowerCase();
					for (const substring of substrings) {
						if (lower.includes(substring.toLowerCase())) {
							context.report({
								loc: comment.loc,
								messageId: 'bannedComment',
								data: { marker: substring },
							});
							break;
						}
					}
				}
			},
		};
	},
};
