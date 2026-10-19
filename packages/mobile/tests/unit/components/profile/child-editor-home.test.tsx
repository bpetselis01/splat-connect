// packages/mobile/tests/unit/components/profile/child-editor-home.test.tsx
import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'
import { ChildEditorHome } from '../../../../components/profile/child-editor-home'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    post: jest.fn(),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const mockPush = jest.fn()
const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  Stack: { Screen: () => null },
}))

const child = (over: object = {}) => ({
  id: 'cp1',
  parent_id: 'u1',
  age: 5,
  macs_level: null,
  macs_source: 'manual',
  hand_involvement: null,
  assist_hand: null,
  bfmf_score: null,
  bfmf_source: 'manual',
  challenges: [],
  challenge_other: null,
  grip_type: null,
  env_context: null,
  palm_width_mm: null,
  enjoys: [],
  reach_cm: null,
  tray_mm: null,
  wrist_circ_mm: null,
  needs_arm_attachment: false,
  forearm_length_mm: null,
  hand_dominance: null,
  sensory_preferences: [],
  helps_with: [],
  access: [],
  one_hand: false,
  press_force: null,
  everyday_needs: [],
  created_at: '',
  updated_at: '',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([child()])
})

describe('ChildEditorHome', () => {
  it('asks the board questions on one page, and none of the retired ones', async () => {
    render(<ChildEditorHome childId="cp1" />)
    expect(await screen.findByText('Helps with')).toBeTruthy()
    for (const q of ['How the child uses it', 'Press force', 'Play', 'Good to know', 'Measurements']) {
      expect(screen.getByText(q)).toBeTruthy()
    }
    expect(screen.getByText(/never shown to another person/)).toBeTruthy()
    expect(screen.getByText('privacy policy')).toBeTruthy()
    expect(screen.getByText(/not a medical/)).toBeTruthy()
    expect(screen.queryByText(/MACS|BFMF|Grip|Palm width|Customi[sz]ation/)).toBeNull()
  })

  it('shows the stored answers as selected', async () => {
    mockGet.mockResolvedValue([child({ helps_with: ['seeing'], one_hand: true, everyday_needs: ['wipeable'] })])
    render(<ChildEditorHome childId="cp1" />)
    expect(await screen.findByRole('button', { name: 'Seeing', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hearing', selected: false })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'One hand is enough', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Wipeable', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quiet toys only', selected: false })).toBeTruthy()
  })

  it('Z07 saves a Helps with chip and the one-hand chip against this child', async () => {
    mockPatch.mockResolvedValue({})
    jest.useFakeTimers()
    try {
      render(<ChildEditorHome childId="cp1" />)
      fireEvent.press(await screen.findByRole('button', { name: 'Seeing' }))
      fireEvent.press(screen.getByRole('button', { name: 'One hand is enough' }))
      await waitFor(() => {})
      jest.advanceTimersByTime(300)
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { helps_with: ['seeing'], one_hand: true })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z07 saves only the field a chip changed, against this child', async () => {
    mockPatch.mockResolvedValue({})
    jest.useFakeTimers()
    try {
      render(<ChildEditorHome childId="cp1" />)
      fireEvent.press(await screen.findByRole('button', { name: 'Moderate' }))
      fireEvent.press(screen.getByRole('button', { name: 'Quiet toys only' }))
      await waitFor(() => {})
      jest.advanceTimersByTime(300)
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', {
          press_force: 'moderate',
          everyday_needs: ['quiet'],
        })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z08 confirms before deleting, then deletes and goes back', async () => {
    mockDelete.mockResolvedValue(null)
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.()
    })
    render(<ChildEditorHome childId="cp1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Delete profile' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/child-profiles/cp1'))
    expect(mockBack).toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('Z08 deletes nothing when the confirm is dismissed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<ChildEditorHome childId="cp1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Delete profile' }))
    expect(mockDelete).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  // 120: Play and the three measurements are editable here (the wizard no longer asks for measurements).
  it('shows what the child enjoys and their measurements as stored', async () => {
    mockGet.mockResolvedValue([child({ enjoys: ['water'], palm_width_mm: 62, reach_cm: 30, tray_mm: 15 })])
    render(<ChildEditorHome childId="cp1" />)
    expect(await screen.findByRole('button', { name: 'Bubbles and water', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lights', selected: false })).toBeTruthy()
    expect(screen.getByDisplayValue('62')).toBeTruthy()
    expect(screen.getByDisplayValue('30')).toBeTruthy()
    expect(screen.getByDisplayValue('15')).toBeTruthy()
  })

  it('Z07 saves a Play chip against this child', async () => {
    mockPatch.mockResolvedValue({})
    jest.useFakeTimers()
    try {
      render(<ChildEditorHome childId="cp1" />)
      fireEvent.press(await screen.findByRole('button', { name: 'Lights' }))
      fireEvent.press(screen.getByRole('button', { name: 'Calm and sensory' }))
      await waitFor(() => {})
      jest.advanceTimersByTime(300)
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { enjoys: ['light', 'calm'] })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z07 saves a measurement in range, clears a blank one, and says the range of one that is not', async () => {
    mockGet.mockResolvedValue([child({ tray_mm: 15 })])
    mockPatch.mockResolvedValue({})
    jest.useFakeTimers()
    try {
      render(<ChildEditorHome childId="cp1" />)
      fireEvent.changeText(await screen.findByPlaceholderText('e.g. 62'), '62')
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 30'), '400')
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 15'), '')
      expect(screen.getByText('Between 5 and 150.')).toBeTruthy()
      await waitFor(() => {})
      jest.advanceTimersByTime(300)
      // The reach is out of range, so it is not saved; the stored tray is cleared.
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith('/api/child-profiles/cp1', { palm_width_mm: 62, tray_mm: null })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('says so for an id that no longer exists', async () => {
    mockGet.mockResolvedValue([])
    render(<ChildEditorHome childId="gone" />)
    expect(await screen.findByText("Couldn't find this profile.")).toBeTruthy()
  })
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends its scroll one gutter above the home indicator, under Delete profile', async () => {
  render(<ChildEditorHome childId="cp1" />)
  await screen.findByText('Helps with')
  expect(scrollPaddings(screen)).toEqual([CLEARANCE])
})
