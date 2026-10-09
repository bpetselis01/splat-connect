// Build time as a slider over BUILD_TIME_OPTIONS. The options are uneven
// (10, 15, 20, 30 ... 240 minutes), so the slider moves through their
// indices and each stop gets equal width. The value saves on release, not on
// every drag tick, so a drag is one autosave rather than dozens.
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { BUILD_TIME_OPTIONS, formatBuildTime } from '@splat-connect/types'
import { theme } from '../../lib/theme'

const LAST = BUILD_TIME_OPTIONS.length - 1

export function indexForMinutes(m: number | null): number | null {
  if (m == null) return null
  let best = 0
  BUILD_TIME_OPTIONS.forEach((opt, i) => {
    if (Math.abs(opt - m) < Math.abs(BUILD_TIME_OPTIONS[best] - m)) best = i
  })
  return best
}
export const minutesForIndex = (i: number) => BUILD_TIME_OPTIONS[Math.max(0, Math.min(LAST, Math.round(i)))]

const label = (m: number) => (m === BUILD_TIME_OPTIONS[LAST] ? '4 h or more' : formatBuildTime(m))

export function BuildTimeSlider({ value, onCommit }: { value: number | null; onCommit: (minutes: number) => void }) {
  const stored = indexForMinutes(value)
  const [drag, setDrag] = useState<number | null>(stored)
  useEffect(() => setDrag(stored), [stored])
  return (
    <View>
      <Text style={styles.value}>{drag == null ? 'Not set' : label(minutesForIndex(drag))}</Text>
      <Slider
        accessibilityLabel="Build time"
        minimumValue={0}
        maximumValue={LAST}
        step={1}
        value={drag ?? 0}
        minimumTrackTintColor={drag == null ? theme.colors.border : theme.colors.primary}
        maximumTrackTintColor={theme.colors.surfaceSunken}
        thumbTintColor={drag == null ? theme.colors.muted : theme.colors.primary}
        onValueChange={setDrag}
        onSlidingComplete={(i) => onCommit(minutesForIndex(i))}
      />
      <View style={styles.ends}>
        <Text style={styles.end}>{label(BUILD_TIME_OPTIONS[0])}</Text>
        <Text style={styles.end}>{label(BUILD_TIME_OPTIONS[LAST])}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  value: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink, marginBottom: theme.spacing(1) },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
