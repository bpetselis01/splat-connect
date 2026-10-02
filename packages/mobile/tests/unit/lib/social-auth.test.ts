// android-one-tap: the silent saved-account getter. The Google module is
// mocked; the real one cannot load until the google-sign-in setup's prebuild.
const mockConfigure = jest.fn()
const mockHasPrevious = jest.fn()
const mockSilently = jest.fn()
const mockSignOut = jest.fn()
jest.mock(
  '@react-native-google-signin/google-signin',
  () => ({
    GoogleSignin: {
      configure: (...a: unknown[]) => mockConfigure(...a),
      hasPreviousSignIn: () => mockHasPrevious(),
      signInSilently: () => mockSilently(),
      signOut: () => mockSignOut(),
    },
  }),
  { virtual: true }
)

let mockOS = 'android'
jest.mock('react-native', () => ({
  Platform: {
    get OS() {
      return mockOS
    },
  },
}))

// The module reads the client ids when it loads, so each test loads it fresh.
function load(): typeof import('../../../lib/social-auth') {
  let mod!: typeof import('../../../lib/social-auth')
  jest.isolateModules(() => {
    mod = require('../../../lib/social-auth')
  })
  return mod
}

beforeEach(() => {
  jest.clearAllMocks()
  mockOS = 'android'
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client'
  mockHasPrevious.mockReturnValue(true)
  mockSilently.mockResolvedValue({ type: 'success', data: { idToken: 'saved-jwt' } })
})

afterAll(() => {
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
})

describe('googleSavedIdToken', () => {
  it('returns the saved account\'s token on Android, without a sheet', async () => {
    expect(await load().googleSavedIdToken()).toBe('saved-jwt')
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web-client', iosClientId: undefined })
  })

  it('asks nothing when this app never signed in with Google here', async () => {
    mockHasPrevious.mockReturnValue(false)
    expect(await load().googleSavedIdToken()).toBeNull()
    expect(mockSilently).not.toHaveBeenCalled()
  })

  it('is null when Google finds no saved credential', async () => {
    mockSilently.mockResolvedValue({ type: 'noSavedCredentialFound', data: null })
    expect(await load().googleSavedIdToken()).toBeNull()
  })

  it('is null, and never throws, when Google fails', async () => {
    mockSilently.mockRejectedValue(new Error('DEVELOPER_ERROR'))
    expect(await load().googleSavedIdToken()).toBeNull()
  })

  it('does nothing off Android, or before Google sign-in is set up', async () => {
    mockOS = 'ios'
    expect(await load().googleSavedIdToken()).toBeNull()
    mockOS = 'android'
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    expect(await load().googleSavedIdToken()).toBeNull()
    expect(mockHasPrevious).not.toHaveBeenCalled()
  })
})

describe('googleSignOut', () => {
  // A fresh launch has not configured Google, yet it still holds the account;
  // skipping the sign-out would let Sign in's silent try sign straight back in.
  it('signs Google out even before anything configured it this launch', async () => {
    await load().googleSignOut()
    expect(mockConfigure).toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('touches nothing before Google sign-in is set up', async () => {
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    await load().googleSignOut()
    expect(mockSignOut).not.toHaveBeenCalled()
  })
})
