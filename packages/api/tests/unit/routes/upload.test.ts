import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockUpload = vi.fn(() => ({ data: { path: 'test/tutorial.pdf' }, error: null }))
const mockGetPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://example.com/test/tutorial.pdf' } }))
const mockStorageBucket = { upload: mockUpload, getPublicUrl: mockGetPublicUrl }
const mockStorage = { from: vi.fn(() => mockStorageBucket) }

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ storage: mockStorage }),
}))

const { default: upload } = await import('../../../src/routes/upload.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', upload)
  return app
}

describe('POST /pdf', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('uploads file and returns public URL', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://example.com/test/tutorial.pdf')
  })
})
