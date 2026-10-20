import { describe, it, expect, vi, afterEach } from 'vitest'
import { latestCode, latestMail } from '../../../../../supabase/e2e-seed'

function mailbox(messages: { ID: string; Created: string; Text: string }[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      json: async () =>
        url.includes('/message/')
          ? messages.find((m) => url.endsWith(m.ID))
          : { messages: messages.map(({ ID, Created }) => ({ ID, Created })) },
    }))
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('latestCode', () => {
  it('reads the code from the newest email sent after the cutoff', async () => {
    mailbox([
      { ID: 'new', Created: '2026-10-20T10:00:05Z', Text: 'Your SPLAT Connect code: 222222' },
      { ID: 'old', Created: '2026-10-20T10:00:00Z', Text: 'Your SPLAT Connect code: 111111' },
    ])
    expect(await latestCode('a@b.co', Date.parse('2026-10-20T10:00:03Z'))).toBe('222222')
  })

  it('throws a named error when no email arrives after the cutoff', async () => {
    mailbox([{ ID: 'old', Created: '2026-10-20T10:00:00Z', Text: 'code 111111' }])
    await expect(latestMail('a@b.co', Date.parse('2026-10-20T11:00:00Z'), 1)).rejects.toMatchObject({
      name: 'NoMailError',
      message: 'No email reached a@b.co within 250 ms.',
    })
  })

  it('names the port when Mailpit is not answering', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(latestMail('a@b.co', 0, 1)).rejects.toMatchObject({ name: 'MailpitUnreachableError' })
    await expect(latestMail('a@b.co', 0, 1)).rejects.toThrow(/port 54324/)
  })
})
