import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    // Network round-trips to local Supabase — default 5s timeouts flake.
    testTimeout: 15000,
    hookTimeout: 30000,
    // ponytail: serial files against one shared DB; parallelise per-file if runtime hurts
    fileParallelism: false,
  },
})
