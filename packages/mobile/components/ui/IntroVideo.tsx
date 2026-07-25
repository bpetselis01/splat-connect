import { useEffect, useRef } from 'react'
import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Pressable, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

const introSource = require('../../assets/splat-intro.mp4')

/**
 * Hard ceiling on how long the intro may hold the app. `playToEnd` is the happy
 * path, but it never fires if playback is blocked or the file fails to decode —
 * and because this view covers the whole app and swallows touches, that state
 * is an unrecoverable lockout rather than a cosmetic glitch.
 */
const MAX_INTRO_MS = 8000

export function IntroVideo({ onFinish }: { onFinish: () => void }) {
  const player = useVideoPlayer(introSource, (player) => {
    player.play()
  })

  // Held in a ref so the timeout below is armed once, rather than being reset
  // on every render by a caller passing a fresh inline callback.
  const finish = useRef(onFinish)
  finish.current = onFinish

  useEventListener(player, 'playToEnd', () => finish.current())
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') finish.current()
  })

  useEffect(() => {
    const timer = setTimeout(() => finish.current(), MAX_INTRO_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Pressable
      style={styles.video}
      onPress={() => finish.current()}
      accessibilityRole="button"
      accessibilityLabel="Skip intro"
    >
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        pointerEvents="none"
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.background,
  },
})
