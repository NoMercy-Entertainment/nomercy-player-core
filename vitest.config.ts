import { defineConfig } from 'vitest/config';
import { nomercyTranslationsPlugin } from './src/vite-plugin';

export default defineConfig({
	plugins: [nomercyTranslationsPlugin()],
	test: {
		globals: true,
		environment: 'happy-dom',
		include: ['src/**/__tests__/**/*.test.ts'],
	},
});
