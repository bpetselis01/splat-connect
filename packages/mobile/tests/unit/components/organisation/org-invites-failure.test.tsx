// The invitations read is a secondary lookup on Account: when it rejects offline
// the card simply does not appear, and nothing reaches console.error.
// journeys: L31
import { render, screen, waitFor } from '@testing-library/react-native'
import { OrgInvites } from '../../../../components/organisation/org-invites'

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ refresh: jest.fn() }) }))

it('offline: renders nothing and does not console.error', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValue(new Error('Network request failed'))
  render(<OrgInvites />)
  await waitFor(() => expect(mockGet).toHaveBeenCalled())
  expect(screen.queryByText('Accept')).toBeNull()
  expect(errSpy).not.toHaveBeenCalled()
})
