import { render, screen, fireEvent } from '@testing-library/react-native'
import { PendingButton, PendingRow } from '../../../../components/ui/pending'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

beforeEach(() => jest.clearAllMocks())

describe('pending controls', () => {
  it('a pending button looks like its label and opens Not built yet', () => {
    render(<PendingButton pending="org-visit-map" label="Mark this build done" />)
    fireEvent.press(screen.getByText('Mark this build done'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'org-visit-map' } })
  })
  it('a pending row does the same', () => {
    render(<PendingRow pending="customization-metrics" label="Customization" />)
    fireEvent.press(screen.getByText('Customization'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'customization-metrics' } })
  })
})
