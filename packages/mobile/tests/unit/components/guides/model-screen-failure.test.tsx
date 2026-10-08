// A failed guide load says so, retries on Try again, and never hits console.error.
// journeys: G31
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ModelScreen } from '../../../../components/guides/model-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://s/x.stl' }, error: null }) }) } },
}))
jest.mock('react-native-webview', () => {
  const React = require('react'); const { View } = require('react-native')
  return { WebView: React.forwardRef((props: object, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }))
    return <View testID="webview" {...props} />
  }) }
})
jest.mock('../../../../lib/stl-viewer-html', () => ({ STL_VIEWER_HTML: '<html>viewer</html>' }))

it('offline: says so, Try again re-fetches and shows the part', async () => {
  const errSpy = jest.spyOn(console, 'error')
  mockGet.mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValue({
    stl_files: [{ id: 'f1', tutorial_id: 'g', filename: 'lts_base.stl', file_url: 'g/lts_base.stl', print_minutes: 55, filament_grams: 14, material: 'PLA' }],
  })
  render(<ModelScreen id="g" file="f1" />)
  expect(await screen.findByText('You seem to be offline.')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Lts base · lts_base.stl')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledTimes(2)
  expect(errSpy).not.toHaveBeenCalled()
})
