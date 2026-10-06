// packages/mobile/components/ui/HomeButton.tsx
//
// Option B of "getting home from anywhere" (2026-10-06): every screen without
// the tab bar carries this at the top right of its header, so Home is one tap
// away however deep the trail through guides, creators, organisations and
// toys has gone. nav-options.ts puts it on every stack; tab roots have no
// header, so it never doubles the tab bar's Home.
import { Platform, Pressable, Text, View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export function HomeButton() {
  const router = useRouter()
  return (
    <Pressable
      // navigate, not push: it unwinds to the Home tab that is already there.
      onPress={() => router.navigate('/home')}
      accessibilityRole="button"
      accessibilityLabel="Home"
      hitSlop={4}
      style={({ pressed }) => [styles.pill, Platform.OS === 'web' && styles.web, pressed && styles.pressed]}
    >
      <Ionicons name="home-outline" size={18} color={theme.colors.primaryDeep} />
      <Text style={styles.label}>Home</Text>
    </Pressable>
  )
}

/** A screen's own header button and Home, side by side. */
export function WithHome({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      {children}
      <HomeButton />
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
  },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  pressed: { transform: [{ scale: theme.motion.pressScale }] },
  // The JS header react-native-web draws does not inset its right item.
  web: { marginRight: theme.spacing(4) },
})
