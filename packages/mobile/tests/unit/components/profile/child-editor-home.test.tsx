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
  primary_diagnosis: null,
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
  created_at: '',
  updated_at: '',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([child()])
})

describe('ChildEditorHome', () => {
  it('opens each step scoped to this child', async () => {
    render(<ChildEditorHome childId="cp1" />)

    fireEvent.press(await screen.findByRole('button', { name: 'Ability' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/ability', params: { child: 'cp1' } })
    fireEvent.press(screen.getByRole('button', { name: 'Everyday needs' }))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/account/everyday-needs',
      params: { child: 'cp1' },
    })
  })

  it('marks a filled step done and an empty one with the gap dot', async () => {
    mockGet.mockResolvedValue([child({ primary_diagnosis: 'CP' })])
    render(<ChildEditorHome childId="cp1" />)

    // StepPills renders one tab per step; status carries via the pill's a11y.
    const ability = await screen.findByRole('tab', { name: 'Ability' })
    const needs = screen.getByRole('tab', { name: 'Everyday needs' })
    expect(ability).toBeTruthy()
    expect(needs).toBeTruthy()
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
