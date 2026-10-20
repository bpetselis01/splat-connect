/**
 * Follow / Message / Say thanks on an organisation's page (077), and the
 * editor's list rules (076). The thanks form's byline starts as a first name
 * only, a leader never sees the buttons, and a cost line with no reason is not
 * saved.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { OrgRelationship } from '@splat-connect/types'

const push = vi.fn()
const search = vi.hoisted(() => ({ current: '' }))
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => '/organizations/o1/public',
  useSearchParams: () => new URLSearchParams(search.current),
}))

const post = vi.fn()
const del = vi.fn()
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    post: (...args: unknown[]) => post(...args),
    delete: (...args: unknown[]) => del(...args),
  },
}))
vi.mock('@/components/toast', () => ({ useToast: () => vi.fn() }))

// jsdom has no <dialog> methods.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.removeAttribute('open')
}

const { OrgActions } = await import('@/components/org-actions')
const { readLists } = await import('@/components/org-profile-parts')
const { askingBackCents, doorLink } = await import('@/lib/org-profile')
const { firstName } = await import('@splat-connect/types')

const me = (over: Partial<OrgRelationship> = {}): OrgRelationship => ({
  leads: false,
  following: false,
  thanks: null,
  conversation_id: null,
  ...over,
})

beforeEach(() => {
  push.mockReset()
  post.mockReset().mockResolvedValue({ thanks_count: 1 })
  del.mockReset().mockResolvedValue({ following: false })
})

describe('OrgActions', () => {
  it('WN10 shows a leader the editor instead of the three buttons', () => {
    render(<OrgActions orgId="o1" orgName="Northbank" me={me({ leads: true })} firstName="Rachel" />)
    expect(screen.getByRole('link', { name: /edit your page/i })).toHaveAttribute('href', '/dashboard/organisation/profile')
    expect(screen.queryByRole('button', { name: /follow/i })).not.toBeInTheDocument()
  })

  it('WN07 sends a signed-out visitor to sign up to follow', () => {
    render(<OrgActions orgId="o1" orgName="Northbank" me={null} firstName="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    expect(push).toHaveBeenCalledWith('/signup?next=%2Forganizations%2Fo1%2Fpublic&reason=follow')
    expect(post).not.toHaveBeenCalled()
  })

  it('WN08 keeps the query string when a visitor signs up from a filtered page', () => {
    search.current = 'tab=toys'
    render(<OrgActions orgId="o1" orgName="Northbank" me={null} firstName="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    expect(push).toHaveBeenCalledWith('/signup?next=%2Forganizations%2Fo1%2Fpublic%3Ftab%3Dtoys&reason=follow')
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute(
      'href',
      '/signup?next=%2Forganizations%2Fo1%2Fpublic%3Ftab%3Dtoys&reason=message'
    )
    search.current = ''
  })

  it('WN08 opens the message page for a member and sign-up with the message reason for a visitor', () => {
    const { unmount } = render(<OrgActions orgId="o1" orgName="Northbank" me={me()} firstName="Priya" />)
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', '/organizations/o1/message')
    unmount()
    render(<OrgActions orgId="o1" orgName="Northbank" me={null} firstName="" />)
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute(
      'href',
      '/signup?next=%2Forganizations%2Fo1%2Fpublic&reason=message'
    )
  })

  it('WN09 sends a signed-out visitor to sign up to say thanks, without opening the form', () => {
    render(<OrgActions orgId="o1" orgName="Northbank" me={null} firstName="" />)
    fireEvent.click(screen.getByRole('button', { name: 'Say thanks' }))
    expect(push).toHaveBeenCalledWith('/signup?next=%2Forganizations%2Fo1%2Fpublic&reason=thanks')
    expect(screen.queryByLabelText(/sign it as/i)).toBeNull()
  })

  it('WN07 puts the button back when the follow does not go through', async () => {
    post.mockRejectedValue(new Error('nope'))
    render(<OrgActions orgId="o1" orgName="Northbank" me={me()} firstName="Priya" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('WN07 follows and unfollows', async () => {
    render(<OrgActions orgId="o1" orgName="Northbank" me={me()} firstName="Priya" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument())
    expect(post).toHaveBeenCalledWith('/api/organizations/o1/follow', {})
    fireEvent.click(screen.getByRole('button', { name: 'Following' }))
    await waitFor(() => expect(del).toHaveBeenCalledWith('/api/organizations/o1/follow'))
  })

  it('WN09 prefills the byline with a first name and sends the thanks once', async () => {
    render(<OrgActions orgId="o1" orgName="Northbank" me={me()} firstName="Priya" />)
    fireEvent.click(screen.getByRole('button', { name: 'Say thanks' }))
    expect(screen.getByLabelText(/sign it as/i)).toHaveValue('Priya')
    fireEvent.change(screen.getByPlaceholderText(/what they did/i), { target: { value: 'The clinic helped.' } })
    fireEvent.click(screen.getByRole('button', { name: /send thanks/i }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/organizations/o1/thanks', {
        note: 'The clinic helped.',
        byline: 'Priya',
        show_note: true,
      })
    )
    await waitFor(() => expect(screen.getByRole('button', { name: 'Thanked' })).toBeDisabled())
  })

  it('WN09 opens an already-thanked org with the button spent', () => {
    render(
      <OrgActions
        orgId="o1"
        orgName="Northbank"
        me={me({ thanks: { note: null, byline: null, show_note: false, created_at: '' } })}
        firstName="Priya"
      />
    )
    expect(screen.getByRole('button', { name: 'Thanked' })).toBeDisabled()
  })
})

describe('the profile helpers', () => {
  it('takes only a first name for a byline', () => {
    expect(firstName('Priya Nair')).toBe('Priya')
    expect(firstName(undefined)).toBe('')
  })

  it('adds up only the lines a family pays back', () => {
    expect(askingBackCents([{ amount_cents: 200, claiming: true }, { amount_cents: 800, claiming: false }])).toBe(200)
  })

  it('sends a message door to the message page and the shelf door down the page', () => {
    expect(doorLink('message', 'o1').href).toBe('/organizations/o1/message')
    expect(doorLink('toy_library', 'o1').href).toBe('#org-toys')
  })
})

describe('readLists', () => {
  const door = (title: string, body = '') => ({ key: title || 'k', title, body, target: 'print' as const })
  const line = (description: string, amount: string, claiming = true) => ({ key: description, description, amount, claiming })

  it('drops blank rows and converts dollars to cents', () => {
    const out = readLists([door('Print a part'), door('')], [line('PLA', '2.50'), line('', '')], 'At cost.')
    expect(out).toEqual({
      doors: [{ title: 'Print a part', body: '', target: 'print' }],
      lines: [{ description: 'PLA', amount_cents: 250, claiming: true }],
    })
  })

  it('refuses a door with a line but no title', () => {
    expect(readLists([door('', 'Just a line')], [], '')).toEqual({ error: 'Every door needs a title.' })
  })

  it('requires a reason once there is a cost line', () => {
    expect(readLists([], [line('PLA', '2')], ' ')).toEqual({ error: 'Say why these costs, in a sentence or two.' })
    expect(readLists([], [], '')).toEqual({ doors: [], lines: [] })
  })

  it('refuses an amount that is not dollars', () => {
    expect(readLists([], [line('PLA', 'two')], 'x')).toEqual({ error: '"PLA" needs an amount in dollars.' })
  })
})
