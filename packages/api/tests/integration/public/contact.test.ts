/**
 * POST /api/public/contact — the contact form's queue. No account needed; the
 * row lands in contact_messages for the admin inbox; nothing else is written.
 */
import { describe, it, expect, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient } from '../../helpers/auth.js'

const EMAIL = `contact-${Date.now()}@contact.test`
const post = (body: unknown) =>
  app.request('/api/public/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const valid = { topic: 'safety', name: '  Sam  ', email: EMAIL, body: '  Battery pack gets hot.  ' }

afterAll(async () => {
  await adminClient().from('contact_messages').delete().eq('email', EMAIL)
})

describe('POST /api/public/contact', () => {
  it('WS11 stores the trimmed message with its topic for a caller with no account', async () => {
    const res = await post(valid)
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    const { data } = await adminClient().from('contact_messages').select('topic, name, email, body').eq('email', EMAIL)
    expect(data).toEqual([{ topic: 'safety', name: 'Sam', email: EMAIL, body: 'Battery pack gets hot.' }])
  })

  it('WS11 refuses each bad field with its sentence and stores nothing', async () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...valid, topic: 'press' }, 'Pick what it is about.'],
      [{ ...valid, name: '   ' }, 'Tell us who you are.'],
      [{ ...valid, email: 'not-an-email' }, 'That email address does not look right.'],
      [{ ...valid, body: '' }, 'Say what happened, in 4000 characters or fewer.'],
    ]
    for (const [body, error] of cases) {
      const res = await post(body)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error })
    }
    const { count } = await adminClient().from('contact_messages').select('id', { count: 'exact', head: true }).eq('email', EMAIL)
    expect(count).toBe(1)
  })
})
