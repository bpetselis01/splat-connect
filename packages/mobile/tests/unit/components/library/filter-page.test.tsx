// The libraries' filter page, driven through both screens (spec
// 2026-10-05-library-redesign): choices apply only on Show, Close discards,
// Reset restores defaults, and the child questions keep only tagged items.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { LibraryScreen } from '../../../../components/home/library-screen'
import { ToyLibraryScreen } from '../../../../components/toys/toy-library-screen'
import { FilterPage, type FilterGroup, type FilterValues } from '../../../../components/library/filter-page'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => ({}),
    // The library refetches on focus; the first focus is the mount, as on a device.
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})
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

  it('G03 applies nothing until Show is pressed', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    // Behind the page, and on the button, nothing has changed yet.
    expect(screen.getByText('3 guides · Recommended')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
    show('guides')
    expect(screen.queryByText('Easy one')).toBeNull()
    expect(screen.getByText('Hard one')).toBeTruthy()
  })

  it('G03 shows the live count for the draft on the Show button, singular and plural', async () => {
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

  it('G03 discards the draft on Close', async () => {
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

  it('G03 marks one-of groups as radios and many-of groups as selectable buttons', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    expect(screen.getByRole('radio', { name: 'Recommended', checked: true })).toBeTruthy()
    fireEvent.press(screen.getByText('Quickest'))
    expect(screen.getByRole('radio', { name: 'Quickest', checked: true })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Recommended', checked: false })).toBeTruthy()
    fireEvent.press(screen.getByText('Easy'))
    expect(screen.getByRole('button', { name: 'Easy', selected: true })).toBeTruthy()
  })

  it('G03 returns the draft to the defaults on Reset, without applying', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    fireEvent.press(screen.getByText('Hard'))
    fireEvent.press(screen.getByText('Quickest'))
    expect(screen.getByText('Show 1 guide')).toBeTruthy()
    fireEvent.press(screen.getByText('Reset'))
    expect(screen.getByText('Show 3 guides')).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Recommended', checked: true })).toBeTruthy()
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
    expect(screen.getByText('3 guides · Recommended')).toBeTruthy()
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

  it('lays the page out as Sort by, About the child, then About the guide', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Easy one')
    await openFilters()
    const titles = ['Sort by', 'About your child', 'Helps with', 'How the child uses it', 'Press force', 'Play', 'About the guide', 'Device type', 'Difficulty', 'Build time', 'Parts']
    // Text in tree order, cut to the group titles (an option like "Press" is not one).
    const seen = screen.getAllByText(/.+/).map((n) => n.props.children).filter((c) => titles.includes(c))
    expect(seen).toEqual(titles)
  })

  describe('the child questions and Device type', () => {
    beforeEach(() => {
      guides = [
        guide({ id: 'a', title: 'Press guide', helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light'], play: ['light'], device_types: ['adapted_toy'] }),
        guide({ id: 'b', title: 'Voice guide', helps_with: ['communicating'], access: ['voice'], press_force: ['full'], play: ['sound'], device_types: ['switch'] }),
        guide({ id: 'c', title: 'Untagged guide' }),
      ]
    })

    it('keeps only guides tagged Helps with, leaving out an untagged one', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Communicating'))
      expect(screen.getByText('Show 1 guide')).toBeTruthy()
      show('guides')
      expect(screen.getByText('Voice guide')).toBeTruthy()
      expect(screen.queryByText('Press guide')).toBeNull()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })

    it('keeps guides matching any of the chosen ways to use it', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Press'))
      fireEvent.press(screen.getByText('Voice or breath'))
      show('guides')
      expect(screen.getByText('Press guide')).toBeTruthy()
      expect(screen.getByText('Voice guide')).toBeTruthy()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })

    it('offers One hand is enough as a chip that keeps guides flagged for one hand', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('One hand is enough'))
      show('guides')
      expect(screen.getByText('Press guide')).toBeTruthy()
      expect(screen.queryByText('Voice guide')).toBeNull()
      expect(screen.getByRole('button', { name: 'Remove filter: One hand is enough' })).toBeTruthy()
    })

    it('keeps only guides tagged with a chosen Press force or Play value', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Full'))
      show('guides')
      expect(screen.getByText('Voice guide')).toBeTruthy()
      expect(screen.queryByText('Press guide')).toBeNull()
      await openFilters()
      fireEvent.press(screen.getByText('Reset'))
      fireEvent.press(screen.getByText('Lights'))
      show('guides')
      expect(screen.getByText('Press guide')).toBeTruthy()
      expect(screen.queryByText('Voice guide')).toBeNull()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })

    it('keeps only guides of a chosen Device type', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Press guide')
      await openFilters()
      fireEvent.press(screen.getByText('Switch'))
      show('guides')
      expect(screen.getByText('Voice guide')).toBeTruthy()
      expect(screen.queryByText('Press guide')).toBeNull()
      expect(screen.queryByText('Untagged guide')).toBeNull()
    })
  })

  describe('child-profile pre-fill', () => {
    beforeEach(() => {
      children = [{ helps_with: ['moving'], access: ['press'], one_hand: true, press_force: 'light', enjoys: ['light'] }]
      guides = [
        guide({ id: 'a', title: 'Fits the child', helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light'], play: ['light'] }),
        guide({ id: 'b', title: 'Does not fit', helps_with: ['seeing'], access: ['eyes'], press_force: ['full'], play: ['sound'] }),
      ]
    })

    it('shows the child answers on the page but applies nothing until Show', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Fits the child')
      await act(async () => {})
      await openFilters()
      expect(screen.getByText('About your child')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Moving and using hands', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Press', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'One hand is enough', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Light', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Lights', selected: true })).toBeTruthy()
      expect(screen.getByText('Show 1 guide')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
      expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
      expect(screen.getByText('Does not fit')).toBeTruthy()
    })

    it('applies the suggestion when Show is pressed', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Fits the child')
      await act(async () => {})
      await openFilters()
      show('guides')
      expect(screen.queryByText('Does not fit')).toBeNull()
      expect(screen.getByText('Fits the child')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Filters, 5 on' })).toBeTruthy()
    })

    it('does not overwrite filters already applied on those questions', async () => {
      render(<LibraryScreen />)
      await screen.findByText('Fits the child')
      await act(async () => {})
      await openFilters()
      fireEvent.press(screen.getByText('Reset'))
      fireEvent.press(screen.getByText('Full'))
      show('guides')
      await openFilters()
      expect(screen.getByRole('button', { name: 'Full', selected: true })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Light', selected: false })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Lights', selected: false })).toBeTruthy()
    })
  })
})

describe('Toys filter page', () => {
  beforeEach(() => {
    toys = [
      toy({ id: 'a', name: 'Press toy', helps_with: ['moving'], access: ['press'], one_hand: true, press_force: ['light'], play: ['light'] }),
      toy({ id: 'b', name: 'Voice toy', helps_with: ['communicating'], access: ['voice'], press_force: ['full'], play: ['sound'] }),
      toy({ id: 'c', name: 'Untagged toy' }),
    ]
  })

  it('applies nothing until Show, and Show carries the live count', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    expect(screen.getByText('Show 3 toys')).toBeTruthy()
    fireEvent.press(screen.getByText('Voice or breath'))
    expect(screen.getByText('Show 1 toy')).toBeTruthy()
    expect(screen.getByText('3 toys · Newest first')).toBeTruthy()
    show('toys')
    expect(screen.queryByText('Press toy')).toBeNull()
    expect(screen.queryByText('Untagged toy')).toBeNull()
    expect(screen.getByText('Voice toy')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filters, 1 on' })).toBeTruthy()
  })

  it('discards the draft on Close and restores it on Reset', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    fireEvent.press(screen.getByText('Voice or breath'))
    fireEvent.press(screen.getByRole('button', { name: 'Close filters' }))
    expect(screen.getByText('Press toy')).toBeTruthy()
    await openFilters()
    expect(screen.getByText('Show 3 toys')).toBeTruthy()
    fireEvent.press(screen.getByText('Voice or breath'))
    fireEvent.press(screen.getByText('Lights'))
    fireEvent.press(screen.getByText('Reset'))
    expect(screen.getByText('Show 3 toys')).toBeTruthy()
  })

  it('keeps only toys tagged with a chosen Access, One hand, Press force or Play value', async () => {
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await openFilters()
    fireEvent.press(screen.getByText('One hand is enough'))
    show('toys')
    expect(screen.getByText('Press toy')).toBeTruthy()
    expect(screen.queryByText('Voice toy')).toBeNull()
    expect(screen.queryByText('Untagged toy')).toBeNull()
    await openFilters()
    fireEvent.press(screen.getByText('Reset'))
    fireEvent.press(screen.getByText('Music and sound'))
    show('toys')
    expect(screen.getByText('Voice toy')).toBeTruthy()
    expect(screen.queryByText('Press toy')).toBeNull()
    await openFilters()
    fireEvent.press(screen.getByText('Reset'))
    fireEvent.press(screen.getByText('Full'))
    show('toys')
    expect(screen.getByText('Voice toy')).toBeTruthy()
    expect(screen.queryByText('Press toy')).toBeNull()
  })

  it('shows the child pre-fill on the page, applying nothing until Show', async () => {
    children = [{ helps_with: [], access: [], one_hand: false, press_force: null, enjoys: ['sound'] }]
    render(<ToyLibraryScreen />)
    await screen.findByText('Press toy')
    await act(async () => {})
    await openFilters()
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
