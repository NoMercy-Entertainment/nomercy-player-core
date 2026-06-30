// -----------------------------------------------------------------------------
//  Copyright (c) NoMercy Entertainment
//
//  Licensed under the Apache License, Version 2.0. See LICENSE for details.
//
//  SPDX-License-Identifier: Apache-2.0
// -----------------------------------------------------------------------------

import { defineConfig } from 'vitest/config';
import { nomercyTranslationsPlugin } from './src/vite-plugin';

export default defineConfig({
	plugins: [nomercyTranslationsPlugin()],
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/__tests__/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/__tests__/**',
				'src/**/*.d.ts',
			],
			thresholds: {
				lines: 75,
				functions: 80,
			},
		},
	},
});
