import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ChildWizard } from '../../../../components/profile/child-wizard'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
  },
}))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }))

const HEADINGS = [
  'Who are we finding toys for?',
  'Which hand does most of the work?',
  'How much force can they apply?',
  'Can they aim at a target?',
  'How long can they hold a press?',
  'What matters in the room?',
  'What does your child enjoy?',
  'Any measurements? (optional)',
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
  mockPost.mockResolvedValue({ id: 'new' })
})

describe('ChildWizard', () => {
  it('walks every step on Skip, saves nothing, and finishes on the guides', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      for (const h of HEADINGS) {
        expect(await screen.findByText(h)).toBeTruthy()
        fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      }
      expect(mockReplace).toHaveBeenCalledWith('/guides')
      await act(async () => { jest.advanceTimersByTime(500) })
      expect(mockPost).not.toHaveBeenCalled()
      expect(mockPatch).not.toHaveBeenCalled()
      expect(screen.queryByText(/MACS|BFMF/)).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('saves only what a step answered on Continue', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      fireEvent.changeText(await screen.findByPlaceholderText('e.g. Sam'), ' Sam ')
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      expect(await screen.findByText('Which hand does most of the work?')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Either' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      // An unanswered step on Continue is a skip.
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      expect(screen.getByText('Can they aim at a target?')).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(500) })
      // The hook batches the two answers into the one create.
      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { name: 'Sam', working_hand: 'either' })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('saves what the child enjoys from the Play step', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      await screen.findByText(HEADINGS[0])
      for (let i = 0; i < 6; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByText('What does your child enjoy?')).toBeTruthy()
      // Kept as the board draws it; nothing sorts by it (Byron 2026-10-02).
      expect(screen.getByText('We will put those toys first.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Lights' }))
      fireEvent.press(screen.getByRole('button', { name: 'Bubbles and water' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      expect(screen.getByText('Any measurements? (optional)')).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(500) })
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { enjoys: ['light', 'water'] }))
    } finally {
      jest.useRealTimers()
    }
  })

  it('saves the measurements in range and says the range of one that is not', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      await screen.findByText(HEADINGS[0])
      for (let i = 0; i < 7; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByText('Only for printed grips and mounts.')).toBeTruthy()
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 62'), '62')
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 30'), '400')
      expect(screen.getByText('Between 5 and 150.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Finish' }))
      await act(async () => { jest.advanceTimersByTime(500) })
      // The reach is out of range, so it is not an answer — only the hand width saves.
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { palm_width_mm: 62 }))
    } finally {
      jest.useRealTimers()
    }
  })
})
