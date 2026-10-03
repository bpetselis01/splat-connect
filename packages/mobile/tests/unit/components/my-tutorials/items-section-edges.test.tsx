import { render, screen, fireEvent } from '@testing-library/react-native'
import { ItemsSection } from '../../../../components/my-tutorials/sections/items-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }) }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockDraft = {
  tutorial: {} as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null as string | null,
  save: jest.fn(), saveNow: jest.fn(), replaceItems: jest.fn(), flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const part = (n: number, over: object = {}) => ({ id: `p${n}`, name: `Part ${n}`, quantity: 1, is_optional: false, buy_links: [], price_cents: null, ...over })
const tool = (n: number, over: object = {}) => ({ id: `x${n}`, name: `Tool ${n}`, is_optional: false, buy_links: [], note: null, get_by: null, ...over })
const open = (parts: object[], tools: object[] = []) => {
  mockDraft.tutorial = { id: 't1', status: 'draft', parts, tools, stl_files: [], kind: 'toy_adaptation', difficulty: 'easy', title: 'T', safety_declared_at: null, build_minutes: 5, tutorial_pdf_url: null, photo_urls: [], prices_checked_on: null }
}
const sent = (noun: 'parts' | 'tools') => mockDraft.replaceItems.mock.calls.filter((c) => c[0] === noun).at(-1)![1] as Record<string, unknown>[]

beforeEach(() => { jest.clearAllMocks(); mockDraft.saveError = null; open([part(1)]) })

describe('part prices as typed', () => {
  it.each([
    ['7.25', 725], ['$7.5', 750], ['  12 ', 1200], ['0', 0], ['0.00', 0], ['999999999.99', 99999999999],
  ])('reads %p as %p cents', (text, cents) => {
    render(<ItemsSection noun="parts" />)
    fireEvent.changeText(screen.getByLabelText('Part 1 price'), text)
    expect(sent('parts')[0].price_cents).toBe(cents)
  })

  it('clearing the field removes the price', () => {
    open([part(1, { price_cents: 600 })])
    render(<ItemsSection noun="parts" />)
    fireEvent.changeText(screen.getByLabelText('Part 1 price'), '')
    expect(sent('parts')[0].price_cents).toBeNull()
    fireEvent.changeText(screen.getByLabelText('Part 1 price'), '   ')
    expect(sent('parts')[0].price_cents).toBeNull()
  })

  it.each(['7.', '7.255', '1,200', 'abc', '-5', '1e3', '$', '12345678901'])('keeps the last amount that parsed while %p is typed, and shows what was typed', (text) => {
    open([part(1, { price_cents: 600 })])
    render(<ItemsSection noun="parts" />)
    fireEvent.changeText(screen.getByLabelText('Part 1 price'), text)
    expect(sent('parts')[0].price_cents).toBe(600)
    expect(screen.getByLabelText('Part 1 price').props.value).toBe(text)
  })

  it('shows a saved price to the cent', () => {
    open([part(1, { price_cents: 5 }), part(2, { price_cents: 1250 }), part(3)])
    render(<ItemsSection noun="parts" />)
    expect(screen.getByLabelText('Part 1 price').props.value).toBe('0.05')
    expect(screen.getByLabelText('Part 2 price').props.value).toBe('12.50')
    expect(screen.getByLabelText('Part 3 price').props.value).toBe('')
  })

  it('keeps each row’s price with its row after a row above is removed', () => {
    open([part(1, { price_cents: 100 }), part(2, { price_cents: 250 }), part(3, { price_cents: 399 })])
    render(<ItemsSection noun="parts" />)
    fireEvent.changeText(screen.getByLabelText('Part 3 price'), '3.9')
    fireEvent.press(screen.getByTestId('item-remove-0'))
    expect(sent('parts').map((r) => [r.name, r.price_cents])).toEqual([['Part 2', 250], ['Part 3', 390]])
    expect(screen.getByLabelText('Part 1 price').props.value).toBe('2.50')
    expect(screen.getByLabelText('Part 2 price').props.value).toBe('3.90')
  })
})

describe('rows', () => {
  it('adds a part with quantity 1 and no price, and a tool with no note', () => {
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByTestId('items-add'))
    expect(sent('parts')[1]).toEqual({ name: '', quantity: 1, is_optional: false, buy_links: [], price_cents: null })
    expect(screen.getByText('Add a name to save this row')).toBeTruthy()
  })

  it('adds a tool row with a note and how-to-get slot, and no quantity or price', () => {
    open([], [])
    render(<ItemsSection noun="tools" />)
    fireEvent.press(screen.getByTestId('items-add'))
    expect(sent('tools')[0]).toEqual({ name: '', quantity: undefined, is_optional: false, buy_links: [], note: null, get_by: null })
  })

  it('names a whitespace-only name as unsaved', () => {
    render(<ItemsSection noun="parts" />)
    fireEvent.changeText(screen.getByLabelText('Part 1 name'), '   ')
    expect(screen.getByText('Add a name to save this row')).toBeTruthy()
  })

  it('takes emoji, quotes, markup and a 300-character name as typed', () => {
    render(<ItemsSection noun="parts" />)
    const name = `🧸 "Big" <red> & 3.5mm ${'x'.repeat(300)}`
    fireEvent.changeText(screen.getByLabelText('Part 1 name'), name)
    expect(sent('parts')[0].name).toBe(name)
  })

  it('counts the quantity up without a ceiling', () => {
    open([part(1, { quantity: 99 })])
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByTestId('item-qty-up-0'))
    expect(sent('parts')[0].quantity).toBe(100)
  })

  it('never steps the quantity below one', () => {
    open([part(1, { quantity: 1 })])
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByTestId('item-qty-down-0'))
    expect(sent('parts')[0].quantity).toBe(1)
  })

  it('treats a part saved without a quantity as one', () => {
    open([part(1, { quantity: null })])
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByTestId('item-qty-up-0'))
    expect(sent('parts')[0].quantity).toBe(2)
  })

  it('lists 100 parts and still sends all of them after one is renamed', () => {
    open(Array.from({ length: 100 }, (_, i) => part(i + 1)))
    render(<ItemsSection noun="parts" />)
    fireEvent.changeText(screen.getByLabelText('Part 100 name'), 'Last')
    expect(sent('parts')).toHaveLength(100)
    expect(sent('parts')[99].name).toBe('Last')
  })

  it('removing the only row sends an empty list and shows the empty line', () => {
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByTestId('item-remove-0'))
    expect(sent('parts')).toEqual([])
    expect(screen.getByText('No parts yet.')).toBeTruthy()
  })

  it('toggles optional on and off', () => {
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByTestId('item-optional-0'))
    expect(sent('parts')[0].is_optional).toBe(true)
    fireEvent.press(screen.getByTestId('item-optional-0'))
    expect(sent('parts')[0].is_optional).toBe(false)
  })
})

describe('tool details', () => {
  it('turns an emptied note into null, and caps it at 200 characters', () => {
    open([], [tool(1, { note: 'Borrow one' })])
    render(<ItemsSection noun="tools" />)
    expect(screen.getByLabelText('Tool 1 note').props.maxLength).toBe(200)
    fireEvent.changeText(screen.getByLabelText('Tool 1 note'), '')
    expect(sent('tools')[0].note).toBeNull()
  })

  it('un-picks how to get a tool when its chip is pressed twice', () => {
    open([], [tool(1)])
    render(<ItemsSection noun="tools" />)
    fireEvent.press(screen.getByText('Borrow'))
    expect(sent('tools')[0].get_by).toBe('borrow')
    fireEvent.press(screen.getByText('Borrow'))
    expect(sent('tools')[0].get_by).toBeNull()
  })
})

describe('buy links', () => {
  const links = [{ label: 'Jaycar', url: 'https://a.test' }, { label: 'Core', url: 'https://b.test' }]

  it('shows the link count on the button and removes only the chosen link', () => {
    open([part(1, { buy_links: links })])
    render(<ItemsSection noun="parts" />)
    expect(screen.getByText('Buy links (2)')).toBeTruthy()
    fireEvent.press(screen.getByText('Buy links (2)'))
    fireEvent.press(screen.getAllByText('Remove link')[0])
    expect(sent('parts')[0].buy_links).toEqual([links[1]])
  })

  it('shows one row’s links at a time', () => {
    open([part(1, { buy_links: links }), part(2, { buy_links: [links[0]] })])
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByLabelText('Buy links for part 1'))
    expect(screen.getByLabelText('Part 1 link 1 shop')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Buy links for part 2'))
    expect(screen.queryByLabelText('Part 1 link 1 shop')).toBeNull()
    expect(screen.getByLabelText('Part 2 link 1 shop')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Buy links for part 2'))
    expect(screen.queryByLabelText('Part 2 link 1 shop')).toBeNull()
  })

  it('keeps a half-typed link in the row; the hook, not the screen, drops it from the POST', () => {
    render(<ItemsSection noun="parts" />)
    fireEvent.press(screen.getByLabelText('Buy links for part 1'))
    fireEvent.press(screen.getByText('+ Add a buy link'))
    fireEvent.changeText(screen.getByLabelText('Part 1 link 1 shop'), 'Jaycar')
    expect(sent('parts')[0].buy_links).toEqual([{ label: 'Jaycar', url: '' }])
  })
})

describe('prices checked date', () => {
  it('shows nothing about prices for tools', () => {
    open([], [tool(1)])
    render(<ItemsSection noun="tools" />)
    expect(screen.queryByText('Prices checked')).toBeNull()
  })
})
