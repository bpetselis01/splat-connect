// journeys: G16 G17
import { Linking } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PreviewScreen } from '../../../../components/home/preview-screen'

jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return {
    WebView: (props: { source: { uri: string }; renderLoading?: () => React.ReactNode }) => (
      <View testID="webview" {...props}>{props.renderLoading?.()}</View>
    ),
  }
})

describe('PreviewScreen', () => {
  let webUrl: string | undefined
  beforeEach(() => { webUrl = process.env.EXPO_PUBLIC_WEB_URL })
  afterEach(() => { if (webUrl === undefined) delete process.env.EXPO_PUBLIC_WEB_URL; else process.env.EXPO_PUBLIC_WEB_URL = webUrl })
  it('renders a WebView with the given pdf url', () => {
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" tutorialId="abc" />)
    const webview = screen.getByTestId('webview')
    expect(webview.props.source).toEqual({ uri: 'https://example.com/robot-arm.pdf' })
  })

  it('shows a fallback message when pdfUrl is null', () => {
    render(<PreviewScreen pdfUrl={null} tutorialId="abc" />)
    expect(screen.getByText('No PDF is available for this tutorial yet.')).toBeTruthy()
  })

  it('the footer opens the guide on the website, never the file', () => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" tutorialId="abc" />)
    expect(screen.queryByText('Open in browser')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Download on the web' }))
    expect(open).toHaveBeenCalledWith('https://splat.example/tutorials/abc')
  })

  it('hides the web footer when no web address is configured', () => {
    delete process.env.EXPO_PUBLIC_WEB_URL
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" tutorialId="abc" />)
    expect(screen.queryByText('Download on the web')).toBeNull()
  })

  it('shows a spinner while the pages load', () => {
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" tutorialId="abc" />)
    expect(screen.getByTestId('webview').props.startInLoadingState).toBe(true)
    expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy()
  })
})
