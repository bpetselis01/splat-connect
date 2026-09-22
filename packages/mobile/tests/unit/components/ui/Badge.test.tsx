import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Badge } from '../../../../components/ui/Badge'
import { theme } from '../../../../lib/theme'

it('maps a status to its tone and upcases the label', () => {
  render(<Badge status="approved" />)
  const t = screen.getByText('Approved')
  expect(StyleSheet.flatten(t.props.style).color).toBe(theme.colors.tone.mint.fg)
})

it('takes an explicit label for kinds', () => {
  render(<Badge status="assistive_tech" label="Assistive tech" />)
  expect(screen.getByText('Assistive tech')).toBeTruthy()
})
