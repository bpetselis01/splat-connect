// packages/mobile/components/ui/EmptyState.tsx
import { View, Text, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

/**
 * Empty states teach the screen rather than announcing absence, so `hint`
 * should say what to do next, not restate that the list is empty.
 */
export function EmptyState({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <Animated.View entering={FadeIn.duration(theme.motion.base)} style={styles.wrap}>
      <View style={styles.badge}>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: theme.spacing(10), paddingHorizontal: theme.spacing(6) },
  badge: {
    width: 72,
    height: 72,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
  },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
    textAlign: 'center',
  },
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing(2),
    lineHeight: 21,
    maxWidth: 300,
  },
})
