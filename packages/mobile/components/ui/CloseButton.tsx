// packages/mobile/components/ui/CloseButton.tsx
//
// headerLeft for anything presented over the app rather than pushed into it.
// A modal or sheet is dismissed, not gone back from, so it gets an ✕ — and on a
// sheet it is the button half of a gesture the grabber already advertises.
// Same disc as BackButton, so the two read as one family.
import { useRouter } from 'expo-router'
import { BackButton } from './BackButton'

export function CloseButton() {
  const router = useRouter()
  return (
    <BackButton
      label="Close"
      icon="close"
      onPress={() => (router.canGoBack() ? router.back() : router.dismiss())}
    />
  )
}
