// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Ban the detectable subset of useless comments: bug-number history, spec
 * citations (`§`), and naked TODO/FIXME markers with no issue reference. The
 * general "no WHAT comment" judgement stays with the code-quality reviewer;
 * this rule only catches the mechanical patterns that leaked into the trio.
 */

const DEFAULT_ISSUE_REF = '#\\d+|[A-Z][A-Z0-9]+-\\d+|https?://';

const BUG_HISTORY = /\bbug\s+\d/i;
const SPEC_CITATION = /§/;
const TODO_MARKER = /\b(?:TODO|FIXME)\b/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Ban bug-history comments, spec citations (§), and naked TODO/FIXME markers.',
		},
		schema: [
			{
				type: 'object',
				properties: {
					issueRefPattern: { type: 'string' },
				},
				additionalProperties: false,
			},
		],
		messages: {
			bugHistory: 'Bug-number history in a comment — that belongs in the commit message, not the code.',
			specCitation: "Spec citation ('§') in a comment — link the spec from docs; don't cite section markers in code.",
			nakedTodo: 'TODO/FIXME without an issue reference — file an issue and reference it, or remove the note.',
		},
	},

	create(context) {
		const issueRef = new RegExp(context.options[0]?.issueRefPattern ?? DEFAULT_ISSUE_REF);
		const sourceCode = context.sourceCode ?? context.getSourceCode();

		return {
			Program() {
				for (const comment of sourceCode.getAllComments()) {
					const value = comment.value;
					if (BUG_HISTORY.test(value)) {
						context.report({
							loc: comment.loc,
							messageId: 'bugHistory',
						});
						continue;
					}
					if (SPEC_CITATION.test(value)) {
						context.report({
							loc: comment.loc,
							messageId: 'specCitation',
						});
						continue;
					}
					if (TODO_MARKER.test(value) && !issueRef.test(value)) {
						context.report({
							loc: comment.loc,
							messageId: 'nakedTodo',
						});
					}
				}
			},
		};
	},
};
