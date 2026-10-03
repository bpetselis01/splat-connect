// The contributor-terms gate's transaction (name, tick, accept, failures,
// repeat taps) and the signed-in layouts' redirects: signed out, still
// loading, terms not accepted, session expiring while a screen is open.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import TermsGate from '../../../app/terms'
import OnboardingLayout from '../../../app/(onboarding)/_layout'
import MyLayout from '../../../app/(my)/_layout'
import TabsLayout from '../../../app/(tabs)/_layout'
import PrintingLayout from '../../../app/printing/_layout'

const mockRedirect = jest.fn()
jest.mock('expo-router', () => {
  const Stack = Object.assign(() => 'stack', { Screen: () => null })
  const Tabs = Object.assign(() => 'tabs', { Screen: () => null })
  return {
    Tabs,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href)
      return null
    },
    Stack,
  }
})
jest.mock('../../../lib/social-auth', () => ({
  appleAvailable: () => Promise.resolve(false),
  googleAvailable: () => false,
  AppleButton: () => null,
}))

const mockAuth = {
  loading: false,
  session: { user: { id: 'u1' } } as object | null,
  profile: { name: '' } as { name: string } | null,
  hasContributorTerms: false as boolean | null,
  pendingName: null as string | null,
  setProfileName: jest.fn(),
  acceptContributorTerms: jest.fn(),
  signOut: jest.fn(),
}
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => mockAuth }))

jest.mock('../../../lib/supabase', () => ({ supabase: { auth: {} } }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: null }) }))

const ok = { problem: null }
function pending<T>() {
  let resolve!: (v: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuth.loading = false
  mockAuth.session = { user: { id: 'u1' } }
  mockAuth.profile = { name: '' }
  mockAuth.hasContributorTerms = false
  mockAuth.pendingName = null
  mockAuth.setProfileName.mockResolvedValue(ok)
  mockAuth.acceptContributorTerms.mockResolvedValue({ error: null })
})

const tick = () => fireEvent.press(screen.getByTestId('accept-contributor-terms'))
const accept = () => fireEvent.press(screen.getByTestId('accept-terms'))

describe('Terms gate transaction', () => {
  it('Accept does nothing until the box is ticked, and nothing again once it is cleared', () => {
    mockAuth.profile = { name: 'Sam' }
    render(<TermsGate />)
    accept()
    expect(mockAuth.acceptContributorTerms).not.toHaveBeenCalled()
    tick()
    tick()
    accept()
    expect(mockAuth.acceptContributorTerms).not.toHaveBeenCalled()
  })

  it.each([['empty', ''], ['whitespace only', '   \t']])('a %s name is refused before anything is sent', (_l, name) => {
    render(<TermsGate />)
    fireEvent.changeText(screen.getByLabelText('Your name'), name)
    tick()
    accept()
    expect(screen.getByText('Add your name so people know who made your guides.')).toBeTruthy()
    expect(mockAuth.setProfileName).not.toHaveBeenCalled()
    expect(mockAuth.acceptContributorTerms).not.toHaveBeenCalled()
  })

  it.each([
    ['  Pat  ', 'Pat'],
    ["O'Brien", "O'Brien"],
    ['<b>Pat</b> & "co"', '<b>Pat</b> & "co"'],
    ['Zoë 🧸 سارة', 'Zoë 🧸 سارة'],
    ['N'.repeat(500), 'N'.repeat(500)],
  ])('saves the name %j as %j, then accepts', async (typed, saved) => {
    render(<TermsGate />)
    fireEvent.changeText(screen.getByLabelText('Your name'), typed)
    tick()
    accept()
    await waitFor(() => expect(mockAuth.acceptContributorTerms).toHaveBeenCalledTimes(1))
    expect(mockAuth.setProfileName).toHaveBeenCalledWith(saved)
  })

  it('a name that will not save stops the acceptance and says why', async () => {
    mockAuth.setProfileName.mockResolvedValue({ problem: { kind: 'other', message: 'Could not save your name. Please try again.' } })
    render(<TermsGate />)
    fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam')
    tick()
    accept()
    expect(await screen.findByText('Could not save your name. Please try again.')).toBeTruthy()
    expect(mockAuth.acceptContributorTerms).not.toHaveBeenCalled()
  })

  it('an acceptance the server does not record shows the error and leaves the gate up', async () => {
    mockAuth.profile = { name: 'Sam' }
    mockAuth.acceptContributorTerms.mockResolvedValue({ error: 'Could not record your acceptance. Please try again.' })
    render(<TermsGate />)
    tick()
    accept()
    expect(await screen.findByText('Could not record your acceptance. Please try again.')).toBeTruthy()
    expect(screen.getByTestId('accept-terms')).toBeTruthy()
  })

  it('after a failed acceptance, accepting again goes through and the error clears', async () => {
    mockAuth.profile = { name: 'Sam' }
    mockAuth.acceptContributorTerms
      .mockResolvedValueOnce({ error: 'Could not record your acceptance. Please try again.' })
      .mockResolvedValueOnce({ error: null })
    render(<TermsGate />)
    tick()
    accept()
    await screen.findByText('Could not record your acceptance. Please try again.')
    accept()
    await waitFor(() => expect(mockAuth.acceptContributorTerms).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText('Could not record your acceptance. Please try again.')).toBeNull())
  })

  it('tapping Accept twice while the request is out records one acceptance', async () => {
    mockAuth.profile = { name: 'Sam' }
    const slow = pending<{ error: null }>()
    mockAuth.acceptContributorTerms.mockReturnValue(slow.promise)
    render(<TermsGate />)
    tick()
    accept()
    accept()
    await act(async () => slow.resolve({ error: null }))
    expect(mockAuth.acceptContributorTerms).toHaveBeenCalledTimes(1)
  })

  it('a name already on the profile is not asked for or re-saved', async () => {
    mockAuth.profile = { name: 'Sam' }
    render(<TermsGate />)
    tick()
    accept()
    await waitFor(() => expect(mockAuth.acceptContributorTerms).toHaveBeenCalled())
    expect(mockAuth.setProfileName).not.toHaveBeenCalled()
  })

  it('lists every term, and Sign out is the only way out', () => {
    render(<TermsGate />)
    for (const heading of ['You wrote it, or you have permission', 'You keep the copyright', 'Review is not approval of safety', 'No claims about outcomes', 'Withdrawal']) {
      expect(screen.getByText(heading)).toBeTruthy()
    }
    fireEvent.press(screen.getByText('Sign out'))
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1)
  })

  it('shows no back button, since every other route sends this account here', () => {
    render(<TermsGate />)
    expect(screen.queryByLabelText('Back')).toBeNull()
  })
})

describe('Terms gate redirects', () => {
  it('renders nothing while the session loads', () => {
    mockAuth.loading = true
    render(<TermsGate />)
    expect(screen.queryByTestId('accept-terms')).toBeNull()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('sends a signed-out visitor to Welcome', () => {
    mockAuth.session = null
    render(<TermsGate />)
    expect(mockRedirect).toHaveBeenCalledWith('/welcome')
  })

  it('an account whose acceptance is not known yet still sees the gate rather than being bounced', () => {
    mockAuth.hasContributorTerms = null
    render(<TermsGate />)
    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.getByTestId('accept-terms')).toBeTruthy()
  })

  it('the session expiring while the gate is open sends the visitor to Welcome', () => {
    const { rerender } = render(<TermsGate />)
    expect(mockRedirect).not.toHaveBeenCalled()
    mockAuth.session = null
    rerender(<TermsGate />)
    expect(mockRedirect).toHaveBeenCalledWith('/welcome')
  })

  it('an acceptance landing while the gate is open sends the account on to Home', () => {
    const { rerender } = render(<TermsGate />)
    mockAuth.hasContributorTerms = true
    rerender(<TermsGate />)
    expect(mockRedirect).toHaveBeenCalledWith('/home')
  })
})

describe('Onboarding layout guard', () => {
  it('renders nothing while the session loads', () => {
    mockAuth.loading = true
    render(<OnboardingLayout />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('sends a signed-out deep link to Welcome', () => {
    mockAuth.session = null
    render(<OnboardingLayout />)
    expect(mockRedirect).toHaveBeenCalledWith('/welcome')
  })

  it('sends an account that has not accepted the terms to the gate', () => {
    render(<OnboardingLayout />)
    expect(mockRedirect).toHaveBeenCalledWith('/terms')
  })

  it('lets an accepted account through', () => {
    mockAuth.hasContributorTerms = true
    render(<OnboardingLayout />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('lets an account with an unknown acceptance through rather than flashing the gate', () => {
    mockAuth.hasContributorTerms = null
    render(<OnboardingLayout />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

// Every signed-in root group is its own deep link, so each runs the same gate.
describe.each([
  ['(onboarding)', OnboardingLayout],
  ['(my)', MyLayout],
  ['(tabs)', TabsLayout],
  ['printing', PrintingLayout],
])('the %s layout', (_name, Layout) => {
  it('sends a session that just expired to Welcome', () => {
    const { rerender } = render(<Layout />)
    expect(mockRedirect).not.toHaveBeenCalledWith('/welcome')
    mockAuth.session = null
    rerender(<Layout />)
    expect(mockRedirect).toHaveBeenCalledWith('/welcome')
  })

  it('sends an account that has not accepted the terms to the gate, not to Welcome', () => {
    render(<Layout />)
    expect(mockRedirect).toHaveBeenCalledWith('/terms')
    expect(mockRedirect).not.toHaveBeenCalledWith('/welcome')
  })

  it('lets an accepted account in', () => {
    mockAuth.hasContributorTerms = true
    render(<Layout />)
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
