// Closing the printer finder opened from a guide pops back to that guide; the
// tab-reset ✕ rebuilt the stack and flashed white first.
import { finderIndexOptions } from '../../../app/printing/_layout'

jest.mock('expo-router', () => ({ Redirect: () => null, Stack: Object.assign(() => null, { Screen: () => null }), useRouter: () => ({}) }))
jest.mock('../../../lib/use-auth-gate', () => ({ useAuthGate: () => 'ok' }))
jest.mock('../../../components/ui/CloseButton', () => ({ CloseButton: () => null }))

it('G31 from a guide the finder gets a pop-back close; otherwise the default tab-reset one', () => {
  expect(finderIndexOptions({ guide: 'g' }).headerLeft).toBeInstanceOf(Function)
  expect('headerLeft' in finderIndexOptions({})).toBe(false)
  expect('headerLeft' in finderIndexOptions(undefined)).toBe(false)
})
