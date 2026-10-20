import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    fileParallelism: false, // test files share one database, so run them one at a time
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
