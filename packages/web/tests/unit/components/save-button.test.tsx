/**
 * The save control, on cards and on detail pages.
 *
 * The assertion that matters most lives in the card tests, not here: a button
 * inside an anchor is invalid HTML, so SaveButton is always rendered as a
 * SIBLING of a card's whole-card link. Here we pin what the button itself does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/library',
}))

const post = vi.fn()
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}))

const showToast = vi.fn()
vi.mock('@/components/toast', () => ({ useToast: () => showToast }))

const { SaveButton } = await import('@/components/save-button')

beforeEach(() => {
  push.mockReset()
  refresh.mockReset()
  post.mockReset().mockResolvedValue(undefined)
  del.mockReset().mockResolvedValue(undefined)
  showToast.mockReset()
})

describe('SaveButton', () => {
  it('sends a signed-out visitor to sign up, carrying where they were and why', async () => {
    render(<SaveButton slug="tutorials" id="abc" saved={false} signedIn={false} />)
    fireEvent.click(screen.getByRole('button'))

    // /signup rather than /login: the auth screens carry a segmented switch, so
    // someone who already has an account crosses over in one click.
    expect(push).toHaveBeenCalledWith('/signup?next=%2Flibrary&reason=save')
    expect(post).not.toHaveBeenCalled()
  })

  it('saves optimistically, before the request resolves', async () => {
    let release: () => void = () => {}
    post.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve
      })
    )
    render(<SaveButton slug="tutorials" id="abc" saved={false} signedIn />)
    fireEvent.click(screen.getByRole('button'))

    // The click is the feedback, not the round trip.
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    release()
  })

  it('posts the singular enum value, not the plural slug', async () => {
    render(<SaveButton slug="challenges" id="abc" saved={false} signedIn />)
    fireEvent.click(screen.getByRole('button'))
    expect(post).toHaveBeenCalledWith('/api/saves', {
      entity_type: 'challenge',
      entity_id: 'abc',
    })
  })

  it('unsaves an already-saved item through the plural slug', async () => {
    render(<SaveButton slug="tutorials" id="abc" saved signedIn />)
    fireEvent.click(screen.getByRole('button'))

    expect(del).toHaveBeenCalledWith('/api/saves/tutorials/abc')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('reverts and explains when the request fails', async () => {
    post.mockRejectedValue(new Error('offline'))
    render(<SaveButton slug="tutorials" id="abc" saved={false} signedIn />)
    fireEvent.click(screen.getByRole('button'))

    // The revert lands after the rejected request settles, unlike the
    // optimistic flip above which is synchronous with the click.
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    })
    expect(showToast).toHaveBeenCalledWith('Could not save that. Try again.')
  })

  it('names what it does rather than relying on the glyph being read', () => {
    render(<SaveButton slug="toys" id="xyz" saved={false} signedIn />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Save')
  })

  it('names the saved state differently, so the toggle is announced', () => {
    render(<SaveButton slug="toys" id="xyz" saved signedIn />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Saved')
  })
})
