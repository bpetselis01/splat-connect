import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChildProfileHome } from '../../../../components/profile/child-profile-home'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockSave = jest.fn()
jest.mock('../../../../lib/use-child-profile', () => ({ useChildProfile: () => ({ profile: { age: 6 }, loading: false, save: mockSave }) }))

describe('ChildProfileHome', () => {
  beforeEach(() => jest.clearAllMocks())
  it('links to three sub-screens', () => {
    render(<ChildProfileHome />)
    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.getByText('Everyday Needs')).toBeTruthy()
    expect(screen.getByText('Customization Metrics')).toBeTruthy()
    fireEvent.press(screen.getByText('Ability Profile'))
    expect(mockPush).toHaveBeenCalledWith('/account/ability')
  })
  it('saves the age field on change', () => {
    render(<ChildProfileHome />)
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '8')
    expect(mockSave).toHaveBeenCalledWith({ age: 8 })
  })

  it('does not save a non-numeric age', () => {
    render(<ChildProfileHome />)
    fireEvent.changeText(screen.getByPlaceholderText('Age'), 'abc')
    expect(mockSave).not.toHaveBeenCalled()
  })

  it('does not save when the age is cleared', () => {
    render(<ChildProfileHome />)
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '')
    expect(mockSave).not.toHaveBeenCalled()
  })
})
