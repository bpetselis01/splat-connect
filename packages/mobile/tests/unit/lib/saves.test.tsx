import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useSaves } from '../../../lib/saves'

const mockGet = jest.fn(); const mockPost = jest.fn(); const mockDelete = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: {
  get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a),
}}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ tutorials: ['t1'], toys: [], challenges: [] })
  mockPost.mockResolvedValue({}); mockDelete.mockResolvedValue({})
})

it('loads ids and toggles optimistically', async () => {
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 't2') })
  expect(result.current.isSaved('tutorials', 't2')).toBe(true)
  expect(mockPost).toHaveBeenCalledWith('/api/saves', { entity_type: 'tutorial', entity_id: 't2' })
  await act(async () => { await result.current.toggle('tutorials', 't1') })
  expect(result.current.isSaved('tutorials', 't1')).toBe(false)
  expect(mockDelete).toHaveBeenCalledWith('/api/saves/tutorials/t1')
})

it('reverts the optimistic flip when the API fails', async () => {
  mockPost.mockRejectedValue(new Error('down'))
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 't9') })
  expect(result.current.isSaved('tutorials', 't9')).toBe(false)
})

it('back-to-back toggles pick opposite verbs from the ref', async () => {
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => {
    const p1 = result.current.toggle('tutorials', 'tx')
    const p2 = result.current.toggle('tutorials', 'tx')
    await Promise.all([p1, p2])
  })
  // First toggle: tx not saved, posts. Second toggle: tx now saved (from first), deletes.
  expect(mockPost).toHaveBeenCalledWith('/api/saves', { entity_type: 'tutorial', entity_id: 'tx' })
  expect(mockDelete).toHaveBeenCalledWith('/api/saves/tutorials/tx')
  expect(result.current.isSaved('tutorials', 'tx')).toBe(false)
})
