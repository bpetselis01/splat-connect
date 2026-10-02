import { localDate } from '../../../components/organisation/event-form-screen'

// The parser is pure; the screen's API and session modules are not needed to test it.
jest.mock('../../../lib/api-client', () => ({ apiClient: {} }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: jest.fn() }))

it('reads a typed date and time on the local clock, and refuses what Date would roll over', () => {
  const at = localDate('2026-10-18', '10:00')!
  expect([at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([2026, 9, 18, 10, 0])
  expect(localDate('2026-02-31', '10:00')).toBeNull()
  expect(localDate('2026-10-18', '25:00')).toBeNull()
  expect(localDate('2026-10-18', '10:75')).toBeNull()
  expect(localDate('18/10/2026', '10:00')).toBeNull()
  expect(localDate('2026-10-18', '')).toBeNull()
})
