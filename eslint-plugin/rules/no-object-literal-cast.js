// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Disallow `{ ... } as SomeType` on an object literal. The type belongs at the
 * construction site: a typed const, a typed parameter, or the function's return
 * type — never a cast pinned onto the literal. `as const` is exempt.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow casting an object literal with `as` — type it at construction instead.',
		},
		schema: [],
		messages: {
			literalCast: 'Cast on an object literal — type it at construction (typed const / parameter / return type) instead of `as {{type}}`.',
		},
	},

	create(context) {
		const sourceCode = context.sourceCode ?? context.getSourceCode();

		return {
			TSAsExpression(node) {
				if (node.expression.type !== 'ObjectExpression')
					return;

				const annotation = node.typeAnnotation;
				const isAsConst
					= annotation.type === 'TSTypeReference'
						&& annotation.typeName.type === 'Identifier'
						&& annotation.typeName.name === 'const';
				if (isAsConst)
					return;

				context.report({
					node,
					messageId: 'literalCast',
					data: { type: sourceCode.getText(annotation) },
				});
			},
		};
	},
};
