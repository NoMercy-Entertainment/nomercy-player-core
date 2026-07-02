// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Disallow `x as unknown as T` unless it carries an adjacent justification
 * comment. A few double-casts are structurally forced (prototype-wrapping of
 * mixin-composed methods, reaching a generic registry, opaque-event narrowing).
 * Those stay legal, but each must be deliberate: a short comment on the same
 * line or the line directly above explaining why. Everything else should be
 * typed at construction instead.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow `as unknown as T` unless justified by an adjacent comment.',
		},
		schema: [],
		messages: {
			unknownCast: '`as unknown as {{type}}` — add a short inline comment justifying the double-cast, or type it at construction.',
		},
	},

	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();

		const commentEndLines = new Set();
		for (const comment of sourceCode.getAllComments()) {
			for (let line = comment.loc.start.line; line <= comment.loc.end.line; line++)
				commentEndLines.add(line);
		}

		return {
			TSAsExpression(node) {
				const inner = node.expression;
				if (inner.type !== 'TSAsExpression' || inner.typeAnnotation.type !== 'TSUnknownKeyword')
					return;

				const line = node.loc.start.line;
				const justified = commentEndLines.has(line) || commentEndLines.has(line - 1);
				if (justified)
					return;

				context.report({
					node,
					messageId: 'unknownCast',
					data: { type: sourceCode.getText(node.typeAnnotation) },
				});
			},
		};
	},
};
