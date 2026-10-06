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
  it('renders a WebView with the given pdf url', () => {
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" />)
    const webview = screen.getByTestId('webview')
    expect(webview.props.source).toEqual({ uri: 'https://example.com/robot-arm.pdf' })
  })

  it('shows a fallback message when pdfUrl is null', () => {
    render(<PreviewScreen pdfUrl={null} />)
    expect(screen.getByText('No PDF is available for this tutorial yet.')).toBeTruthy()
  })

  it('opens the pdf in the system browser', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" />)
    fireEvent.press(screen.getByText('Open in browser'))
    expect(open).toHaveBeenCalledWith('https://example.com/robot-arm.pdf')
  })

  it('shows a spinner while the pages load', () => {
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" />)
    expect(screen.getByTestId('webview').props.startInLoadingState).toBe(true)
    expect(screen.UNSAFE_getByType(require('react-native').ActivityIndicator)).toBeTruthy()
  })

  it('offers no Open in browser when there is no pdf', () => {
    render(<PreviewScreen pdfUrl={null} />)
    expect(screen.queryByText('Open in browser')).toBeNull()
  })
})
