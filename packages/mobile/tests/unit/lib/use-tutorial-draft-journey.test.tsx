import { Text } from 'react-native'
import { render, screen, act, waitFor } from '@testing-library/react-native'
import { TutorialDraftProvider, useDraft, type TutorialDraft } from '../../../lib/use-tutorial-draft'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    put: (...a: unknown[]) => mockPut(...a),
    delete: jest.fn(),
  },
}))

const loaded = {
  id: 't1', title: 'A guide', kind: 'toy_adaptation', difficulty: 'easy', status: 'draft', updated_at: 'v1',
  parts: [], tools: [], stl_files: [], steps: [], safety_notes: [], tutorial_contributors: [], tutorial_recommendations: [],
}

let draft: TutorialDraft
function Probe() {
  draft = useDraft()
  return <Text>{draft.tutorial?.title ?? 'none'}</Text>
}
const mount = () => render(<TutorialDraftProvider id="t1"><Probe /></TutorialDraftProvider>)
const ready = async () => { mount(); await waitFor(() => expect(draft.tutorial).toBeTruthy()) }
const tick = (ms = 250) => act(async () => { jest.advanceTimersByTime(ms) })

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGet.mockResolvedValue(loaded)
  mockPatch.mockImplementation((_u: string, body: Record<string, unknown>) => Promise.resolve({ ...loaded, ...body, updated_at: `v${mockPatch.mock.calls.length + 1}` }))
  mockPost.mockResolvedValue([])
  mockPut.mockResolvedValue([])
})
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks() })

describe('retrying after a failed save', () => {
  it('sends the failed edit again on the next flush', async () => {
    await ready()
    mockPatch.mockRejectedValueOnce(new Error('503'))
    act(() => draft.save({ title: 'Kept' }))
    await tick()
    expect(draft.saveState).toBe('error')
    await act(async () => { await draft.flush() })
    expect(mockPatch).toHaveBeenCalledTimes(2)
    expect(mockPatch).toHaveBeenLastCalledWith('/api/tutorials/t1', { title: 'Kept', updated_at: 'v1' })
    expect(draft.saveState).toBe('saved')
  })

  it('does not lose a failed edit when the contributor goes on to edit a different field', async () => {
    await ready()
    mockPatch.mockRejectedValueOnce(new Error('offline'))
    act(() => draft.save({ title: 'Lost?' }))
    await tick()
    act(() => draft.save({ description: 'Next field' }))
    await tick()
    expect(mockPatch).toHaveBeenLastCalledWith('/api/tutorials/t1', { title: 'Lost?', description: 'Next field', updated_at: 'v1' })
  })

  it('lets a newer value for the same field beat the one that failed', async () => {
    await ready()
    mockPatch.mockRejectedValueOnce(new Error('offline'))
    act(() => draft.save({ title: 'Old' }))
    await tick()
    act(() => draft.save({ title: 'New' }))
    await tick()
    expect(mockPatch).toHaveBeenLastCalledWith('/api/tutorials/t1', { title: 'New', updated_at: 'v1' })
  })

  it.each([408, 429, 500, 503])('re-sends an edit the server failed with %i', async (status) => {
    await ready()
    mockPatch.mockRejectedValueOnce(Object.assign(new Error('x'), { status }))
    act(() => draft.save({ title: 'Again' }))
    await tick()
    await act(async () => { await draft.flush() })
    expect(mockPatch).toHaveBeenCalledTimes(2)
  })

  it.each([400, 403, 409, 422])('does not re-send an edit the server refused with %i, which would fail every later save', async (status) => {
    await ready()
    mockPatch.mockRejectedValueOnce(Object.assign(new Error('refused'), { status }))
    act(() => draft.save({ age_max: 99 }))
    await tick()
    act(() => draft.save({ title: 'Fine' }))
    await tick()
    expect(mockPatch).toHaveBeenLastCalledWith('/api/tutorials/t1', { title: 'Fine', updated_at: 'v1' })
    expect(draft.saveState).toBe('saved')
  })

  it('does not slip a failed Submit into a later edit', async () => {
    await ready()
    mockPatch.mockRejectedValueOnce(new Error('400'))
    await act(async () => { await draft.saveNow({ status: 'pending' }) })
    expect(draft.saveState).toBe('error')
    act(() => draft.save({ title: 'Tweak' }))
    await tick()
    expect(mockPatch).toHaveBeenLastCalledWith('/api/tutorials/t1', { title: 'Tweak', updated_at: 'v1' })
  })

  it('sends a failed step list again, and steps that never ran behind a failed parts write', async () => {
    await ready()
    mockPost.mockRejectedValueOnce(new Error('500'))
    act(() => {
      draft.replaceItems('parts', [{ name: 'Switch', is_optional: false, buy_links: [] }])
      draft.replaceSteps([{ title: null, body: 'Open it', photo_url: null }])
    })
    await tick()
    expect(mockPut).not.toHaveBeenCalled()
    await act(async () => { await draft.flush() })
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(mockPut).toHaveBeenCalledWith('/api/tutorials/t1/steps', { steps: [{ title: null, body: 'Open it', photo_url: null, tip: null, minutes: null }] })
  })

  it('goes error then saving then saved on a retry, and clears the message', async () => {
    await ready()
    mockPatch.mockRejectedValueOnce(new Error('503'))
    act(() => draft.save({ title: 'A' }))
    await tick()
    expect(draft.saveError).toBeTruthy()
    act(() => draft.save({ title: 'B' }))
    await tick()
    expect(draft.saveState).toBe('saved')
    expect(draft.saveError).toBeNull()
  })
})

describe('save state and ordering', () => {
  it('shows Saved, then goes quiet after two seconds', async () => {
    await ready()
    act(() => draft.save({ title: 'A' }))
    await tick()
    expect(draft.saveState).toBe('saved')
    await tick(1999)
    expect(draft.saveState).toBe('saved')
    await tick(1)
    expect(draft.saveState).toBe('idle')
  })

  it('sends nothing when there is nothing pending', async () => {
    await ready()
    await act(async () => { await draft.flush() })
    expect(mockPatch).not.toHaveBeenCalled()
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPut).not.toHaveBeenCalled()
    expect(draft.saveState).toBe('idle')
  })

  it('a save made while another is in flight waits and quotes the token the first returned', async () => {
    await ready()
    let finish!: (v: unknown) => void
    mockPatch.mockReturnValueOnce(new Promise((r) => { finish = r }))
    act(() => draft.save({ title: 'One' }))
    await tick()
    act(() => draft.save({ title: 'Two' }))
    await tick()
    expect(mockPatch).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ ...loaded, title: 'One', updated_at: 'v2' }) })
    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(2))
    expect(mockPatch).toHaveBeenLastCalledWith('/api/tutorials/t1', { title: 'Two', updated_at: 'v2' })
  })

  it('an edit made before the guide has loaded is sent after it, with the loaded token', async () => {
    let load!: (v: unknown) => void
    mockGet.mockReturnValue(new Promise((r) => { load = r }))
    mount()
    act(() => draft.save({ title: 'Early' }))
    await tick()
    expect(mockPatch).not.toHaveBeenCalled()
    await act(async () => { load({ ...loaded, updated_at: 'v7' }) })
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', { title: 'Early', updated_at: 'v7' })
  })

  it('stops re-queueing once the server has answered pending', async () => {
    mockGet.mockResolvedValue({ ...loaded, status: 'approved' })
    await ready()
    mockPatch.mockResolvedValueOnce({ ...loaded, status: 'pending', updated_at: 'v2' })
    act(() => draft.save({ title: 'A' }))
    await tick()
    act(() => draft.save({ title: 'B' }))
    await tick()
    expect(mockPatch).toHaveBeenNthCalledWith(1, '/api/tutorials/t1', { title: 'A', updated_at: 'v1', status: 'pending' })
    expect(mockPatch).toHaveBeenNthCalledWith(2, '/api/tutorials/t1', { title: 'B', updated_at: 'v2' })
  })

  it('writes fields, then parts, then steps, then safety notes in one drain', async () => {
    await ready()
    const order: string[] = []
    mockPatch.mockImplementation(() => { order.push('patch'); return Promise.resolve({ ...loaded, updated_at: 'v2' }) })
    mockPost.mockImplementation((u: string) => { order.push(u.split('/').pop()!); return Promise.resolve([]) })
    mockPut.mockImplementation(() => { order.push('steps'); return Promise.resolve([]) })
    act(() => {
      draft.replaceSafetyNotes([{ title: 'Hot', detail: null }])
      draft.replaceSteps([{ title: null, body: 'x', photo_url: null }])
      draft.replaceItems('parts', [{ name: 'p', is_optional: false, buy_links: [] }])
      draft.replaceItems('tools', [{ name: 't', is_optional: false, buy_links: [] }])
      draft.save({ title: 'T' })
    })
    await tick()
    expect(order).toEqual(['patch', 'parts', 'tools', 'steps', 'safety-notes'])
  })

  it('saveNow resolves after the write and never throws, leaving the error on the draft', async () => {
    await ready()
    mockPatch.mockRejectedValueOnce(new Error('500'))
    await act(async () => { await expect(draft.saveNow({ photo_urls: ['a.jpg'] })).resolves.toBeUndefined() })
    expect(draft.saveState).toBe('error')
    expect(draft.tutorial?.title).toBe('A guide')
  })
})

describe('steps, parts and safety notes as sent', () => {
  it('sends an empty list when every step is removed', async () => {
    await ready()
    act(() => draft.replaceSteps([]))
    await tick()
    expect(mockPut).toHaveBeenCalledWith('/api/tutorials/t1/steps', { steps: [] })
  })

  it('drops all-blank steps but keeps the order of the rest, for 150 steps', async () => {
    await ready()
    const rows = Array.from({ length: 150 }, (_, i) => ({ title: i % 3 === 0 ? `  T${i} ` : '', body: i % 10 === 0 ? '   ' : `Body ${i}`, photo_url: i % 2 ? `p${i}.jpg` : null }))
    act(() => draft.replaceSteps(rows))
    await tick()
    const sent = mockPut.mock.calls[0][1].steps as { title: string | null; body: string }[]
    expect(sent).toHaveLength(150 - 15)
    expect(sent.map((s) => s.body)).toEqual(rows.filter((r) => r.body.trim()).map((r) => r.body))
    expect(sent.find((s) => s.body === 'Body 3')!.title).toBe('T3')
    expect(sent.find((s) => s.body === 'Body 1')!.title).toBeNull()
  })

  it('keeps emoji, quotes, markup and a 5000-character body as typed', async () => {
    await ready()
    const body = `🧸 "grip" <tight> & 'twist' ${'x'.repeat(5000)}`
    act(() => draft.replaceSteps([{ title: '🧸 <1> & "2"', body, photo_url: null }]))
    await tick()
    expect(mockPut.mock.calls[0][1].steps[0]).toEqual({ title: '🧸 <1> & "2"', body, photo_url: null, tip: null, minutes: null })
  })

  it('keeps leading and trailing whitespace inside a step body', async () => {
    await ready()
    act(() => draft.replaceSteps([{ title: null, body: '  indented\n', photo_url: null }]))
    await tick()
    expect(mockPut.mock.calls[0][1].steps[0].body).toBe('  indented\n')
  })

  it('defaults a part’s quantity to 1, carries its price and drops links with no address', async () => {
    await ready()
    act(() =>
      draft.replaceItems('parts', [
        { name: 'Switch', is_optional: true, price_cents: 1250, buy_links: [{ label: 'a', url: ' ' }, { label: 'b', url: 'https://x.test' }] as never },
        { name: 'Jack', quantity: 0, is_optional: false, buy_links: [] },
      ])
    )
    await tick()
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/parts', {
      parts: [
        { name: 'Switch', quantity: 1, is_optional: true, buy_links: [{ label: 'b', url: 'https://x.test' }], price_cents: 1250 },
        { name: 'Jack', quantity: 0, is_optional: false, buy_links: [], price_cents: null },
      ],
    })
  })

  it('posts an empty parts list when every row is blank', async () => {
    await ready()
    act(() => draft.replaceItems('parts', [{ name: '', is_optional: false, buy_links: [] }, { name: '\t', is_optional: false, buy_links: [] }]))
    await tick()
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/parts', { parts: [] })
    expect(draft.tutorial?.parts).toEqual([])
  })

  it('posts only the safety notes that have a title, keeping a null detail', async () => {
    await ready()
    act(() => draft.replaceSafetyNotes([{ title: 'Hot glue', detail: null }, { title: '  ', detail: 'orphan detail' }, { title: 'Small parts', detail: 'Under 3' }]))
    await tick()
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/safety-notes', {
      safety_notes: [{ title: 'Hot glue', detail: null }, { title: 'Small parts', detail: 'Under 3' }],
    })
  })

  it('shows an edit on screen straight away, before the debounce fires', async () => {
    await ready()
    act(() => draft.save({ title: '🧸 <b>"Big"</b> & more '.repeat(20) }))
    expect(draft.tutorial?.title).toContain('🧸')
    expect(mockPatch).not.toHaveBeenCalled()
  })
})

describe('loading', () => {
  it('fetches again on reload after a failure and clears the error', async () => {
    mockGet.mockRejectedValueOnce(new Error('offline'))
    mount()
    await waitFor(() => expect(draft.loadError).toBe(true))
    act(() => draft.reload())
    await waitFor(() => expect(draft.tutorial?.title).toBe('A guide'))
    expect(draft.loadError).toBe(false)
    expect(mockGet).toHaveBeenCalledTimes(2)
  })

  it('useDraft refuses to run outside a provider', () => {
    function Bare() { useDraft(); return null }
    expect(() => render(<Bare />)).toThrow('useDraft must be used inside a TutorialDraftProvider')
  })
})
