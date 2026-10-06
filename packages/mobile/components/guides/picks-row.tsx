// packages/mobile/components/guides/picks-row.tsx
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native'
import { NotMedicalNote } from '../ui/NotMedicalNote'
import type { Recommendation } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Badge } from '../ui/Badge'

/**
 * Up to three creator-picked guides, below the fold of the detail screen.
 *
 * The ScrollView's contentContainerStyle pads past the 4px hard shadow on
 * every card, on both axes — the Phase 1 lesson that a hard shadow clips at
 * the scroll edge without room for it to fall into.
 */
export function PicksRow({
  recommendations,
  firstName,
  onOpen,
}: {
  recommendations: Recommendation[]
  firstName: string
  onOpen: (id: string) => void
}) {
  const picks = recommendations.slice(0, 3)
  if (picks.length === 0) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading} accessibilityRole="header">
        Also worth a look
      </Text>
      <Text style={styles.hint}>Up to three guides {firstName} points you at next.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
        {picks.map(({ tutorials: t, required }) => (
          <AnimatedPressable
            key={t.id}
            onPress={() => onOpen(t.id)}
            pressScale={0.97}
            accessibilityRole="button"
            accessibilityLabel={required ? `${t.title}, required first` : t.title}
          >
            <View style={styles.card}>
              {t.toy_photo_url ? (
                <Image source={{ uri: t.toy_photo_url }} style={styles.photo} />
              ) : (
                <View style={styles.photoPlaceholder} />
              )}
              <Text style={styles.title} numberOfLines={2}>
                {t.title}
              </Text>
              <Badge status={t.difficulty} />
              {/* 129: make this one before the guide you are on. */}
              {required ? <Badge status="pending" label="Required first" /> : null}
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>
      <NotMedicalNote />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: theme.spacing(6) },
  // The board's section heading and its muted hint.
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginBottom: theme.spacing(2) },
  content: { gap: 10, paddingRight: 6, paddingBottom: 8, paddingLeft: 2 },
  card: {
    width: 124,
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(2),
    gap: theme.spacing(1),
    ...theme.shadow(2),
  },
  photo: { width: '100%', height: 74, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  photoPlaceholder: {
    width: '100%',
    height: 74,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.accentLight,
  },
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.text, lineHeight: 16 },
})
