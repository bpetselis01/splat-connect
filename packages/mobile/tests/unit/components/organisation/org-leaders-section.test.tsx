import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgLeadersSection } from '../../../../components/organisation/org-leaders-section'

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

const me = { user_id: 'u1', name: 'Sam', email: 'sam@example.com', you: true }
const priya = { user_id: 'u2', name: 'Priya', email: 'priya@example.com', you: false }

beforeEach(() => jest.clearAllMocks())

describe('OrgLeadersSection', () => {
  it('hides Step down while you are the only leader', async () => {
    mockGet.mockResolvedValue({ leaders: [me], invites: [] })
    render(<OrgLeadersSection orgId="o1" />)
    expect(await screen.findByText('Sam (you)')).toBeTruthy()
    expect(screen.queryByText('Step down as leader')).toBeNull()
  })

  it('L25 invites a co-leader by email and shows the API refusal in words', async () => {
    mockGet.mockResolvedValue({ leaders: [me], invites: [] })
    mockPost.mockRejectedValueOnce(new Error('API POST /x failed with status 404: No SPLAT account uses that email. Ask them to sign up first.'))
    render(<OrgLeadersSection orgId="o1" />)
    fireEvent.changeText(await screen.findByLabelText('Invite a leader'), 'who@example.com')
    fireEvent.press(screen.getByText('Send invitation'))
    expect(await screen.findByText('No SPLAT account uses that email. Ask them to sign up first.')).toBeTruthy()

    mockPost.mockResolvedValueOnce({ ok: true })
    mockGet.mockResolvedValue({ leaders: [me], invites: [{ id: 'i1', name: 'Priya', email: 'priya@example.com' }] })
    fireEvent.changeText(screen.getByLabelText('Invite a leader'), 'priya@example.com')
    fireEvent.press(screen.getByText('Send invitation'))
    expect(await screen.findByText('Priya · invited')).toBeTruthy()
    expect(mockPost).toHaveBeenLastCalledWith('/api/organizations/o1/leaders', { email: 'priya@example.com' })
  })

  it('L27 steps down once someone else leads', async () => {
    mockGet.mockResolvedValue({ leaders: [me, priya], invites: [] })
    mockDelete.mockResolvedValue(undefined)
    const onSteppedDown = jest.fn()
    render(<OrgLeadersSection orgId="o1" onSteppedDown={onSteppedDown} />)
    fireEvent.press(await screen.findByText('Step down as leader'))
    await waitFor(() => expect(onSteppedDown).toHaveBeenCalled())
    expect(mockDelete).toHaveBeenCalledWith('/api/organizations/o1/leaders/me')
  })

  it('L26 cancels an invitation and reloads without it', async () => {
    mockGet.mockResolvedValueOnce({ leaders: [me], invites: [{ id: 'i1', name: 'Priya', email: 'priya@example.com' }] })
    mockDelete.mockResolvedValue(undefined)
    render(<OrgLeadersSection orgId="o1" />)
    expect(await screen.findByText('Priya · invited')).toBeTruthy()
    mockGet.mockResolvedValue({ leaders: [me], invites: [] })
    fireEvent.press(screen.getByText('Cancel invitation'))
    await waitFor(() => expect(screen.queryByText('Priya · invited')).toBeNull())
    expect(mockDelete).toHaveBeenCalledWith('/api/organizations/o1/leaders/invites/i1')
  })
})
