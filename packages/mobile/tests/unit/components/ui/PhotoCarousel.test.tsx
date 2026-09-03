import { render, screen } from '@testing-library/react-native'
import { PhotoCarousel } from '../../../../components/ui/PhotoCarousel'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

/**
 * The paging itself is the platform's (`pagingEnabled`) and the dot animation
 * is Reanimated's, neither of which react-test-renderer runs — the device
 * Maestro flow is what proves those. What is testable here is the shape the
 * component chooses for a given number of photos, which is where its own
 * decisions live.
 */
const A = 'https://example.com/a.jpg'
const B = 'https://example.com/b.jpg'

it('renders a placeholder when there are no photos', () => {
  render(<PhotoCarousel urls={[]} />)
  expect(screen.UNSAFE_getAllByType('Ionicons' as never)).toHaveLength(1)
  expect(screen.queryByLabelText(/photo/i)).toBeNull()
})

it('renders every photo it is given', () => {
  render(<PhotoCarousel urls={[A, B]} />)
  const images = screen.UNSAFE_getAllByType('Image' as never)
  expect(images.map((i) => (i.props as { source: { uri: string } }).source.uri)).toEqual([A, B])
})

// One photo is one photo: a scroll view that rubber-bands as though there were
// something just off screen is a lie about what is there.
it('does not let a single photo scroll', () => {
  render(<PhotoCarousel urls={[A]} />)
  const scroll = screen.UNSAFE_getByType('RCTScrollView' as never)
  expect((scroll.props as { scrollEnabled: boolean }).scrollEnabled).toBe(false)
})

it('lets several photos scroll, one page at a time', () => {
  render(<PhotoCarousel urls={[A, B]} />)
  const scroll = screen.UNSAFE_getByType('RCTScrollView' as never)
  const props = scroll.props as { scrollEnabled: boolean; pagingEnabled: boolean }
  expect(props.scrollEnabled).toBe(true)
  expect(props.pagingEnabled).toBe(true)
})

it('flags the photo that shows the switch, and only that one', () => {
  render(<PhotoCarousel urls={[A, B]} switchUrl={B} />)
  expect(screen.getAllByText('Shows the switch')).toHaveLength(1)
})

it('shows no flag when nothing is tagged', () => {
  render(<PhotoCarousel urls={[A, B]} switchUrl={null} />)
  expect(screen.queryByText('Shows the switch')).toBeNull()
})
