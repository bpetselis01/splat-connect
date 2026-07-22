import { render, screen, fireEvent } from '@testing-library/react-native'
import { ChildProfileHome } from '../../../../components/profile/child-profile-home'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ profile: { name: 'Pat', email: 'p@b.com', role: 'parent' }, signOut: jest.fn() }) }))
const mockSave = jest.fn()
jest.mock('../../../../lib/use-child-profile', () => ({ useChildProfile: () => ({ profile: { age: 6 }, loading: false, save: mockSave }) }))

describe('ChildProfileHome', () => {
  beforeEach(() => jest.clearAllMocks())
  it('shows account info and links to the three sub-screens', () => {
    render(<ChildProfileHome />)
    expect(screen.getByText('Pat')).toBeTruthy()
    expect(screen.getByText('p@b.com')).toBeTruthy()
    expect(screen.getByText('Ability Profile')).toBeTruthy()
    expect(screen.getByText('Everyday Needs')).toBeTruthy()
    expect(screen.getByText('Customization Metrics')).toBeTruthy()
    fireEvent.press(screen.getByText('Ability Profile'))
    expect(mockPush).toHaveBeenCalledWith('/profile/ability')
  })
  it('saves the age field on change', () => {
    render(<ChildProfileHome />)
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '8')
    expect(mockSave).toHaveBeenCalledWith({ age: 8 })
  })
})
