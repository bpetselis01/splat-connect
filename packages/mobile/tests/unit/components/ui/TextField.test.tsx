import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { interpolateColor } from 'react-native-reanimated'
import { TextField } from '../../../../components/ui/TextField'
import { theme } from '../../../../lib/theme'

it('a text field rests on an ink border', () => {
  render(<TextField boxTestID="box" placeholder="Search" />)
  const style = StyleSheet.flatten(screen.getByTestId('box').props.style)
  // The border colour is driven by an animated interpolation (rest → focus),
  // so the rest value is read the same way reanimated produces it.
  expect(style.borderColor).toBe(interpolateColor(0, [0, 1], [theme.colors.ink, theme.colors.primary]))
  expect(style.borderWidth).toBe(theme.border.thin)
})
