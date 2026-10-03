// Which provider is switched on (env-gated), and what each native sheet's
// answers become: a token, a cancel, or a failure in words.
const mockSignInAsync = jest.fn()
const mockIsAvailable = jest.fn()
jest.mock(
  'expo-apple-authentication',
  () => ({
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
    isAvailableAsync: () => mockIsAvailable(),
    signInAsync: (...a: unknown[]) => mockSignInAsync(...a),
  }),
  { virtual: true }
)

const mockConfigure = jest.fn()
const mockHasPlayServices = jest.fn()
const mockGoogleSignIn = jest.fn()
jest.mock(
  '@react-native-google-signin/google-signin',
  () => ({
    GoogleSignin: {
      configure: (...a: unknown[]) => mockConfigure(...a),
      hasPlayServices: () => mockHasPlayServices(),
      signIn: () => mockGoogleSignIn(),
    },
    isSuccessResponse: (r: { type?: string }) => r?.type === 'success',
    isErrorWithCode: (e: { code?: string }) => typeof e?.code === 'string',
    statusCodes: { IN_PROGRESS: 'IN_PROGRESS' },
  }),
  { virtual: true }
)

let mockOS = 'ios'
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOS } } }))

const ENV = ['EXPO_PUBLIC_APPLE_SIGN_IN', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID'] as const
function load(env: Partial<Record<(typeof ENV)[number], string>> = {}): typeof import('../../../lib/social-auth') {
  for (const k of ENV) delete process.env[k]
  Object.assign(process.env, env)
  let mod!: typeof import('../../../lib/social-auth')
  jest.isolateModules(() => {
    mod = require('../../../lib/social-auth')
  })
  return mod
}

beforeEach(() => {
  jest.clearAllMocks()
  mockOS = 'ios'
  mockIsAvailable.mockResolvedValue(true)
  mockHasPlayServices.mockResolvedValue(true)
})
afterAll(() => ENV.forEach((k) => delete process.env[k]))

describe('which providers are on', () => {
  it('Apple is off by default, even on iOS with the SDK able', async () => {
    expect(await load().appleAvailable()).toBe(false)
    expect(mockIsAvailable).not.toHaveBeenCalled()
  })

  it.each(['0', '', 'true', 'yes'])('Apple stays off for EXPO_PUBLIC_APPLE_SIGN_IN=%j', async (value) => {
    expect(await load({ EXPO_PUBLIC_APPLE_SIGN_IN: value }).appleAvailable()).toBe(false)
  })

  it('Apple is on only for the exact value 1, on iOS, when the device allows it', async () => {
    expect(await load({ EXPO_PUBLIC_APPLE_SIGN_IN: '1' }).appleAvailable()).toBe(true)
    mockIsAvailable.mockResolvedValue(false)
    expect(await load({ EXPO_PUBLIC_APPLE_SIGN_IN: '1' }).appleAvailable()).toBe(false)
  })

  it('Apple is never on for Android, whatever the env says', async () => {
    mockOS = 'android'
    expect(await load({ EXPO_PUBLIC_APPLE_SIGN_IN: '1' }).appleAvailable()).toBe(false)
  })

  it('Google is off with no client id', () => {
    expect(load().googleAvailable()).toBe(false)
  })

  it('Google on Android needs only the web client id', () => {
    mockOS = 'android'
    expect(load({ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web' }).googleAvailable()).toBe(true)
  })

  it('Google on iOS needs the iOS client id as well', () => {
    expect(load({ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web' }).googleAvailable()).toBe(false)
    expect(load({ EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web', EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios' }).googleAvailable()).toBe(true)
  })

  it('an iOS client id alone does not switch Google on', () => {
    expect(load({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios' }).googleAvailable()).toBe(false)
  })
})

describe('appleCredential', () => {
  it('returns the token, the code and the name joined from its parts', async () => {
    mockSignInAsync.mockResolvedValue({
      identityToken: 'jwt',
      authorizationCode: 'code',
      fullName: { givenName: 'Sam', familyName: 'Mitchell' },
    })
    expect(await load().appleCredential()).toEqual({ ok: { idToken: 'jwt', fullName: 'Sam Mitchell', authorizationCode: 'code' } })
  })

  it.each([
    [{ givenName: 'Sam', familyName: null }, 'Sam'],
    [{ givenName: null, familyName: 'Mitchell' }, 'Mitchell'],
    [{ givenName: '', familyName: '' }, null],
    [null, null],
  ])('the name %j becomes %j', async (fullName, expected) => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'jwt', authorizationCode: null, fullName })
    const res = await load().appleCredential()
    expect('ok' in res && res.ok.fullName).toBe(expected)
  })

  it('a credential with no identity token is a failure, not a sign-in', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: null, fullName: null })
    expect(await load().appleCredential()).toEqual({ failed: 'Apple returned no identity token.' })
  })

  it('closing the sheet is a cancel, not a failure', async () => {
    mockSignInAsync.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }))
    expect(await load().appleCredential()).toEqual({ cancelled: true })
  })

  it('any other error is a failure carrying its message', async () => {
    mockSignInAsync.mockRejectedValue(new Error('Authorization failed'))
    expect(await load().appleCredential()).toEqual({ failed: 'Authorization failed' })
  })
})

describe('googleIdToken', () => {
  const on = { EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: 'web', EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'ios' }

  it('configures Google once with the client ids, then returns the id token', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'g-jwt' } })
    const mod = load(on)
    expect(await mod.googleIdToken()).toEqual({ ok: 'g-jwt' })
    await mod.googleIdToken()
    expect(mockConfigure).toHaveBeenCalledTimes(1)
    expect(mockConfigure).toHaveBeenCalledWith({ webClientId: 'web', iosClientId: 'ios' })
  })

  it('a response that is not a success is a cancel', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'cancelled', data: null })
    expect(await load(on).googleIdToken()).toEqual({ cancelled: true })
  })

  it('a success with no id token is a failure', async () => {
    mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: null } })
    expect(await load(on).googleIdToken()).toEqual({ failed: 'Google returned no identity token.' })
  })

  it('a second tap while Google is already signing in is a cancel, not an error sentence', async () => {
    mockGoogleSignIn.mockRejectedValue({ code: 'IN_PROGRESS', message: 'in progress' })
    expect(await load(on).googleIdToken()).toEqual({ cancelled: true })
  })

  it('missing Play services is a failure with the SDK\'s message', async () => {
    mockHasPlayServices.mockRejectedValue(new Error('Play services not available'))
    expect(await load(on).googleIdToken()).toEqual({ failed: 'Play services not available' })
  })
})
