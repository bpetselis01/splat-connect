// Asserts a database row exists, for flows whose point is a write the screen
// only hints at. Reads through local Supabase's REST API with the well-known,
// non-secret dev service key (same value as scripts/provision-device-parent.mjs).
// Inputs, from runScript env: TABLE, QUERY (a PostgREST filter, e.g.
// "tutorial_id=eq.<uuid>&body=like.*oil*"). Throws when no row matches.
const key =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const res = http.get('http://localhost:54321/rest/v1/' + TABLE + '?select=id&' + QUERY, {
  headers: { apikey: key, Authorization: 'Bearer ' + key },
})
const rows = json(res.body)
if (!Array.isArray(rows) || rows.length < 1) {
  throw new Error('No ' + TABLE + ' row matches ' + QUERY + ' (got ' + res.body + ')')
}
