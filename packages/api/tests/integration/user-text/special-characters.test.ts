import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'

/**
 * Every user-typed string the API stores must come back exactly as sent, or be
 * refused with a sentence a person can act on. Never a 500, never a raw
 * Postgres message.
 */
const STRINGS: Record<string, string> = {
  apostrophe: "O'Brien's toy",
  quotes: 'Say "hi"',
  backslash: 'C:\\toys\\new',
  percent: '100% fun',
  ampersand: 'Tom & Jerry',
  plus: 'a+b=c',
  angle: '<script>alert(1)</script>',
  unicode: 'Zoë Ångström 李雷',
  emoji: 'Sam 🧸🦄',
  rtl: 'سارة',
  'leading/trailing spaces': '  Pat  ',
}
const LONG = 'x'.repeat(5000)
const BLANK = '   '

const authed = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

async function send(token: string, method: string, path: string, body: unknown) {
  const res = await app.request(path, authed(token, method, body))
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null }
}

/** A refusal a person can read: 400 with a sentence, not a database error. */
function expectReadableRefusal(r: { status: number; json: Record<string, unknown> | null }) {
  expect(r.status).toBe(400)
  expect(typeof r.json?.error).toBe('string')
  expect(r.json?.error).not.toMatch(/violates|constraint|syntax|relation|column|null value/i)
}

let user: TestUser
let tutorialId: string

beforeAll(async () => {
  user = await createTestUser('contributor')
  const admin = adminClient()
  await admin.from('user_agreements').insert({ user_id: user.id, agreement_type: 'contributor_terms', version: AGREEMENT_VERSIONS.contributor_terms })
  tutorialId = crypto.randomUUID()
  const made = await send(user.token, 'POST', '/api/tutorials', { id: tutorialId, title: 'Notes host', difficulty: 'easy' })
  expect(made.status).toBe(201)
  await admin.from('tutorials').update({ status: 'approved' }).eq('id', tutorialId)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('toys').delete().eq('owner_id', user.id)
  await admin.from('tutorials').delete().like('title', 'matrix:%')
  await admin.from('user_agreements').delete().eq('user_id', user.id)
  await deleteTestUser(user.id)
})

describe.each(Object.entries(STRINGS))('%s', (_label, value) => {
  it('profile name, bio and occupation round-trip', async () => {
    const r = await send(user.token, 'PATCH', '/api/contributors/me', { name: value, bio: value, occupation: value })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ name: value, bio: value, occupation: value.trim() })
  })

  it('a toy name round-trips', async () => {
    const r = await send(user.token, 'POST', '/api/toys', { name: value, description: value, condition: 7 })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ name: value, description: value })
  })

  it('a guide title round-trips', async () => {
    const title = `matrix:${value}`
    const r = await send(user.token, 'POST', '/api/tutorials', { id: crypto.randomUUID(), title, difficulty: 'easy' })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ title })
  })

  it('a community note round-trips', async () => {
    const r = await send(user.token, 'POST', `/api/tutorials/${tutorialId}/notes`, { body: value })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ body: value.trim() })
  })
})

describe('very long text', () => {
  it('profile', async () => {
    for (const field of ['name', 'bio', 'occupation']) {
      const r = await send(user.token, 'PATCH', '/api/contributors/me', { [field]: LONG })
      if (r.status !== 200) expectReadableRefusal(r)
    }
  })
  it('toy', async () => {
    const r = await send(user.token, 'POST', '/api/toys', { name: LONG, condition: 7 })
    if (r.status !== 200) expectReadableRefusal(r)
  })
  it('guide title', async () => {
    const r = await send(user.token, 'POST', '/api/tutorials', { id: crypto.randomUUID(), title: `matrix:${LONG}`, difficulty: 'easy' })
    if (r.status !== 201) expectReadableRefusal(r)
  })
  it('note', async () => {
    const r = await send(user.token, 'POST', `/api/tutorials/${tutorialId}/notes`, { body: LONG })
    if (r.status !== 201) expectReadableRefusal(r)
  })
})

describe('whitespace-only text', () => {
  it('profile name', async () => {
    const r = await send(user.token, 'PATCH', '/api/contributors/me', { name: BLANK })
    expectReadableRefusal(r)
  })
  it('toy name', async () => {
    const r = await send(user.token, 'POST', '/api/toys', { name: BLANK, condition: 7 })
    expectReadableRefusal(r)
  })
  it('guide title', async () => {
    const r = await send(user.token, 'POST', '/api/tutorials', { id: crypto.randomUUID(), title: BLANK, difficulty: 'easy' })
    expectReadableRefusal(r)
  })
  it('note', async () => {
    const r = await send(user.token, 'POST', `/api/tutorials/${tutorialId}/notes`, { body: BLANK })
    expectReadableRefusal(r)
  })
})
