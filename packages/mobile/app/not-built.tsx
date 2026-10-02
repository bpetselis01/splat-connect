// The board's "Not built yet" screen (SPLAT Connect - Mobile.dc.html, is_soon):
// a violet tile, the NOT BUILT YET pill, a title, one line, and a way back.
// Opened by a button whose feature is drawn but not switched on — the shared
// registry (packages/types/src/pending.ts) supplies the words. At the root, outside
// every gate, because sign-in buttons open it before anyone is signed in.
import { StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../lib/theme'
import { PENDING, isPendingId } from '@splat-connect/types'
import { pendingIcon } from '../lib/pending-icons'
import { Button } from '../components/ui/Button'
import { AuthStage, Heading, Lede, pill } from '../components/auth/parts'

export default function NotBuiltYet() {
  const router = useRouter()
  const { feature } = useLocalSearchParams<{ feature?: string }>()
  const item =
    feature && isPendingId(feature)
      ? { ...PENDING[feature], icon: pendingIcon(feature) }
      : { title: 'Not built yet', blurb: "This part of SPLAT Connect isn't ready yet.", icon: pendingIcon('') }

  return (
    <AuthStage back={false}>
      <View style={styles.tile}>
        <Ionicons name={item.icon} size={40} color={theme.colors.ink} />
      </View>
      <Text style={styles.pill}>Not built yet</Text>
      <Heading center>{item.title}</Heading>
      <Lede center>{item.blurb}</Lede>
      <Button testID="not-built-back" label="Go back" variant="secondary" style={pill} onPress={() => router.back()} />
    </AuthStage>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: theme.colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    ...theme.shadow(2),
  },
  pill: {
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    overflow: 'hidden',
  },
})
