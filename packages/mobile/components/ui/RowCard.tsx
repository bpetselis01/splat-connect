// packages/mobile/components/ui/RowCard.tsx
//
// The board's row card, shared by Guides and the Toy library "so the two tabs
// read as one app": a 96px tile (the photo, or a tinted glyph), pills, a
// title, one line of meta, and a heart on the right.
//
// The heart is a sibling of the pressable, never a child — a nested Pressable
// would fight the row's own press target for the touch.
import type { ReactNode } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from './AnimatedPressable'

type IconName = React.ComponentProps<typeof Ionicons>['name']

export function RowCard({
  title,
  photo,
  icon,
  tint,
  pills,
  meta,
  aside,
  onPress,
  accessibilityHint,
}: {
  title: string
  photo?: string | null
  /** The glyph drawn on the tile when there is no photo. */
  icon: IconName
  tint: string
  pills?: ReactNode
  meta?: ReactNode
  /** Top-right, outside the press target: the save heart. */
  aside?: ReactNode
  onPress: () => void
  accessibilityHint?: string
}) {
  return (
    <View style={styles.host}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        // Without an explicit label the row's accessible name is assembled
        // from every descendant Text, pills included — so a "Hard" pill made
        // the card answer to the same name as the Hard filter chip. The hint
        // carries those facts instead.
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        pressScale={0.985}
        style={styles.card}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.tile} />
        ) : (
          <View style={[styles.tile, { backgroundColor: tint }]}>
            <Ionicons name={icon} size={40} color={theme.colors.ink} style={styles.glyph} />
          </View>
        )}
        <View style={styles.body}>
          {pills ? (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.pills}>
              {pills}
            </View>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {meta}
        </View>
      </AnimatedPressable>
      {aside ? <View style={styles.aside}>{aside}</View> : null}
    </View>
  )
}

/** One line of muted meta with a leading glyph: "⏱ 20 min", "📍 Northside". */
export function MetaItem({ icon, color, children }: { icon: IconName; color?: string; children: ReactNode }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={13} color={color ?? theme.colors.muted} />
      <Text style={styles.metaText}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  host: { position: 'relative', marginBottom: 14 },
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: theme.spacing(3),
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  tile: {
    width: 96,
    height: 96,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { opacity: 0.75 },
  // paddingRight keeps a two-line title clear of the 44px heart.
  body: { flex: 1, minWidth: 0, gap: 4, paddingRight: 40, paddingTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  title: { fontFamily: theme.fonts.black, fontSize: theme.type.body, lineHeight: 21, color: theme.colors.ink },
  aside: { position: 'absolute', top: 10, right: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
})
