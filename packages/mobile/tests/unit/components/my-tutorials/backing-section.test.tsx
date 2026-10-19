import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { BackingSection } from '../../../../components/my-tutorials/sections/backing-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }) }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockDraft: { tutorial: { id: string; status: string; reviewed_for_org_id: string | null } } = {
  tutorial: { id: 't1', status: 'draft', reviewed_for_org_id: null },
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const orgs = [
  { id: 'o1', name: 'Northside Therapy', status: 'active', description: null },
  { id: 'o2', name: 'Riverside Makers', status: 'active', description: null },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) =>
    Promise.resolve(p === '/api/organizations' ? orgs : [{ id: 'b1', org_id: 'o1', status: 'pending', organizations: { id: 'o1', name: 'Northside Therapy' } }])
  )
  mockPost.mockResolvedValue({})
  mockDelete.mockResolvedValue(undefined)
})

it('T18 lists who was asked and asks another organisation', async () => {
  render(<BackingSection />)
  expect(await screen.findByText('Deciding')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Ask Riverside Makers' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/orgs', { org_id: 'o2' }))
})

it('T19 withdraws a request', async () => {
  render(<BackingSection />)
  fireEvent.press(await screen.findByRole('button', { name: 'Withdraw from Northside Therapy' }))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1/orgs/o1'))
})

it('is read-only once the guide is approved', async () => {
  mockDraft.tutorial = { id: 't1', status: 'approved', reviewed_for_org_id: 'o1' }
  render(<BackingSection />)
  await screen.findByText('Northside Therapy')
  expect(screen.queryByRole('button', { name: /Withdraw|Ask / })).toBeNull()
  mockDraft.tutorial = { id: 't1', status: 'draft', reviewed_for_org_id: null }
})

it('shows an error and retries, rather than offering Ask over an unseen list', async () => {
  mockGet.mockRejectedValueOnce(new Error('offline')).mockImplementation((p: string) => Promise.resolve(p === '/api/organizations' ? orgs : []))
  render(<BackingSection />)
  expect(await screen.findByText(/Could not load backing/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Ask / })).toBeNull()
  expect(screen.queryByText(/No organisation is backing/)).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText(/No organisation is backing/)).toBeTruthy()
})
