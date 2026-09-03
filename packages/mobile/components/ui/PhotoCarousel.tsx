import { useState } from 'react'
import { View, Text, Image, StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'

/**
 * The five-photo carousel: drag follows the finger, then it settles on the
 * nearest photo.
 *
 * That behaviour is `pagingEnabled` — iOS already implements exactly the
 * gesture web had to hand-roll, with the platform's own deceleration, so there
 * is no pan handler here and no gesture dependency to add. Reanimated only
 * reads the scroll position, so each dot grows and fills as its photo arrives
 * rather than snapping once the page has already turned.
 *
 * Replaces PhotoStrip, a plain horizontal ScrollView of fixed-width tiles: a
 * strip is right for a row of things you are picking between, and wrong for
 * one object photographed five times.
 */
const DOT = 9

export function PhotoCarousel({
  urls,
  switchUrl,
  height = 220,
  emptyIcon = 'cube-outline',
}: {
  urls: string[]
  /** Which photo shows the accessibility switch, flagged as it comes past. */
  switchUrl?: string | null
  height?: number
  emptyIcon?: keyof typeof Ionicons.glyphMap
}) {
  const { width: screenWidth } = useWindowDimensions()
  // Measured rather than assumed: this sits inside padded screens as well as
  // full-bleed ones, and a page width that is not the frame's width scrolls to
  // a fraction of a photo every time.
  const [width, setWidth] = useState(screenWidth)
  const x = useSharedValue(0)

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x
  })

  if (urls.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Ionicons name={emptyIcon} size={48} color={theme.colors.primary} />
      </View>
    )
  }

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Animated.ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        // Only one photo: nothing to page between, so it should not rubber-band
        // as though there were something just off screen.
        scrollEnabled={urls.length > 1}
      >
        {urls.map((url) => (
          <View key={url} style={{ width, height }}>
            <Image source={{ uri: url }} style={styles.photo} />
            {switchUrl === url && (
              <View style={styles.flag}>
                <Text style={styles.flagText}>Shows the switch</Text>
              </View>
            )}
          </View>
        ))}
      </Animated.ScrollView>

      {urls.length > 1 && (
        <View style={styles.dots}>
          {urls.map((url, i) => (
            <Dot key={url} index={i} x={x} width={width} />
          ))}
        </View>
      )}
    </View>
  )
}

/**
 * Grows and fills as its photo arrives. Driven off the scroll offset rather
 * than an index, so the dot moves with the finger instead of snapping once the
 * page has already changed.
 */
function Dot({
  index,
  x,
  width,
}: {
  index: number
  x: SharedValue<number>
  width: number
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(x.value / width - index)
    return {
      transform: [
        { scale: interpolate(distance, [0, 1], [1.3, 1], Extrapolation.CLAMP) },
      ],
      backgroundColor:
        distance < 0.5 ? theme.colors.apricot : theme.colors.surface,
    } as ViewStyle
  })

  return <Animated.View style={[styles.dot, style]} />
}

const styles = StyleSheet.create({
  photo: { width: '100%', height: '100%' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
  },
  flag: {
    position: 'absolute',
    left: theme.spacing(3),
    top: theme.spacing(3),
    backgroundColor: theme.colors.mintSoft,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(2.5),
    paddingVertical: theme.spacing(0.5),
  },
  flagText: {
    fontFamily: theme.fonts.black,
    fontSize: 11,
    color: theme.colors.mintDeep,
    textTransform: 'uppercase',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing(2),
    paddingVertical: theme.spacing(3),
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
  },
})
