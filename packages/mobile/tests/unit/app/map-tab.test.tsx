import { render, screen } from '@testing-library/react-native'
import MapTab from '../../../app/(tabs)/map'

describe('Map tab', () => {
  it('is a To be completed screen, not a row that opens another one', () => {
    render(<MapTab />)
    expect(screen.getByText('Map')).toBeTruthy()
    expect(screen.getByText('To be completed')).toBeTruthy()
    expect(screen.queryByText('Open the map')).toBeNull()
  })
})
