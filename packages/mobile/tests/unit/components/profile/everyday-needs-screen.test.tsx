import { render, screen, fireEvent } from '@testing-library/react-native'
import { EverydayNeedsScreen } from '../../../../components/profile/everyday-needs-screen'

let mockProfile: Record<string, unknown> = { challenges: [] }
const mockSave = jest.fn()
jest.mock('../../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: mockProfile, loading: false, save: mockSave }),
}))

describe('EverydayNeedsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProfile = { challenges: [] }
  })

  it('adds a challenge chip', () => {
    render(<EverydayNeedsScreen />)
    fireEvent.press(screen.getByText('Grasping'))
    expect(mockSave).toHaveBeenCalledWith({ challenges: ['Grasping'] })
  })

  it('prevents selecting a 4th challenge (max 3)', () => {
    mockProfile = { challenges: ['Grasping', 'Holding', 'Fine motor'] }
    render(<EverydayNeedsScreen />)
    fireEvent.press(screen.getByText('Coordination'))
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('reveals the free-text field only when Other is selected', () => {
    const { rerender } = render(<EverydayNeedsScreen />)
    expect(screen.queryByPlaceholderText('Describe the other challenge')).toBeNull()
    mockProfile = { challenges: ['Other'] }
    rerender(<EverydayNeedsScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Describe the other challenge'), 'Buttoning')
    expect(mockSave).toHaveBeenCalledWith({ challenge_other: 'Buttoning' })
  })

  it('saves the grip type', () => {
    render(<EverydayNeedsScreen />)
    fireEvent.press(screen.getByText('Pincer'))
    expect(mockSave).toHaveBeenCalledWith({ grip_type: 'Pincer' })
  })
})
