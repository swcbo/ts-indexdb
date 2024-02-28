import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		reporters: ['default', 'html'],
		browser: {
			name: 'chrome',
			headless: true,
			enabled: true,
		},
		coverage: {
			enabled: true,
			provider: 'istanbul',
		},
	},
});
