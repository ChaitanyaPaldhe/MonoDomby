// =============================================================================
// packages/engine/vitest.config.ts
// Vitest configuration for the engine package.
// =============================================================================

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      '@monopoly/shared': resolve(__dirname, '../shared/src/index.ts'),
      '@monopoly/maps': resolve(__dirname, '../maps/src/index.ts'),
      '@monopoly/protocol': resolve(__dirname, '../protocol/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    reporters: ['verbose'],
  },
});
