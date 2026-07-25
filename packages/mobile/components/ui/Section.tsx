// packages/mobile/components/ui/Section.tsx
import { View, Text, StyleSheet, type ViewProps } from 'react-native'
import { theme } from '../../lib/theme'
import { Card } from './Card'

/**
 * A titled group of related fields on a white surface.
 *
 * Grouping is what keeps these forms from reading as one undifferentiated
 * column of inputs — and grouping at the section level, rather than putting
 * every field in its own card, is what keeps them from reading as a card grid.
 */
export function Section({
  title,
  hint,
  children,
  style,
  ...rest
}: ViewProps & { title?: string; hint?: string }) {
  return (
    <View style={[styles.wrap, style]} {...rest}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <Card>{children}</Card>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing(6) },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    marginBottom: theme.spacing(1),
  },
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
    marginBottom: theme.spacing(3),
  },
})
