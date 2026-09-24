// packages/mobile/tests/unit/components/profile/child-editor-home.test.tsx
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
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack }) }))

const child = (over: object = {}) => ({
  id: 'cp1',
  parent_id: 'u1',
  name: 'Maya',
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
  wrist_circ_mm: null,
  needs_arm_attachment: false,
  forearm_length_mm: null,
  hand_dominance: null,
  sensory_preferences: [],
  working_hand: null,
  press_force: null,
  aim: null,
  hold: null,
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
    expect(await screen.findByText('Which hand does most of the work?')).toBeTruthy()
    for (const q of ['How much force can they apply?', 'Can they aim at a target?', 'How long can they hold a press?', 'Everyday needs']) {
      expect(screen.getByText(q)).toBeTruthy()
    }
    expect(screen.getByText(/never shown to another person/)).toBeTruthy()
    expect(screen.getByText('privacy policy')).toBeTruthy()
    expect(screen.getByText(/not a medical/)).toBeTruthy()
    expect(screen.queryByText(/MACS|BFMF|Grip|Palm width|Customi[sz]ation/)).toBeNull()
  })

  it('shows the stored answers as selected', async () => {
    mockGet.mockResolvedValue([child({ working_hand: 'left', everyday_needs: ['wipeable'] })])
    render(<ChildEditorHome childId="cp1" />)
    expect(await screen.findByRole('button', { name: 'Left', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Wipeable', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Quiet toys only', selected: false })).toBeTruthy()
  })

  it('saves only the field a chip changed, against this child', async () => {
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

  it('confirms before deleting, then deletes and goes back', async () => {
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

  it('deletes nothing when the confirm is dismissed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<ChildEditorHome childId="cp1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Delete profile' }))
    expect(mockDelete).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('saves a rename against this child', async () => {
    mockPatch.mockResolvedValue({})
    jest.useFakeTimers()
    try {
      render(<ChildEditorHome childId="cp1" />)
      fireEvent.changeText(await screen.findByLabelText("Child's name"), 'Amara')
      await waitFor(() => {})
      jest.advanceTimersByTime(300)
      await waitFor(() =>
        expect(mockPatch).toHaveBeenCalledWith(
          '/api/child-profiles/cp1',
          expect.objectContaining({ name: 'Amara' })
        )
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
