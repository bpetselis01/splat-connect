import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
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
  'What would help your child day to day?',
  'How does your child start or control things?',
  'How hard can your child press?',
  'What does your child enjoy?',
  'Good to know',
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
  mockPost.mockResolvedValue({ id: 'new' })
})

describe('ChildWizard', () => {
  it('Z09 walks every step on Skip, saves nothing, and finishes on the guides', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      for (const h of HEADINGS) {
        expect(await screen.findByText(h)).toBeTruthy()
        fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      }
      // Finish (or Skip on the last step) opens the done screen, not Guides.
      expect(mockReplace).not.toHaveBeenCalled()
      expect(await screen.findByText("Your child's profile is ready")).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'See the matches' }))
      // Nothing matched (every list is empty), so Guides opens unfiltered.
      expect(mockReplace).toHaveBeenCalledWith('/guides')
      await act(async () => { jest.advanceTimersByTime(500) })
      expect(mockPost).not.toHaveBeenCalled()
      expect(mockPatch).not.toHaveBeenCalled()
      expect(screen.queryByText(/MACS|BFMF/)).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z09 saves only what a step answered on Continue', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      fireEvent.changeText(await screen.findByLabelText('Age in years'), '6')
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      expect(await screen.findByText('What would help your child day to day?')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Seeing' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      // An unanswered step on Continue is a skip.
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      expect(screen.getByText('How hard can your child press?')).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(500) })
      // The hook batches the two answers into the one create.
      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { age: 6, helps_with: ['seeing'] })
      )
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z09 saves how the child starts things, with one hand as its own chip', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      await screen.findByText(HEADINGS[0])
      for (let i = 0; i < 2; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByText(HEADINGS[2])).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Eyes' }))
      fireEvent.press(screen.getByRole('button', { name: 'One hand is enough for your child' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      await act(async () => { jest.advanceTimersByTime(500) })
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { access: ['eyes'], one_hand: true }))
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z09 saves what the child enjoys, and Good to know is the last step', async () => {
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      await screen.findByText(HEADINGS[0])
      for (let i = 0; i < 4; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' }))
      expect(screen.getByText('What does your child enjoy?')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Lights' }))
      fireEvent.press(screen.getByRole('button', { name: 'Bubbles and water' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      // Measurements are in the editor now, not the wizard.
      expect(screen.getByText('Good to know')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy()
      await act(async () => { jest.advanceTimersByTime(500) })
      await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', { enjoys: ['light', 'water'] }))
    } finally {
      jest.useRealTimers()
    }
  })

  it('Z09 ends on the board\'s done screen with the matches, and opens Guides', async () => {
    mockGet.mockImplementation((path: string) =>
      path === '/api/public/tutorials'
        ? Promise.resolve([
            { id: 'g1', helps_with: ['seeing'] },
            { id: 'g2', helps_with: ['hearing'] },
          ])
        : path === '/api/public/toys'
          ? Promise.resolve([
              { id: 'y1', helps_with: ['seeing'], status: 'published', paused_at: null },
              { id: 'y2', helps_with: ['hearing'], status: 'published', paused_at: null },
            ])
          : Promise.resolve([])
    )
    jest.useFakeTimers()
    try {
      render(<ChildWizard />)
      fireEvent.changeText(await screen.findByLabelText('Age in years'), '6')
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      fireEvent.press(screen.getByRole('button', { name: 'Seeing' }))
      fireEvent.press(screen.getByRole('button', { name: 'Continue' }))
      for (let i = 0; i < 4; i++) fireEvent.press(screen.getByRole('button', { name: 'Skip' })) // access, force, enjoys, good to know
      expect(await screen.findByText("Your child's profile is ready")).toBeTruthy()
      expect(await screen.findByText('We found 1 guide and 1 toy that suit your child.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'See the matches' }))
      expect(mockReplace).toHaveBeenCalledWith('/guides')
      await act(async () => { jest.advanceTimersByTime(500) })
    } finally {
      jest.useRealTimers()
    }
  })
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

it('ends its scroll one gutter above the home indicator, under Back / Skip / Continue', async () => {
  render(<ChildWizard />)
  await screen.findByText(HEADINGS[0])
  expect(scrollPaddings(screen)).toEqual([CLEARANCE])
})
