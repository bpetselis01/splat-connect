// journeys: T20
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CollaboratorsSection } from '../../../../components/my-tutorials/sections/collaborators-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }) }))
jest.mock('../../../../components/my-tutorials/section-footer', () => ({ SectionFooter: () => null }))
jest.mock('../../../../components/my-tutorials/sections/draft-gate', () => ({ DraftGate: ({ children }: any) => children() }))

const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
const mockReload = jest.fn()
const mockDraft: { tutorial: any; reload: jest.Mock } = { tutorial: null, reload: mockReload }
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))
let mockViewer = 'a'
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { profile: { id: mockViewer } } }) }))

const profile = (id: string, name: string) => ({ id, name })
const owner = { profile_id: 'a', role: 'primary', profiles: profile('a', 'Ada') }
const member = { profile_id: 'b', role: 'collaborator', profiles: profile('b', 'Bo') }

function setDraft(contributors: unknown[], viewer: string) {
  mockViewer = viewer
  mockDraft.tutorial = { id: 't1', tutorial_contributors: contributors, tutorial_collaborator_invites: [] }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPost.mockResolvedValue({})
  mockDelete.mockResolvedValue(undefined)
})

it('lists the team, and the owner can invite by email', async () => {
  setDraft([owner], 'a')
  render(<CollaboratorsSection />)
  expect(screen.getByText('Ada')).toBeTruthy()
  expect(screen.getByText('OWNER')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Their email'), 'bo@example.com')
  fireEvent.press(screen.getByText('Invite'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/collaborators/invite', { email: 'bo@example.com' }))
  expect(mockReload).toHaveBeenCalled()
})

it('shows the API error when the email has no account', async () => {
  mockPost.mockRejectedValueOnce(new Error('Request failed with status 404: No account found with that email'))
  setDraft([owner], 'a')
  render(<CollaboratorsSection />)
  fireEvent.changeText(screen.getByLabelText('Their email'), 'nobody@example.com')
  fireEvent.press(screen.getByText('Invite'))
  await waitFor(() => expect(screen.getByText(/No account found/)).toBeTruthy())
  expect(mockReload).not.toHaveBeenCalled()
})

it('lets the owner remove a member, and a member leave', async () => {
  setDraft([owner, member], 'a')
  const view = render(<CollaboratorsSection />)
  fireEvent.press(screen.getByLabelText('Remove Bo'))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1/collaborators/b'))
  await waitFor(() => expect(mockReload).toHaveBeenCalled())
  expect(mockReplace).not.toHaveBeenCalled()
  view.unmount()

  mockDelete.mockClear()
  setDraft([owner, member], 'b')
  render(<CollaboratorsSection />)
  expect(screen.queryByLabelText('Remove Ada')).toBeNull()
  mockReload.mockClear()
  fireEvent.press(screen.getByText('Leave'))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1/collaborators/b'))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tutorials'))
  expect(mockReload).not.toHaveBeenCalled()
})

it('hides the invite box from a non-owner', () => {
  setDraft([owner, member], 'b')
  render(<CollaboratorsSection />)
  expect(screen.queryByLabelText('Their email')).toBeNull()
})
