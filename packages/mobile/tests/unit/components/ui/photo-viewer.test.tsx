import { render, screen, fireEvent } from '@testing-library/react-native'
import { PhotoViewer } from '../../../../components/ui/PhotoViewer'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const photos = [{ uri: 'https://x.test/a.jpg', caption: 'The finished switch' }, { uri: 'https://x.test/b.jpg' }]

it('stays closed until it is given a photo to show', () => {
  render(<PhotoViewer photos={photos} index={null} onClose={jest.fn()} />)
  expect(screen.queryByLabelText('Close photo')).toBeNull()
})

it('shows the photos full screen, zoomable, and closes back', () => {
  const onClose = jest.fn()
  render(<PhotoViewer photos={photos} index={0} onClose={onClose} />)
  expect(screen.getByLabelText('The finished switch')).toBeTruthy()
  expect(screen.getByText('Pinch to zoom')).toBeTruthy()
  expect(screen.UNSAFE_getAllByProps({ maximumZoomScale: 4 }).length).toBeGreaterThan(0)
  fireEvent.press(screen.getByLabelText('Close photo'))
  expect(onClose).toHaveBeenCalled()
})
