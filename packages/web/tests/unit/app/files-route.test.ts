// @vitest-environment node
// packages/web/tests/unit/app/files-route.test.ts
// node, not jsdom: the handler returns a NextResponse, and jsdom's Response
// is not the one next/server builds on.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/files/[bucket]/[...path]/route'

const getUser = vi.fn()
const createSignedUrl = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser },
    storage: { from: () => ({ createSignedUrl }) },
  }),
}))

function call(bucket: string, path: string[]) {
  return GET(new Request(`http://web.test/files/${bucket}/${path.join('/')}`), {
    params: Promise.resolve({ bucket, path }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://supabase.test/signed' }, error: null })
})

describe('GET /files/[bucket]/[...path]', () => {
  it('refuses any bucket but the two gated ones', async () => {
    const res = await call('toy-photos', ['t1', 'photo.jpg'])
    expect(res.status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  // A bare object lookup resolves inherited keys like '__proto__' to a
  // truthy value and would skip the 404 short-circuit above.
  it('refuses an inherited-property bucket name like __proto__', async () => {
    const res = await call('__proto__', ['t1', 'photo.jpg'])
    expect(res.status).toBe(404)
    expect(getUser).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  // Every object lives under its tutorial's folder (032) — a single segment
  // has no tutorial id to redirect back to, so it 404s before touching auth.
  it('refuses a single-segment path with no tutorial folder', async () => {
    const res = await call('tutorial-pdfs', ['loose.pdf'])
    expect(res.status).toBe(404)
    expect(getUser).not.toHaveBeenCalled()
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  // The detour carries the tutorial, which is the first path segment by the
  // folder layout 032 enforces — the visitor comes back to the page they left.
  it('sends a signed-out visitor to sign up, pointed back at the tutorial', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('tutorial-pdfs', ['t1', 'tutorial.pdf'])
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'http://web.test/signup?next=%2Ftutorials%2Ft1&reason=download'
    )
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  // Same detour for the other gated bucket: the branch runs before the
  // per-bucket download option is chosen, and this pins that it stays so.
  it('sends a signed-out visitor to sign up from an STL too', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('stl-files', ['t1', 'bracket.stl'])
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'http://web.test/signup?next=%2Ftutorials%2Ft1&reason=download'
    )
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('redirects a signed-in user to a 60-second signed URL for a PDF, opened inline', async () => {
    const res = await call('tutorial-pdfs', ['t1', 'tutorial.pdf'])
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://supabase.test/signed')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(createSignedUrl).toHaveBeenCalledWith('t1/tutorial.pdf', 60, undefined)
  })

  // A browser would try to render an STL as text; the download option makes
  // Storage answer with Content-Disposition: attachment and the real name.
  it('forces a download with the original filename for an STL', async () => {
    const res = await call('stl-files', ['t1', 'bracket.stl'])
    expect(res.status).toBe(302)
    expect(createSignedUrl).toHaveBeenCalledWith('t1/bracket.stl', 60, { download: 'bracket.stl' })
  })

  it('404s when storage cannot sign the object', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
    const res = await call('tutorial-pdfs', ['t1', 'tutorial.pdf'])
    expect(res.status).toBe(404)
  })
})
