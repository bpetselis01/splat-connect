// journeys: G31
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ModelScreen } from '../../../../components/guides/model-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
const mockBack = jest.fn(); const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockSign = jest.fn()
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: (b: string) => ({ createSignedUrl: (...a: unknown[]) => mockSign(b, ...a) }) } } }))
const mockInject = jest.fn()
let onMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined
jest.mock('react-native-webview', () => {
  const React = require('react'); const { View } = require('react-native')
  const WebView = React.forwardRef((props: { onMessage?: typeof onMessage; source: { html: string } }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }))
    onMessage = props.onMessage
    return <View testID="webview" {...props} />
  })
  return { WebView }
})
jest.mock('../../../../lib/stl-viewer-html', () => ({ STL_VIEWER_HTML: '<html>viewer</html>' }))

const GUIDE = { id: 'g', title: 'Light Touch Switch', stl_files: [
  { id: 'f1', tutorial_id: 'g', filename: 'lts_base.stl', file_url: 'g/lts_base.stl', print_minutes: 55, filament_grams: 14, material: 'PLA' },
  { id: 'f2', tutorial_id: 'g', filename: 'lts_cap.stl', file_url: 'g/lts_cap.stl', print_minutes: null, filament_grams: null, material: null },
] }
const page = (m: object) => act(() => { onMessage?.({ nativeEvent: { data: JSON.stringify(m) } }) })

let webUrl: string | undefined
beforeEach(() => { webUrl = process.env.EXPO_PUBLIC_WEB_URL })
afterEach(() => { if (webUrl === undefined) delete process.env.EXPO_PUBLIC_WEB_URL; else process.env.EXPO_PUBLIC_WEB_URL = webUrl })
beforeEach(() => { jest.clearAllMocks(); mockGet.mockResolvedValue(GUIDE); mockSign.mockResolvedValue({ data: { signedUrl: 'https://s/signed.stl' }, error: null }) })

it('names the part, signs its path and loads it into the page once the page is ready', async () => {
  render(<ModelScreen id="g" file="f1" />)
  expect(await screen.findByText('Lts base · lts_base.stl')).toBeTruthy()
  expect(screen.getByText('55 min print')).toBeTruthy()
  expect(screen.getByText('14 g PLA')).toBeTruthy()
  expect(screen.getByText('1 of 2')).toBeTruthy()
  expect(screen.getByTestId('webview').props.source).toEqual({ html: '<html>viewer</html>' })
  await waitFor(() => expect(mockSign).toHaveBeenCalledWith('stl-files', 'g/lts_base.stl', 60))
  page({ type: 'ready' })
  await waitFor(() => expect(mockInject).toHaveBeenCalledWith(expect.stringContaining('window.__load("https://s/signed.stl", 26214400)')))
  expect(screen.getByText('Drag to turn · pinch to zoom')).toBeTruthy()
  page({ type: 'loaded' })
  expect(mockInject).toHaveBeenCalledTimes(1)
})

it('shows the error state with Retry when signing fails, and never injects', async () => {
  mockSign.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
  render(<ModelScreen id="g" file="f1" />)
  expect(await screen.findByText("Couldn't load this part.")).toBeTruthy()
  page({ type: 'ready' })
  expect(mockInject).not.toHaveBeenCalled()
  mockSign.mockResolvedValue({ data: { signedUrl: 'https://s/again.stl' }, error: null })
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(mockSign).toHaveBeenCalledTimes(2))
})

it('shows the error state when the page reports a failure', async () => {
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  page({ type: 'ready' })
  page({ type: 'error', message: 'HTTP 403' })
  expect(await screen.findByText("Couldn't load this part.")).toBeTruthy()
})

it('says when a part is too big to preview, with the web link', async () => {
  process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  page({ type: 'ready' })
  page({ type: 'toobig' })
  expect(await screen.findByText('This part is too big to preview on a phone.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Download on the web' })).toBeTruthy()
})

it('has no save, share or open-in-browser control', async () => {
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  expect(screen.queryByText(/Open in browser|Share|Save|Download/)).toBeNull()
})

it('✕ goes back; Ask someone to print opens the printer finder for this guide', async () => {
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  fireEvent.press(screen.getByRole('button', { name: 'Close 3D view' }))
  expect(mockBack).toHaveBeenCalled()
  mockBack.mockClear()
  fireEvent.press(screen.getByRole('button', { name: 'Ask someone to print' }))
  // The viewer is a fullScreenModal: a screen pushed from inside it opens
  // underneath on iOS, so it must close first (seen on a device, guide-page.yaml).
  expect(mockBack).toHaveBeenCalledTimes(1)
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing', params: { guide: 'g' } })
})

it('a file id the guide does not have shows not found', async () => {
  render(<ModelScreen id="g" file="nope" />)
  expect(await screen.findByText('This part is no longer on the guide.')).toBeTruthy()
})

it('Retry after an error reloads the page and injects only once it posts ready again', async () => {
  mockSign.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText("Couldn't load this part.")
  page({ type: 'ready' })
  mockSign.mockResolvedValue({ data: { signedUrl: 'https://s/new.stl' }, error: null })
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(mockSign).toHaveBeenCalledTimes(2))
  await screen.findByTestId('webview')
  expect(mockInject).not.toHaveBeenCalled()
  page({ type: 'ready' })
  await waitFor(() => expect(mockInject).toHaveBeenCalledWith(expect.stringContaining('https://s/new.stl')))
})

it('Retry refetches the guide when that fetch failed', async () => {
  mockGet.mockRejectedValueOnce(new Error('offline'))
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText("Couldn't load this part.")
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Lts base · lts_base.stl')).toBeTruthy()
})

it('a rejected signing call lands in the error state', async () => {
  mockSign.mockRejectedValue(new Error('network'))
  render(<ModelScreen id="g" file="f1" />)
  expect(await screen.findByText("Couldn't load this part.")).toBeTruthy()
})
