// The libraries' filter page, driven through both screens (spec
// 2026-10-05-library-redesign): choices apply only on Show, Close discards,
// Reset restores defaults, and the suits questions keep only tagged items.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { LibraryScreen } from '../../../../components/home/library-screen'
import { ToyLibraryScreen } from '../../../../components/toys/toy-library-screen'
import { FilterPage, type FilterGroup, type FilterValues } from '../../../../components/library/filter-page'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => ({}) }))
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: { tutorials: [], toys: [], challenges: [] }, isSaved: () => false, toggle: jest.fn() }),
}))
const mockCaps = { current: null as null | { profile: Record<string, unknown> } }
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: mockCaps.current, loading: false, refresh: jest.fn() }),
}))

const guide = (over: object) => ({
  id: 'g', title: 'Guide', description: null, difficulty: 'easy', kind: 'toy_adaptation', status: 'approved',
  photo_urls: [], toy_photo_url: null, created_at: '2026-06-01T00:00:00Z', updated_at: '', tutorial_orgs: [], ...over,
})
const toy = (over: object) => ({
  id: 't', owner_id: 'u1', owner_org_id: null, quantity: 1, name: 'Toy', description: null, condition: 8, switch_adapted: false,
  photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published', offer_type: 'donation',
  created_at: '2026-06-01T00:00:00Z', updated_at: '', profiles: { name: 'Jamie' }, organizations: null, ...over,
})

let guides: object[] = []
let toys: object[] = []
let children: object[] = []
function routes() {
  mockGet.mockImplementation((p: string) =>
    Promise.resolve(p === '/api/child-profiles' ? children : p.startsWith('/api/public/toys') ? toys : p === '/api/saves/ids' ? { tutorials: [], toys: [], challenges: [] } : guides)
  )
}
beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.current = null
  guides = []
  toys = []
  children = []
  routes()
})

const openFilters = async () => fireEvent.press(await screen.findByRole('button', { name: /^Filters/ }))
const show = (noun: 'guides' | 'toys') => fireEvent.press(screen.getByText(new RegExp(`^Show \\d+ ${noun.slice(0, -1)}s?$`)))

describe('Guides filter page', () => {
  beforeEach(() => {
    guides = [
      guide({ id: 'e', title: 'Easy one', difficulty: 'easy' }),
      guide({ id: 'h', title: 'Hard one', difficulty: 'hard' }),
      guide({ id: 'm', title: 'Medium one', difficulty: 'medium' }),
    ]
  })

  it('applies nothing until Show is pressed', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    // Behind the page, and on the button, nothing has changed yet.
    expect(screen.getByText('3 guides · Newest first')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    show('guides')
    expect(screen.queryByText('Easy one')).toBeNull()
    expect(screen.getByText('Hard one')).toBeTruthy()
  })

  it('shows the live count for the draft on the Show button, singular and plural', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    expect(screen.getByText('Show 3 guides')).toBeTruthy()
    fireEvent.press(screen.getByText('Hard'))
    expect(screen.getByText('Show 1 guide')).toBeTruthy()
    fireEvent.press(screen.getByText('Easy'))
    expect(screen.getByText('Show 2 guides')).toBeTruthy()
    fireEvent.press(screen.getByText('Hard'))
    fireEvent.press(screen.getByText('Easy'))
    expect(screen.getByText('Show 3 guides')).toBeTruthy()
  })

  it('discards the draft on Close', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
    expect(screen.queryByText(/^Show \d+/)).toBeNull()
    expect(screen.getByText('Easy one')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    // Reopening starts from what is applied, not from the discarded draft.
    await openFilters()
    expect(screen.getByText('Show 3 guides')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hard', selected: false })).toBeTruthy()
  })

  it('marks one-of groups as radios and many-of groups as selectable buttons', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    expect(screen.getByRole('radio', { name: 'All', checked: true })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Newest', checked: true })).toBeTruthy()
    fireEvent.press(screen.getByText('Quickest'))
    expect(screen.getByRole('radio', { name: 'Quickest', checked: true })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Newest', checked: false })).toBeTruthy()
    fireEvent.press(screen.getByText('Easy'))
    expect(screen.getByRole('button', { name: 'Easy', selected: true })).toBeTruthy()
  })

  it('returns the draft to the defaults on Reset, without applying', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    fireEvent.press(screen.getByText('Quickest'))
    expect(screen.getByText('Show 1 guide')).toBeTruthy()
    fireEvent.press(screen.getByText('Reset'))
    expect(screen.getByText('Show 3 guides')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Newest', checked: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Hard', selected: false })).toBeTruthy()
  })

  it('Reset then Show clears filters that were already applied', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    show('guides')
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeTruthy()
    await openFilters()
    fireEvent.press(screen.getByText('Reset'))
    show('guides')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    expect(screen.getByText('3 guides · Newest first')).toBeTruthy()
  })

  it('counts every applied filter on the button, and drops a tag when it is removed', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    fireEvent.press(screen.getByText('Easy'))
    fireEvent.press(screen.getByText('Under 30 min'))
    show('guides')
    expect(screen.getByRole('button', { name: 'Filters, 3 on' })).toBeTruthy()
    expect(screen.getByText('Matching guides')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Remove filter: Hard' }))
    expect(screen.getByRole('button', { name: 'Filters, 2 on' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Remove filter: Hard' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove filter: Easy' })).toBeTruthy()
  })

  it('does not count the sort as a filter', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Easiest'))
    show('guides')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Remove filter/ })).toBeNull()
    expect(screen.getByText('3 guides · Easiest first')).toBeTruthy()
  })

  describe('Movement, Hands, Play and Measurements', () => {
    beforeEach(() => {
      guides = [
        guide({ id: 'a', title: 'Press guide', movement: ['press'], hands: ['both'], play: ['light'], fit: { palm_width_mm: [50, 70] } }),
        guide({ id: 'b', title: 'Lever guide', movement: ['lever'], hands: ['left'], play: ['sound'], fit: { palm_width_mm: [80, 100] } }),
        guide({ id: 'c', title: 'Untagged guide' }),
      ]
    })

    it('keeps only guides tagged Movement, leaving out an untagged one', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Lever'))
      expect(screen.getByText('Show 1 guide')).toBeTruthy()
      show('guides')
      expect(screen.getByText('Lever guide')).toBeTruthy()
      expect(screen.queryByText('Press guide')).toBeNull()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })

    it('keeps guides matching any of the chosen Hands', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Both hands'))
      fireEvent.press(screen.getByText('Left stronger'))
      show('guides')
      expect(screen.getByText('Press guide')).toBeTruthy()
      expect(screen.getByText('Lever guide')).toBeTruthy()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })

    it('keeps only guides tagged Play', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Music and sound'))
      show('guides')
      expect(screen.getByText('Lever guide')).toBeTruthy()
      expect(screen.queryByText('Press guide')).toBeNull()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })

    it('keeps guides whose range holds a typed measurement, and tags it', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 62'), '60')
      expect(screen.getByText('Show 1 guide')).toBeTruthy()
      show('guides')
      expect(screen.getByText('Press guide')).toBeTruthy()
      expect(screen.queryByText('Lever guide')).toBeNull()
      expect(screen.queryByText('Untagged guide')).toBeNull()
      expect(screen.getByRole('button', { name: 'Remove filter: Hand width 60 mm' })).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Remove filter: Hand width 60 mm' }))
      expect(screen.getByText('Untagged guide')).toBeTruthy()
    })

    it('says a measurement out of range is not an answer, and does not filter on it', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.changeText(screen.getByPlaceholderText('e.g. 62'), '9999')
      expect(screen.getByText('Between 20 and 250.')).toBeTruthy()
      expect(screen.getByText('Show 3 guides')).toBeTruthy()
    })
  })

  describe('For your child', () => {
    it('offers Suits <name> with its count only when some guide suits a child', async () => {
      children = [{ name: 'Ollie', press_force: 'light', hold: 'second', aim: null }]
      guides = [guide({ id: 'a', title: 'Light', switch_force: 'very_light', switch_hold: 'moment' }), guide({ id: 'b', title: 'Firm', switch_force: 'full' })]
      render(<LibraryScreen />)
      await screen.findByText('Light')
      await act(async () => {})
      await openFilters()
      expect(screen.getByText('Suits Ollie · 1')).toBeTruthy()
    })
  })

  describe('child-profile pre-fill', () => {
    beforeEach(() => {
      children = [{ name: 'Ollie', working_hand: 'left', enjoys: ['light'], palm_width_mm: 60, reach_cm: null, tray_mm: null }]
      guides = [
        guide({ id: 'a', title: 'Fits Ollie', hands: ['left'], play: ['light'], fit: { palm_width_mm: [50, 70] } }),
        guide({ id: 'b', title: 'Does not fit', hands: ['right'], play: ['sound'], fit: { palm_width_mm: [80, 100] } }),
      ]
    })

    it('shows the child answers on the page but applies nothing until Show', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Fits Ollie')
      await act(async () => {})
      await openFilters()
      expect(screen.getByRole('button', { name: 'Left stronger', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Lights', selected: true })).toBeTruthy()
      expect(screen.getByDisplayValue('60')).toBeTruthy()
      expect(screen.getByText('Show 1 guide')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
      expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
      expect(screen.getByText('Does not fit')).toBeTruthy()
    })

    it('applies the suggestion when Show is pressed', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Fits Ollie')
      await act(async () => {})
      await openFilters()
      show('guides')
      expect(screen.queryByText('Does not fit')).toBeNull()
      expect(screen.getByText('Fits Ollie')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Filters, 3 on' })).toBeTruthy()
    })

    it('does not overwrite filters already applied on those questions', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Fits Ollie')
      await act(async () => {})
      await openFilters()
      fireEvent.press(screen.getByText('Reset'))
      fireEvent.press(screen.getByText('Right stronger'))
      show('guides')
      await openFilters()
      expect(screen.getByRole('button', { name: 'Right stronger', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Left stronger', selected: false })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Lights', selected: false })).toBeTruthy()
    })
  })
})

describe('Toys filter page', () => {
  beforeEach(() => {
    toys = [
      toy({ id: 'a', name: 'Press toy', movement: ['press'], hands: ['both'], play: ['light'], fit: { reach_cm: [20, 40] } }),
      toy({ id: 'b', name: 'Lever toy', movement: ['lever'], hands: ['left'], play: ['sound'], fit: { reach_cm: [50, 70] } }),
      toy({ id: 'c', name: 'Untagged toy' }),
    ]
  })

  it('applies nothing until Show, and Show carries the live count', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    expect(screen.getByText('Show 3 toys')).toBeTruthy()
    fireEvent.press(screen.getByText('Lever'))
    expect(screen.getByText('Show 1 toy')).toBeTruthy()
    expect(screen.getByText('3 toys · Newest first')).toBeTruthy()
    show('toys')
    expect(screen.queryByText('Press toy')).toBeNull()
    expect(screen.queryByText('Untagged toy')).toBeNull()
    expect(screen.getByText('Lever toy')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeTruthy()
  })

  it('discards the draft on Close and restores it on Reset', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    fireEvent.press(screen.getByText('Lever'))
    fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
    expect(screen.getByText('Press toy')).toBeTruthy()
    await openFilters()
    expect(screen.getByText('Show 3 toys')).toBeTruthy()
    fireEvent.press(screen.getByText('Lever'))
    fireEvent.press(screen.getByText('Lights'))
    fireEvent.press(screen.getByText('Reset'))
    expect(screen.getByText('Show 3 toys')).toBeTruthy()
  })

  it('keeps only toys tagged with a chosen Hands or Play value', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    fireEvent.press(screen.getByText('Both hands'))
    show('toys')
    expect(screen.getByText('Press toy')).toBeTruthy()
    expect(screen.queryByText('Lever toy')).toBeNull()
    expect(screen.queryByText('Untagged toy')).toBeNull()
    await openFilters()
    fireEvent.press(screen.getByText('Reset'))
    fireEvent.press(screen.getByText('Music and sound'))
    show('toys')
    expect(screen.getByText('Lever toy')).toBeTruthy()
    expect(screen.queryByText('Press toy')).toBeNull()
  })

  it('keeps toys whose range holds a measurement', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    fireEvent.changeText(screen.getByPlaceholderText('e.g. 30'), '30')
    show('toys')
    expect(screen.getByText('Press toy')).toBeTruthy()
    expect(screen.queryByText('Lever toy')).toBeNull()
    expect(screen.queryByText('Untagged toy')).toBeNull()
    expect(screen.getByRole('button', { name: 'Remove filter: Reach from seated 30 cm' })).toBeTruthy()
  })

  it('shows the child pre-fill on the page, applying nothing until Show', async () => {
    children = [{ name: 'Ollie', working_hand: 'either', enjoys: ['sound'], palm_width_mm: null, reach_cm: null, tray_mm: null }]
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await act(async () => {})
    await openFilters()
    // 'either' reads as both hands.
    expect(screen.getByRole('button', { name: 'Both hands', selected: true })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Music and sound', selected: true })).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    expect(screen.getByText('Untagged toy')).toBeTruthy()
  })

  it('goes to Organisations on Show instead of filtering, and stays on Toys when back', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    fireEvent.press(screen.getByRole('radio', { name: 'Organisations' }))
    expect(mockPush).not.toHaveBeenCalled()
    show('toys')
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisations')
    expect(screen.getByText('Press toy')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
  })

  it('refetches with ?near= when Nearest first is shown, and only then', async () => {
    mockCaps.current = { profile: { id: 'me', pickup_postcode: '3000' } }
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    expect(mockGet).not.toHaveBeenCalledWith('/api/public/toys?near=3000')
    await openFilters()
    fireEvent.press(screen.getByText('Nearest first'))
    expect(mockGet).not.toHaveBeenCalledWith('/api/public/toys?near=3000')
    show('toys')
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/api/public/toys?near=3000'))
    expect(await screen.findByText('3 toys · Nearest first')).toBeTruthy()
  })

  it('filters by availability and condition together', async () => {
    toys = [
      toy({ id: 'a', name: 'Good and here', condition: 8 }),
      toy({ id: 'b', name: 'Good but gone', condition: 8, owner_id: null, owner_org_id: 'o', quantity: 0, organizations: { name: 'TAD' } }),
      toy({ id: 'c', name: 'Worn and here', condition: 2 }),
    ]
    render(<ToyLibraryScreen />)
    await screen.findByText('Good and here')
    await openFilters()
    fireEvent.press(screen.getByText('Available now'))
    fireEvent.press(screen.getByText('Good'))
    expect(screen.getByText('Show 1 toy')).toBeTruthy()
    show('toys')
    expect(screen.getByText('Good and here')).toBeTruthy()
    expect(screen.queryByText('Good but gone')).toBeNull()
    expect(screen.queryByText('Worn and here')).toBeNull()
    expect(screen.getByRole('button', { name: 'Filters, 2 on' })).toBeTruthy()
  })
})

describe('FilterPage on its own', () => {
  const groups: FilterGroup[] = [
    { kind: 'one', key: 'sort', label: 'Sort by', options: [{ value: 'a', label: 'A first' }, { value: 'b', label: 'B first' }] },
    { kind: 'many', key: 'tags', label: 'Tags', options: [{ value: 'x', label: 'Ex' }, { value: 'y', label: 'Why' }] },
  ]
  const defaults: FilterValues = { sort: 'a', tags: [] }

  it('hands the draft to onApply, resets to the defaults it was given, and calls onClose on the close button', () => {
    const onApply = jest.fn()
    const onClose = jest.fn()
    render(
      <FilterPage visible groups={groups} start={{ sort: 'b', tags: ['x'] }} defaults={defaults} count={(d) => (d.tags as string[]).length} noun={['thing', 'things']} onApply={onApply} onClose={onClose} />
    )
    expect(screen.getByText('Show 1 thing')).toBeTruthy()
    fireEvent.press(screen.getByText('Why'))
    expect(screen.getByText('Show 2 things')).toBeTruthy()
    fireEvent.press(screen.getByText('Show 2 things'))
    expect(onApply).toHaveBeenCalledWith({ sort: 'b', tags: ['x', 'y'] })
    fireEvent.press(screen.getByText('Reset'))
    expect(screen.getByText('Show 0 things')).toBeTruthy()
    fireEvent.press(screen.getByText('Show 0 things'))
    expect(onApply).toHaveBeenLastCalledWith(defaults)
    fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onApply).toHaveBeenCalledTimes(2)
  })

  it('draws nothing while not visible', () => {
    render(<FilterPage visible={false} groups={groups} start={defaults} defaults={defaults} count={() => 0} noun={['thing', 'things']} onApply={jest.fn()} onClose={jest.fn()} />)
    expect(screen.queryByText('Reset')).toBeNull()
  })
})
