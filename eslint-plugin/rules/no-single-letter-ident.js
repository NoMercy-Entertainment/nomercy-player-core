// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

/**
 * Disallow single-letter identifiers for parameters and variables. A whitelist
 * covers the two conventional exceptions: `x`/`y`/`z` for maths and `i`/`j`/`k`
 * for loop counters. Type parameters (`<T>`) are never flagged.
 *
 * This rule is report-only by design. Renaming a variable well needs the
 * binding's inferred type and a scope-aware, collision-checked, sibling-aware
 * rename — none of which a per-file eslint autofix can do safely (guessing
 * `q` -> `queue` on a quality level, or renaming both comparator params to the
 * same name, both compile but are wrong). The `rename-single-letters.mjs`
 * codemod does the bulk renames from real type information; this rule keeps the
 * standard enforced so a new single-letter binding fails lint at write time.
 */

const DEFAULT_ALLOW = ['x', 'y', 'z', 'i', 'j', 'k'];

/** @type {import('eslint').Rule.RuleModule} */
export default {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'Disallow single-letter parameter and variable names (except maths x/y/z and loop i/j/k).',
		},
		schema: [
			{
				type: 'object',
				properties: {
					allow: {
						type: 'array',
						items: { type: 'string' },
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			singleLetter: "Single-letter name '{{name}}' — use a descriptive word (allowed only: {{allowed}}).",
		},
	},

	create(context) {
		const allow = new Set(context.options[0]?.allow ?? DEFAULT_ALLOW);
		const allowedText = [...allow].join(', ');
		const sourceCode = context.sourceCode ?? context.getSourceCode();

		function report(identifier) {
			if (identifier && identifier.type === 'Identifier' && identifier.name.length === 1 && !allow.has(identifier.name)) {
				context.report({
					node: identifier,
					messageId: 'singleLetter',
					data: {
						name: identifier.name,
						allowed: allowedText,
					},
				});
			}
		}

		function unwrap(param) {
			if (!param)
				return null;
			switch (param.type) {
				case 'Identifier':
					return param;
				case 'AssignmentPattern':
					return unwrap(param.left);
				case 'RestElement':
					return unwrap(param.argument);
				case 'TSParameterProperty':
					return unwrap(param.parameter);
				default:
					return null;
			}
		}

		function reportSignatureParams(node) {
			for (const param of node.params ?? [])
				report(unwrap(param));
		}

		function reportDeclared(node) {
			for (const variable of sourceCode.getDeclaredVariables(node)) {
				const declaration = variable.identifiers[0];
				if (declaration)
					report(declaration);
			}
		}

		return {
			FunctionDeclaration: reportDeclared,
			FunctionExpression: reportDeclared,
			ArrowFunctionExpression: reportDeclared,
			VariableDeclaration: reportDeclared,
			CatchClause: reportDeclared,
			TSDeclareFunction: reportSignatureParams,
			TSFunctionType: reportSignatureParams,
			TSMethodSignature: reportSignatureParams,
			TSCallSignatureDeclaration: reportSignatureParams,
			TSConstructSignatureDeclaration: reportSignatureParams,
			TSEmptyBodyFunctionExpression: reportSignatureParams,
		};
	},
};
