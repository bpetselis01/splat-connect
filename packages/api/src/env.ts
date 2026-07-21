/**
 * Loads environment files for the running server.
 * Kept separate from app construction so tests can import the app
 * WITHOUT loading .env.local (which points at the cloud project).
 */
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../../.env.local') }) // shared PORT / API_PORT
config({ path: path.resolve(__dirname, '../.env.local') }) // Supabase secrets
