import { defineConfig } from 'vitest/config';

export default defineConfig({
 test: {
    browser: {
            name: 'chrome',
        headless: true,
        enabled: true
    }
  }
})