// packages/mobile/tests/unit/app/admin.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import MyAdmin from '../../../app/(my)/admin'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

describe('MyAdmin', () => {
  it("opens each of web's five admin surfaces on the web", () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<MyAdmin />)

    for (const [label, path] of [
      ['Contributors', '/admin/contributors'],
      ['Review queue', '/admin/review'],
      ['Organisations', '/admin/organizations'],
      ['Spot check', '/admin/spot-check'],
      ['Ideas', '/admin/ideas'],
    ] as const) {
      fireEvent.press(screen.getByRole('button', { name: label }))
      expect(open).toHaveBeenCalledWith(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
    }
    open.mockRestore()
  })
})
