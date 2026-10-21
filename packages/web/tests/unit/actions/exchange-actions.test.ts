import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendMessage, accept, reject, withdraw, confirm } from '@/app/dashboard/exchanges/actions'
import type { PickupAddress } from '@splat-connect/types'

const revalidate = vi.hoisted(() => vi.fn())
vi.mock('next/cache', () => ({ revalidatePath: revalidate }))
vi.mock('@/lib/api-client', () => ({ apiClient: { post: vi.fn() } }))
import { apiClient } from '@/lib/api-client'

const ADDRESS: PickupAddress = { pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiClient.post).mockResolvedValue({} as never)
})

describe('thread actions', () => {
  it('posts an accept with the address and revalidates the exchange page', async () => {
    await accept('t1', 'exchange', ADDRESS)
    expect(apiClient.post).toHaveBeenCalledWith('/api/toy-transactions/t1/accept', ADDRESS)
    expect(revalidate).toHaveBeenCalledWith('/dashboard/exchanges/t1')
  })

  it('posts an empty accept body when there is no address (an organisation)', async () => {
    await accept('t1', 'build')
    expect(apiClient.post).toHaveBeenCalledWith('/api/toy-transactions/t1/accept', {})
  })

  it('sends no reason key when a reject has none', async () => {
    await reject('t1', 'build')
    expect(JSON.stringify(vi.mocked(apiClient.post).mock.calls[0][1])).toBe('{}')
    expect(revalidate).toHaveBeenCalledWith('/dashboard/exchanges/build/t1')
  })

  it('sends the reason when a reject has one', async () => {
    await reject('t1', 'print', 'Bed too small')
    expect(apiClient.post).toHaveBeenCalledWith('/api/toy-transactions/t1/reject', { reason: 'Bed too small' })
  })

  it('revalidates the print path for a print withdraw, not the exchanges path', async () => {
    await withdraw('p1', 'print')
    expect(apiClient.post).toHaveBeenCalledWith('/api/toy-transactions/p1/withdraw', {})
    expect(revalidate).toHaveBeenCalledTimes(1)
    expect(revalidate).toHaveBeenCalledWith('/dashboard/print-requests/p1')
  })

  it('posts a message body and a confirm code', async () => {
    await sendMessage('t1', 'exchange', 'Is it free?')
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/toy-transactions/t1/messages', { body: 'Is it free?' })
    await confirm('t1', 'exchange', '482913')
    expect(apiClient.post).toHaveBeenLastCalledWith('/api/toy-transactions/t1/confirm', { code: '482913' })
  })

  it.each([
    ['messages', (): Promise<unknown> => sendMessage('t1', 'exchange', 'Hi'), 'Could not send the message. Please try again.'],
    ['confirm', (): Promise<unknown> => confirm('t1', 'exchange', '482913'), 'Could not confirm. Please try again.'],
    ['withdraw', (): Promise<unknown> => withdraw('t1', 'exchange'), 'Could not withdraw. Please try again.'],
    ['accept', (): Promise<unknown> => accept('t1', 'exchange'), 'Could not accept. Please try again.'],
  ])('returns the API sentence when %s is refused, so production does not mask it', async (_name, run, fallback) => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('API POST /x failed with status 409: This request is no longer open'))
    expect(await run()).toEqual({ ok: false, error: 'This request is no longer open' })
    vi.mocked(apiClient.post).mockRejectedValue(new Error('API error: status 500'))
    expect(await run()).toEqual({ ok: false, error: fallback })
    expect(revalidate).not.toHaveBeenCalled()
  })

  it('returns the API sentence when a decline is refused, so production does not mask it', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('API POST /api/toy-transactions/t1/reject failed with status 409: This request is no longer open'))
    expect(await reject('t1', 'exchange', 'Already given away')).toEqual({ ok: false, error: 'This request is no longer open' })
    expect(revalidate).not.toHaveBeenCalled()
  })

  it('lets a terms redirect through instead of reporting it as a failed decline', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/onboarding/contributor-terms;307;' }))
    await expect(reject('t1', 'exchange', 'Already given away')).rejects.toThrow('NEXT_REDIRECT')
  })

  it('returns ok when a decline goes through', async () => {
    expect(await reject('t1', 'exchange', 'Already given away')).toEqual({ ok: true })
  })
})
