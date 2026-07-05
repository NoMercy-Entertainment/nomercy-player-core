import antfu from '@antfu/eslint-config';
import player from '@nomercy-entertainment/eslint-plugin-player';

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
			'no-nested-ternary': 'error',
			'antfu/top-level-function': 'off',
			'no-async-promise-executor': 'off',
			'no-extend-native': 'off',
			'ts/no-unsafe-function-type': 'off',
			'ts/method-signature-style': 'off',
			'unused-imports/no-unused-vars': 'error',
			// Mutual-closure patterns (cleanup ↔ handler const arrows in promise callbacks) are safe
			// at runtime; the rule's variable-TDZ check fires false positives here.
			'ts/no-use-before-define': ['error', { classes: false, functions: false, variables: false }],
			// dot-notation conflicts with TS noPropertyAccessFromIndexSignature: typed index-signature
			// properties must use bracket notation; ESLint's autofix would break the build.
			'dot-notation': 'off',
		},
	},
	test: {
		overrides: {
			'test/prefer-lowercase-title': 'off',
			// Tests use compact `beforeEach(() => { stmt; })` and `try { stmt; } catch (e) { err = e; }` patterns by convention.
			'style/max-statements-per-line': 'off',
			// Setter-only mixin objects in tests are intentional (testing mixin composition).
			'accessor-pairs': 'off',
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
	// antfu/consistent-chaining conflicts with style/newline-per-chained-call
	// (ignoreChainWithDepth: 2): both try to autofix depth-3 inline chains in
	// opposite directions, producing an oscillating fix loop. The explicit
	// style/newline-per-chained-call config is the project rule; this one loses.
	rules: {
		'antfu/consistent-chaining': 'off',
	},
}, {
	// Build scripts run in Node.js — process, __dirname etc. are genuine globals,
	// not src code. Scoping to scripts/** keeps the rule active everywhere else.
	files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
	languageOptions: {
		globals: {
			process: 'readonly',
		},
	},
	rules: {
		'node/prefer-global/process': 'off',
		'no-console': 'off',
	},
}, {
	// Logger is the one place that must call console directly.
	files: ['src/adapters/logger/default.ts'],
	rules: {
		'no-console': 'off',
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
}, {
	// NoMercy player code standard, from the published
	// @nomercy-entertainment/eslint-plugin-player devDependency (same package
	// video and music consume).
	files: ['src/**/*.ts'],
	plugins: { player },
	rules: {
		'player/no-single-letter-ident': 'error',
		'player/no-compat-vocab': 'error',
		'player/no-history-comments': 'error',
		'player/no-object-literal-cast': 'error',
		'player/no-unknown-cast': 'error',
		'player/no-raw-player-bus': 'error',
		'player/no-raw-timers-in-plugin': 'error',
		'player/no-raw-throw-in-plugin': 'error',
		'player/no-raw-fetch-in-plugin': 'error',
		'player/plugin-id-required': 'error',
	},
}, {
	// Mock construction in tests legitimately casts; test-fixture plugins throw
	// raw errors, use raw timers/fetch, and build ad-hoc plugin classes to
	// exercise the real paths — the boundary rules target authored plugins, not fixtures.
	files: ['src/**/*.test.ts', 'src/__tests__/**/*.ts'],
	rules: {
		'player/no-object-literal-cast': 'off',
		'player/no-unknown-cast': 'off',
		'player/no-raw-throw-in-plugin': 'off',
		'player/no-raw-timers-in-plugin': 'off',
		'player/no-raw-player-bus': 'off',
		'player/no-raw-fetch-in-plugin': 'off',
		'player/plugin-id-required': 'off',
	},
});
