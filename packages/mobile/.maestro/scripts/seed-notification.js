// Seeds one more unread notification for DEVICE_USER_ID, the way the app would
// receive one while open. Copies the subject of the row provision-device-parent
// already seeded (notifications_one_subject wants exactly one subject id).
// Local Supabase only, with the well-known non-secret dev service key.
const key =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const base = 'http://localhost:54321/rest/v1/notifications'
const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }
const seeded = json(http.get(base + '?select=idea_id&limit=1&recipient_id=eq.' + DEVICE_USER_ID, { headers: headers }).body)
if (!Array.isArray(seeded) || seeded.length < 1) throw new Error('No seeded notification for ' + DEVICE_USER_ID)
const res = http.post(base, {
  headers: headers,
  body: JSON.stringify({ recipient_id: DEVICE_USER_ID, type: 'idea_approved', idea_id: seeded[0].idea_id, actor_name: 'Maestro live' }),
})
if (res.status >= 300) throw new Error('Seeding failed: ' + res.status + ' ' + res.body)
