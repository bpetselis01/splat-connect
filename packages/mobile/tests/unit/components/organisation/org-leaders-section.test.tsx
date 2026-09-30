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
    mockGet.mockResolvedValue([me])
    render(<OrgLeadersSection orgId="o1" />)
    expect(await screen.findByText('Sam (you)')).toBeTruthy()
    expect(screen.queryByText('Step down as leader')).toBeNull()
  })

  it('adds a co-leader by email and shows the API refusal in words', async () => {
    mockGet.mockResolvedValue([me])
    mockPost.mockRejectedValueOnce(new Error('API POST /x failed with status 404: No SPLAT account uses that email. Ask them to sign up first.'))
    render(<OrgLeadersSection orgId="o1" />)
    fireEvent.changeText(await screen.findByLabelText('Add a leader'), 'who@example.com')
    fireEvent.press(screen.getByText('Add leader'))
    expect(await screen.findByText('No SPLAT account uses that email. Ask them to sign up first.')).toBeTruthy()

    mockPost.mockResolvedValueOnce({ ok: true })
    mockGet.mockResolvedValue([me, priya])
    fireEvent.changeText(screen.getByLabelText('Add a leader'), 'priya@example.com')
    fireEvent.press(screen.getByText('Add leader'))
    expect(await screen.findByText('Priya')).toBeTruthy()
    expect(mockPost).toHaveBeenLastCalledWith('/api/organizations/o1/leaders', { email: 'priya@example.com' })
  })

  it('steps down once someone else leads', async () => {
    mockGet.mockResolvedValue([me, priya])
    mockDelete.mockResolvedValue(undefined)
    const onSteppedDown = jest.fn()
    render(<OrgLeadersSection orgId="o1" onSteppedDown={onSteppedDown} />)
    fireEvent.press(await screen.findByText('Step down as leader'))
    await waitFor(() => expect(onSteppedDown).toHaveBeenCalled())
    expect(mockDelete).toHaveBeenCalledWith('/api/organizations/o1/leaders/me')
  })
})
