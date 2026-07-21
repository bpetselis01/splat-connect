import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests need the localhost-guard setup in
    // vitest.integration.config.ts — never run them via the default config,
    // or they'd aim DB-mutating tests at whatever SUPABASE_URL is exported.
    exclude: [...configDefaults.exclude, 'tests/integration/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/supabase/**', 'src/routes/public.ts'],
    },
  },
})
