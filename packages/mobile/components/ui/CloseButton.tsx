// packages/mobile/components/ui/CloseButton.tsx
//
// headerLeft for anything presented over the app rather than pushed into it.
// A modal or sheet is dismissed, not gone back from, so it gets an ✕ — and on a
// sheet it is the button half of a gesture the grabber already advertises.
import { Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

export function CloseButton() {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.dismiss())}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
    >
      <Ionicons name="close" size={24} color={theme.colors.ink} />
    </Pressable>
  )
}
