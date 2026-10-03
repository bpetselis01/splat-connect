import { render, screen } from '@testing-library/react-native'
import { ToBeCompleted } from '../../../../components/ui/ToBeCompleted'

describe('ToBeCompleted', () => {
  it('says To be completed with the one-line reason', () => {
    render(<ToBeCompleted>The map is coming.</ToBeCompleted>)
    expect(screen.getByText('To be completed')).toBeTruthy()
    expect(screen.getByText('The map is coming.')).toBeTruthy()
  })
  it('names what is missing when given a subject', () => {
    render(<ToBeCompleted subject="Map and address">Coming.</ToBeCompleted>)
    expect(screen.getByText('Map and address')).toBeTruthy()
  })
})
