// journeys: L31
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgInvites } from '../../../../components/organisation/org-invites'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
const mockRefresh = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ refresh: mockRefresh }) }))

beforeEach(() => jest.clearAllMocks())

describe('OrgInvites', () => {
  it('renders nothing without invitations', async () => {
    mockGet.mockResolvedValue([])
    render(<OrgInvites />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Accept')).toBeNull()
  })

  it('accepts an invitation and refreshes what the account leads', async () => {
    mockGet.mockResolvedValueOnce([{ id: 'i1', org_id: 'o1', org_name: 'Northbank' }]).mockResolvedValue([])
    mockPost.mockResolvedValue({ org_id: 'o1' })
    render(<OrgInvites />)
    fireEvent.press(await screen.findByText('Accept'))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledWith('/api/organizations/invites/i1/accept', {})
  })

  it('declines an invitation', async () => {
    mockGet.mockResolvedValueOnce([{ id: 'i1', org_id: 'o1', org_name: 'Northbank' }]).mockResolvedValue([])
    mockDelete.mockResolvedValue(undefined)
    render(<OrgInvites />)
    fireEvent.press(await screen.findByText('Decline'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/organizations/invites/i1'))
  })
})
