import { describe, it, expect, vi, afterEach } from 'vitest'
import { sendEmail } from '../../src/mailer.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('sendEmail', () => {
  it('is off, without a request, until the key and sender are set', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const f = vi.spyOn(globalThis, 'fetch')
    expect(await sendEmail('a@b.c', 's', 't')).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('posts to Resend with the configured sender', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test')
    vi.stubEnv('MAIL_FROM', 'SPLAT Connect <hello@splat.example>')
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    expect(await sendEmail('a@b.c', 'Subject', 'Body')).toBe(true)
    const [url, init] = f.mock.calls[0]!
    expect(url).toBe('https://api.resend.com/emails')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      from: 'SPLAT Connect <hello@splat.example>', to: 'a@b.c', subject: 'Subject', text: 'Body',
    })
  })
})
