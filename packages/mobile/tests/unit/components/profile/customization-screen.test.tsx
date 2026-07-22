import { render, screen, fireEvent } from '@testing-library/react-native'
import { CustomizationScreen } from '../../../../components/profile/customization-screen'

let mockProfile: Record<string, unknown> = {}
const mockSave = jest.fn()
jest.mock('../../../../lib/use-child-profile', () => ({
  useChildProfile: () => ({ profile: mockProfile, loading: false, save: mockSave }),
}))

describe('CustomizationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockProfile = {}
  })

  it('saves a numeric palm width', () => {
    render(<CustomizationScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Palm width'), '62')
    expect(mockSave).toHaveBeenCalledWith({ palm_width_mm: 62 })
  })

  it('does not save a non-numeric palm width', () => {
    render(<CustomizationScreen />)
    fireEvent.changeText(screen.getByPlaceholderText('Palm width'), 'abc')
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('reveals forearm length only when arm attachment is on', () => {
    const { rerender } = render(<CustomizationScreen />)
    expect(screen.queryByPlaceholderText('Forearm length')).toBeNull()
    mockProfile = { needs_arm_attachment: true }
    rerender(<CustomizationScreen />)
    expect(screen.queryByPlaceholderText('Forearm length')).toBeTruthy()
  })

  it('toggles the arm-attachment flag', () => {
    render(<CustomizationScreen />)
    fireEvent(screen.getByTestId('arm-attachment-switch'), 'valueChange', true)
    expect(mockSave).toHaveBeenCalledWith({ needs_arm_attachment: true })
  })
})
