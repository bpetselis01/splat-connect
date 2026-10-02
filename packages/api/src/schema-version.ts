/**
 * Which migration the code expects versus which one the database has. The two
 * drift apart whenever a route lands before its `supabase db push`, and the
 * only symptom used to be a 500 per route. /health carries both; boot logs
 * them when they differ.
 */
import { readdirSync } from 'node:fs'
import { createAdminClient } from './supabase/client.js'

export type SchemaStatus = { code: string | null; db: string | null; behind: boolean }

/** The highest NNN_ prefix in supabase/migrations, resolved from the API package's cwd as the dev and start scripts run it. Null when the repo is not beside the build. */
export function codeSchemaVersion(dir = '../../supabase/migrations'): string | null {
  try {
    return readdirSync(dir).map((f) => f.match(/^(\d{3})_/)?.[1]).filter((v): v is string => !!v).sort().at(-1) ?? null
  } catch {
    return null
  }
}

export async function schemaStatus(): Promise<SchemaStatus> {
  const code = codeSchemaVersion()
  const { data, error } = await createAdminClient().rpc('schema_version')
  const db = error ? null : ((data as string | null) ?? null)
  return { code, db, behind: code !== null && db !== code }
}

export function describeSchema({ code, db, behind }: SchemaStatus): string | null {
  if (!behind) return null
  const where = db === null ? 'could not read the database schema version (125 not applied?)' : `database is at migration ${db}`
  return `${where}; this code expects ${code}. Run supabase db push (hosted) or supabase migration up --local.`
}
