import { render, screen } from '@testing-library/react-native'
import { Text, StyleSheet } from 'react-native'
import { Card } from '../../../../components/ui/Card'
import { theme } from '../../../../lib/theme'

/*
 * Why: a card is where the two systems differ most. Pixel drew a 2px ink border
 * and a zero-blur 4px offset; Soft Pop draws a hairline in --line and lets a
 * blurred elevation do the separating. The border survives for high contrast,
 * where every elevation is none and the edge is all there is.
 */
it('a raised card is a hairline box separated by elevation', () => {
  render(<Card testID="card"><Text>hi</Text></Card>)
  const style = StyleSheet.flatten(screen.getByTestId('card').props.style)
  expect(style.borderWidth).toBe(theme.border.hairline)
  expect(style.borderColor).toBe(theme.colors.border)
  expect(style.borderRadius).toBe(theme.radii.card)
  expect(style.shadowRadius).toBeGreaterThan(0)
  expect(style.shadowOffset).toEqual({ width: 0, height: 4 })
})

it('a feature card sits one rung deeper', () => {
  render(<Card testID="card" variant="feature"><Text>hi</Text></Card>)
  const style = StyleSheet.flatten(screen.getByTestId('card').props.style)
  expect(style.backgroundColor).toBe(theme.colors.accentLight)
  expect(style.shadowRadius).toBeGreaterThan(theme.shadow(2).shadowRadius)
})
