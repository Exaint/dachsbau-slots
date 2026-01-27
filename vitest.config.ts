import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const cfWorkersMock = fileURLToPath(new URL('./tests/mocks/cloudflare-workers.ts', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    alias: {
      'cloudflare:workers': cfWorkersMock
    }
  }
});
