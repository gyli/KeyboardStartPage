import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 20_000,
  workers: 2,
  reporter: 'list',
});
