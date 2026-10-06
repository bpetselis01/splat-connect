// packages/mobile/components/ui/CloseButton.tsx
//
// headerLeft for anything presented over the app rather than pushed into it.
// A modal or sheet is dismissed, not gone back from, so it gets an ✕ — and on a
// sheet it is the button half of a gesture the grabber already advertises.
// Same disc as BackButton, so the two read as one family.
import { useNavigationContainerRef, useRouter } from 'expo-router'
import { CommonActions } from 'expo-router/react-navigation'
import { BackButton } from './BackButton'
import { lastBarPath } from '../../lib/last-bar-path'
import { closedState, type NavState } from '../../lib/close-to-tabs'

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

/**
 * headerLeft for every pushed screen: one tap closes the whole trail and lands
 * on the last screen with the tab bar. One page back is the edge swipe, or
 * Android's Back.
 */
export function CloseToTabsButton({ beforeClose }: { beforeClose?: () => Promise<void> }) {
  const router = useRouter()
  const ref = useNavigationContainerRef()
  return (
    <BackButton
      label="Close"
      icon="close"
      onPress={() => {
        const close = () => {
          const next = closedState(ref.getRootState() as unknown as NavState, lastBarPath().slice(1))
          if (next) ref.dispatch(CommonActions.reset(next as unknown as Parameters<typeof CommonActions.reset>[0]))
          else router.replace(lastBarPath())
        }
        if (beforeClose) beforeClose().then(close)
        else close()
      }}
    />
  )
}
