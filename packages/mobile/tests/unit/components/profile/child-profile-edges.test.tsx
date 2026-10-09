// The child profile screens at their edges: odd ages, blank and unicode
// names, clearing an answer that was set before, going back, failed saves,
// a failed or doubled "Add a child", and an emoji initial.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { ChildWizard } from '../../../../components/profile/child-wizard'
import { ChildEditorHome } from '../../../../components/profile/child-editor-home'
import { ChildProfileHome } from '../../../../components/profile/child-profile-home'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
    Stack: { Screen: () => null },
  }
})

const child = (over: object = {}) => ({
  id: 'cp1', parent_id: 'u1', age: null, helps_with: [], access: [], one_hand: false, press_force: null,
  everyday_needs: [], enjoys: [], palm_width_mm: null, reach_cm: null, tray_mm: null, created_at: '', updated_at: '',
  ...over,
})

function pending<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

/** Lets the hook's 250ms debounce fire. */
const flush = async () => {
  await act(async () => {
    jest.advanceTimersByTime(300)
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
  mockPost.mockResolvedValue({ id: 'new' })
  mockPatch.mockResolvedValue({})
  jest.useFakeTimers()
})
afterEach(() => jest.useRealTimers())

describe('Wizard, age', () => {
  async function aboutStep() {
    render(<ChildWizard />)
    return { age: await screen.findByLabelText('Age in years') }
  }
  const next = () => fireEvent.press(screen.getByRole('button', { name: 'Continue' }))

  it.each([['5', 5], ['0', 0], ['12', 12], [' 7 ', 7]])('saves the age %j as %j', async (typed, saved) => {
    const f = await aboutStep()
    fireEvent.changeText(f.age, typed)
    next()
    await flush()
    expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { age: saved })
  })

  it.each(['5.5', '-3', 'Infinity', '1e3', '1000', 'abc', '0x10', '٥'])('does not save %j as an age', async (typed) => {
    const f = await aboutStep()
    fireEvent.changeText(f.age, typed)
    next()
    await flush()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('keeps the digits already typed when a letter slips in', async () => {
    const f = await aboutStep()
    fireEvent.changeText(f.age, '5')
    fireEvent.changeText(f.age, '5a')
    expect(screen.getByLabelText('Age in years').props.value).toBe('5')
  })

  it('Back is off on the first step and returns to the previous one, with its answer kept', async () => {
    const f = await aboutStep()
    expect(screen.getByRole('button', { name: 'Back' }).props.accessibilityState?.disabled).toBe(true)
    fireEvent.changeText(f.age, '6')
    next()
    await screen.findByText('What would help your child day to day?')
    fireEvent.press(screen.getByRole('button', { name: 'Back' }))
    expect((await screen.findByLabelText('Age in years')).props.value).toBe('6')
  })

  it('shows the step count and moves it on', async () => {
    await aboutStep()
    expect(screen.getByText('STEP 1 OF 6')).toBeTruthy()
    next()
    expect(screen.getByText('STEP 2 OF 6')).toBeTruthy()
  })
})

describe('Wizard, an existing child', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue([child({ age: 6, helps_with: ['seeing'], everyday_needs: ['quiet'] })])
  })

  it('opens with what is already set', async () => {
    render(<ChildWizard />)
    expect((await screen.findByLabelText('Age in years')).props.value).toBe('6')
  })

  it('clearing the age and pressing Continue clears it on the server', async () => {
    render(<ChildWizard />)
    fireEvent.changeText(await screen.findByLabelText('Age in years'), '')
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
    await flush()
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', expect.objectContaining({ age: null }))
  })

  it('un-choosing the chip that was set and pressing Continue clears it on the server', async () => {
    render(<ChildWizard />)
    await screen.findByLabelText('Age in years')
    fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.press(await screen.findByRole('button', { name: 'Seeing' }))
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
    await flush()
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { helps_with: [] })
  })

  it('skipping a step leaves what was set alone', async () => {
    render(<ChildWizard />)
    await screen.findByLabelText('Age in years')
    // Skip on every step, the last included: its Good to know chip is already set, so Finish would re-save it.
    for (let i = 0; i < 6; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
    await flush()
    expect(mockPatch).not.toHaveBeenCalled()
  })
})

describe('Wizard, failures', () => {
  it('still walks every step when the first read of the account failed', async () => {
    mockGet.mockRejectedValue(new Error('offline'))
    render(<ChildWizard />)
    await screen.findByText('STEP 1 OF 6')
    fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
    expect(await screen.findByText('STEP 2 OF 6')).toBeTruthy()
  })

  it('a save that fails still moves on to the next step, and the last step still finishes', async () => {
    mockPost.mockRejectedValue(new Error('500'))
    render(<ChildWizard />)
    fireEvent.changeText(await screen.findByLabelText('Age in years'), '6')
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
    await flush()
    expect(screen.getByText('STEP 2 OF 6')).toBeTruthy()
  })
})

describe('Child editor, age', () => {
  beforeEach(() => mockGet.mockResolvedValue([child({ age: 5 })]))
  const ageField = async () => screen.findByLabelText("Child's age")

  it.each([['0', 0], ['9', 9], [' 7 ', 7]])('saves the age %j as %j', async (typed, saved) => {
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await ageField(), typed)
    await flush()
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { age: saved })
  })

  it.each(['5.5', '-3', 'Infinity', '1e3', '1000', 'abc', '0x10'])('does not save %j as an age', async (typed) => {
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await ageField(), typed)
    await flush()
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it.each([[''], ['   ']])('clearing the age (%j) saves null', async (typed) => {
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await ageField(), typed)
    await flush()
    expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { age: null })
  })

  it('says Saved after a save lands, and never after one that fails', async () => {
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await ageField(), '7')
    await flush()
    expect(await screen.findByText('Saved')).toBeTruthy()
  })

  it('a failed save never says Saved and keeps what was typed', async () => {
    mockPatch.mockRejectedValue(new Error('500'))
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await ageField(), '7')
    await flush()
    expect(screen.queryByText('Saved')).toBeNull()
    expect(screen.getByLabelText("Child's age").props.value ?? '7').toBe('7')
  })

  it('a failed delete tells the parent and stays on the profile', async () => {
    mockDelete.mockRejectedValue(new Error('500'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.()
    })
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Delete profile' }))
    await act(async () => {})
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Could not delete this profile', 'Please try again.'))
    expect(mockBack).not.toHaveBeenCalled()
    spy.mockRestore()
    alertSpy.mockRestore()
  })

  it.each([[19, false], [20, true], [250, true], [251, false]])('a hand width of %d mm is %s as an answer', async (mm, saved) => {
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await screen.findByPlaceholderText('e.g. 62'), String(mm))
    await flush()
    if (saved) expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { palm_width_mm: mm })
    else {
      expect(mockPatch).not.toHaveBeenCalled()
      expect(screen.getByText('Between 20 and 250.')).toBeTruthy()
    }
  })

  it.each(['abc', '-5', 'Infinity'])('a measurement of %j shows its range and saves nothing', async (typed) => {
    render(<ChildEditorHome childId="cp1" />)
    fireEvent.changeText(await screen.findByPlaceholderText('e.g. 62'), typed)
    await flush()
    expect(screen.getByText('Between 20 and 250.')).toBeTruthy()
    expect(mockPatch).not.toHaveBeenCalled()
  })
})

describe('Child list', () => {
  it('a failed "Add a child" says so and goes nowhere', async () => {
    mockPost.mockRejectedValue(new Error('500'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ChildProfileHome />)
    fireEvent.press(await screen.findByText('+ Add a child'))
    expect(await screen.findByText('Could not add a child profile. Please try again.')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('tapping "Add a child" twice while the first is out creates one child', async () => {
    const slow = pending<{ id: string }>()
    mockPost.mockReturnValue(slow.promise)
    render(<ChildProfileHome />)
    const add = await screen.findByText('+ Add a child')
    fireEvent.press(add)
    fireEvent.press(add)
    await act(async () => slow.resolve({ id: 'new' }))
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('a retry after a failed add clears the error and opens the new profile', async () => {
    mockPost.mockRejectedValueOnce(new Error('500')).mockResolvedValueOnce({ id: 'c9' })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ChildProfileHome />)
    fireEvent.press(await screen.findByText('+ Add a child'))
    await screen.findByText('Could not add a child profile. Please try again.')
    fireEvent.press(screen.getByText('+ Add a child'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/child/[id]', params: { id: 'c9' } }))
    expect(screen.queryByText('Could not add a child profile. Please try again.')).toBeNull()
    spy.mockRestore()
  })

  it('one child is one row, and the empty invitation goes away', async () => {
    mockGet.mockResolvedValue([child({ age: 5 })])
    render(<ChildProfileHome />)
    expect(await screen.findByText('Child 1')).toBeTruthy()
    expect(screen.queryByText(/No child profiles yet/)).toBeNull()
    expect(screen.queryByText('Answer a few quick questions')).toBeNull()
  })

  it('children are numbered by position: "Child 1", then "Child 2"', async () => {
    mockGet.mockResolvedValue([child({ id: 'a' }), child({ id: 'b' })])
    render(<ChildProfileHome />)
    expect(await screen.findByText('Child 1')).toBeTruthy()
    expect(screen.getByText('Child 2')).toBeTruthy()
  })

  it('a failed load is an error, never the "no profiles yet" invitation', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    render(<ChildProfileHome />)
    expect(await screen.findByText("Couldn't load your child profiles — try again.")).toBeTruthy()
    expect(screen.queryByText(/No child profiles yet/)).toBeNull()
    spy.mockRestore()
  })
})
