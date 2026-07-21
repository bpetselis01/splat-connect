/**
 * Integration test setup: force the local Supabase env and refuse to run
 * against anything else. This is the safety boundary that keeps these
 * DB-mutating tests off the cloud project.
 */
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.test'), override: true })

const url = process.env.SUPABASE_URL ?? ''
if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
  throw new Error(
    `Integration tests require a LOCAL Supabase (got SUPABASE_URL=${url}). ` +
      'Run `supabase start` and check packages/api/.env.test.'
  )
}
