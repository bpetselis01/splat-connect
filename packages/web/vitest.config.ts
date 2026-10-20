import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    // The admin and leader pages take over 5 s to import cold on a loaded machine or a CI runner.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'lib/**/*.tsx', 'components/**/*.tsx'],
      exclude: ['lib/supabase/**'],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
