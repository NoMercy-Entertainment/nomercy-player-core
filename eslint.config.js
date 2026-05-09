import antfu from '@antfu/eslint-config';

export default antfu({
	ignores: [
		'dist/**',
		'README.md',
		// Linting `eslint.config.js` itself triggers a full config-cache rebuild
		// on save (~70s on Windows with antfu's plugin set). Run `npx eslint
		// eslint.config.js` manually when editing this file.
		'eslint.config.js',
	],
	typescript: {
		overrides: {
			'antfu/top-level-function': 'off',
			'no-async-promise-executor': 'off',
			'no-extend-native': 'off',
			'ts/no-unsafe-function-type': 'off',
			'ts/method-signature-style': 'off',
			'unused-imports/no-unused-vars': 'error',
		},
	},
	test: {
		overrides: {
			'test/prefer-lowercase-title': 'off',
		},
	},
	stylistic: {
		indent: 'tab',
		quotes: 'single',
		semi: true,
		overrides: {
			// One chained method call per line when the chain has 3+ links.
			// Examples:
			//   fine:    foo.bar().baz()        (depth 2)
			//   error:   foo.bar().baz().qux()  (depth 3+ → must break)
			'style/newline-per-chained-call': [
				'error',
				{ ignoreChainWithDepth: 2 },
			],

			// Force multi-line when an object literal has 2+ properties OR is
			// already multi-line. Single-prop objects can stay inline.
			'style/object-curly-newline': [
				'error',
				{
					ObjectExpression: {
						multiline: true,
						minProperties: 2,
						consistent: true,
					},
					ObjectPattern: {
						multiline: true,
						minProperties: 4,
						consistent: true,
					},
					ImportDeclaration: {
						multiline: true,
						minProperties: 4,
						consistent: true,
					},
					ExportDeclaration: {
						multiline: true,
						minProperties: 4,
						consistent: true,
					},
				},
			],

			// Object literal: one property per line when the literal is multi-line.
			'style/object-property-newline': [
				'error',
				{ allowAllPropertiesOnSameLine: true },
			],

			// Function call args: break consistently — all on one line OR each on
			// its own line. No half-and-half.
			'style/function-paren-newline': ['error', 'multiline-arguments'],

			// Array elements: same rule — consistent formatting across the array.
			'style/array-element-newline': ['error', 'consistent'],
			'style/array-bracket-newline': ['error', 'consistent'],
		},
	},
}, {
	files: ['src/__tests__/**/*.ts'],
	rules: {
		// Tests routinely use deep one-liners for assertions; relax the
		// chained-call rule to keep them readable.
		'style/newline-per-chained-call': 'off',
		// Tests use small inline objects pervasively; allow them on one line.
		'style/object-curly-newline': 'off',
	},
});
