// packages/mobile/components/ui/pending.tsx
//
// A control the board draws but the app cannot do yet. It looks like the
// real thing and opens Not built yet, which names the registry item
// (packages/types/src/pending.ts). The `pending` prop is how the drift test
// finds it — keep it a string literal.
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { PendingId } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Button } from './Button'

export const pendingHref = (id: PendingId) => ({ pathname: '/not-built' as const, params: { feature: id } })

export function PendingButton({
  pending,
  label,
  variant = 'secondary',
  style,
}: {
  pending: PendingId
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
}) {
  const router = useRouter()
  return <Button label={label} variant={variant} style={style} onPress={() => router.push(pendingHref(pending))} />
}

export function PendingRow({
  pending,
  label,
  icon,
}: {
  pending: PendingId
  label: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
}) {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(pendingHref(pending))}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={21} color={theme.colors.primaryDark} /> : null}
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 52,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  pressed: { transform: [{ scale: theme.motion.pressScale }] },
  label: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
})
