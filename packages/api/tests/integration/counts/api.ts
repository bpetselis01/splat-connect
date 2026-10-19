import { expect } from 'vitest'
import app from '../../../src/app.js'
import type { TestUser } from '../../helpers/auth.js'

/** One request through the real app as a seat; the path is under /api. */
export const call = (who: TestUser, method: string, path: string, body?: unknown) =>
  app.request(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

/** A write that must succeed: returns the parsed body so a failed arrangement fails here, not three lines later. */
export async function ok<T = { id: string }>(who: TestUser, method: string, path: string, body?: unknown): Promise<T> {
  const res = await call(who, method, path, body)
  expect(res.status, `${method} ${path}`).toBeLessThan(300)
  return (res.status === 204 ? null : await res.json()) as T
}

export const TOY_PATCH = { photo_urls: ['https://example.com/c.jpg'], offer_type: 'donation' }

/** A published toy the owner can be asked for. */
export async function publishedToy(owner: TestUser, name: string): Promise<string> {
  const toy = await ok(owner, 'POST', '/toys', { name, condition: 7 })
  await ok(owner, 'PATCH', `/toys/${toy.id}`, TOY_PATCH)
  await ok(owner, 'PATCH', `/toys/${toy.id}/publish`)
  return toy.id
}
