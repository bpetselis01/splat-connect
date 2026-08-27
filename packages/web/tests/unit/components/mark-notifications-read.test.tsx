import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post } }))

const { MarkNotificationsRead } = await import('@/components/mark-notifications-read')

describe('MarkNotificationsRead', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue(undefined)
  })

  it('clears its bucket on mount', async () => {
    render(<MarkNotificationsRead bucket="tutorials" />)
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/notifications/me/read', { bucket: 'tutorials' })
    )
  })

  it('renders nothing', () => {
    const { container } = render(<MarkNotificationsRead bucket="exchanges" />)
    expect(container).toBeEmptyDOMElement()
  })

  /* React 18+ mounts twice in StrictMode and effects re-run on any remount.
     Marking read is idempotent server-side, but a doubled request on every
     page view is noise worth not making. */
  it('fires once even if the effect runs twice', async () => {
    render(
      <StrictMode>
        <MarkNotificationsRead bucket="tutorials" />
      </StrictMode>
    )
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  })

  /* A failed clear must not surface: the page behind it loaded fine, and an
     unread badge that lingers one more visit is not worth an error. */
  it('swallows a failed clear rather than leaving the rejection unhandled', async () => {
    const caught = vi.fn()
    // A rejected promise that records whether the component attached a handler.
    // Testing the mechanism directly, because jsdom surfaces no unhandled-rejection
    // event for a fire-and-forget call and `not.toThrow()` cannot see an async
    // rejection at all — it would pass with the .catch() deleted.
    const rejection = Promise.reject(new Error('offline'))
    const attach = rejection.catch.bind(rejection)
    rejection.catch = <R,>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null | undefined) => {
      caught()
      return attach(onRejected)
    }
    post.mockReturnValue(rejection)

    render(<MarkNotificationsRead bucket="challenges" />)

    await waitFor(() => expect(caught).toHaveBeenCalled())
  })
})
