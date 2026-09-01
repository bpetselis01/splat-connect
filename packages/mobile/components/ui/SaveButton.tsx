import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { SaveSlug } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import type { Saves } from '../../lib/saves'

export function SaveButton({ slug, id, saves, size = 20 }: { slug: SaveSlug; id: string; saves: Saves; size?: number }) {
  const on = saves.isSaved(slug, id)
  return (
    <Pressable
      onPress={() => {
        // Success notification on save, plain light impact on unsave — putting
        // something on the shelf is the moment worth celebrating.
        ;(on
          ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        ).catch(() => {})
        saves.toggle(slug, id)
      }}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Saved' : 'Save'}
      hitSlop={10}
      style={styles.button}
    >
      <Ionicons name={on ? 'bookmark' : 'bookmark-outline'} size={size} color={on ? theme.colors.apricot : theme.colors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({ button: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' } })
