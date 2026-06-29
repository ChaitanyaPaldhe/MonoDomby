// =============================================================================
// apps/server/vitest.config.ts
// Vitest configuration for the server package.
//
// Resolves @monopoly/shared to its TypeScript source so tests don't
// require a compiled build of the shared package.
// =============================================================================

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      // Point to the shared package's TypeScript source directly.
      // Vitest uses Vite's esbuild transform so .ts → .js transpilation
      // is handled without a separate compilation step.
      '@monopoly/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@monopoly/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@monopoly/maps': resolve(__dirname, '../../packages/maps/src/index.ts'),
      '@monopoly/protocol': resolve(__dirname, '../../packages/protocol/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Suppress the "Cannot use import statement" error for node:* builtins
    // in vitest's browser-like sandboxing — not needed here since we target node.
    globals: false,
    reporters: ['verbose'],
  },
});
