import { render, screen } from '@testing-library/react-native'
import { PreviewScreen } from '../../../../components/home/preview-screen'

jest.mock('react-native-webview', () => {
  const { View } = require('react-native')
  return { WebView: (props: { source: { uri: string } }) => <View testID="webview" {...props} /> }
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
})
