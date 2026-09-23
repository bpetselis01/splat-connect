// packages/mobile/components/ui/BackButton.tsx
//
// The board's drill-down control: a 40px sunken disc with an arrow, left of a
// Baloo title (#guide_detail). nav-options.ts puts it on every stack, so a
// header looks the same whichever tab it was pushed from. CloseButton is the
// same disc with an ✕, for what is dismissed rather than gone back from.
import { Platform, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export function BackButton({
  onPress,
  label = 'Back',
  icon = 'arrow-back',
}: {
  /** Defaults to router.back(). */
  onPress?: () => void
  label?: string
  icon?: IconName
}) {
  const router = useRouter()
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.disc, Platform.OS === 'web' && styles.web, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={theme.colors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  disc: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: theme.motion.pressScale }] },
  // The native headers inset their left item and space the title from it;
  // the JS header react-native-web draws does neither.
  web: { marginLeft: theme.spacing(4), marginRight: 6 },
})
