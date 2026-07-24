import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

const introSource = require('../../assets/splat-intro.mp4')

export function IntroVideo({ onFinish }: { onFinish: () => void }) {
  const player = useVideoPlayer(introSource, (player) => {
    player.play()
  })

  useEventListener(player, 'playToEnd', onFinish)

  return (
    <VideoView
      style={styles.video}
      player={player}
      contentFit="cover"
      nativeControls={false}
    />
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
