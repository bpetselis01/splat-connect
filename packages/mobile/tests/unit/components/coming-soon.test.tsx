import { render, screen } from '@testing-library/react-native'
import { ComingSoon } from '../../../components/coming-soon'

// ComingSoon links back to the tutorial library, so it now pulls in the
// router. Mocked here the same way every other router-using suite does it:
// importing expo-router for real drags in untransformed ESM deps.
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

describe('ComingSoon', () => {
  it('renders the given label', () => {
    render(<ComingSoon label="Toy Scanner" />)
    expect(screen.getByText('Toy Scanner is coming soon.')).toBeTruthy()
  })

  it('explains what the feature will do and how it will work', () => {
    render(
      <ComingSoon
        label="Toy Scanner"
        description="Point your camera at a toy."
        steps={['Scan a toy with your camera']}
      />
    )
    expect(screen.getByText('Point your camera at a toy.')).toBeTruthy()
    expect(screen.getByText('Scan a toy with your camera')).toBeTruthy()
    // The dead end this replaced is the point: always offer a way onward.
    expect(screen.getByRole('button', { name: 'Browse tutorials' })).toBeTruthy()
  })
})
