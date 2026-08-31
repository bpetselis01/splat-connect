import { render, screen } from '@testing-library/react-native'
import { Text, StyleSheet } from 'react-native'
import { Card } from '../../../../components/ui/Card'
import { theme } from '../../../../lib/theme'

it('a raised card is an ink-bordered box with a hard 4px shadow', () => {
  render(<Card testID="card"><Text>hi</Text></Card>)
  const style = StyleSheet.flatten(screen.getByTestId('card').props.style)
  expect(style.borderWidth).toBe(theme.border.thin)
  expect(style.borderColor).toBe(theme.colors.ink)
  expect(style.borderRadius).toBe(theme.radii.md)
  expect(style.shadowRadius).toBe(0)
  expect(style.shadowOffset).toEqual({ width: 4, height: 4 })
})
