// packages/mobile/components/guides/picks-row.tsx
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native'
import { NotMedicalNote } from '../ui/NotMedicalNote'
import { DIFFICULTY_LABEL, formatBuildTime, type Difficulty, type Recommendation } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const CARD_W = 168
const DIFF_TINT: Record<Difficulty, string> = {
  easy: theme.colors.successSoft,
  medium: theme.colors.honeySoft,
  hard: theme.colors.apricotSoft,
}

/**
 * Up to three creator-picked guides (round 3): every card the same size, the
 * photo edge to edge across its top, a two-line title, and difficulty and
 * build time on one line. "Do this first" rides on the photo.
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
      <View>
        <Text style={styles.heading} accessibilityRole="header">
          Also worth a look
        </Text>
        <Text style={styles.hint}>{`Guides ${firstName} points you at next.`}</Text>
      </View>
      {/* Bleeds off the right edge so the next card peeks: the row scrolls. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.content}>
        {picks.map(({ tutorials: t, required }) => (
          <AnimatedPressable
            key={t.id}
            onPress={() => onOpen(t.id)}
            pressScale={0.97}
            accessibilityRole="button"
            accessibilityLabel={required ? `${t.title}, do this first` : t.title}
            style={styles.card}
          >
            <View>
              {t.toy_photo_url ? (
                <Image source={{ uri: t.toy_photo_url }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoBlank]} />
              )}
              {/* 129: make this one before the guide you are on. */}
              {required ? (
                <View style={styles.first}>
                  <Text style={styles.firstText}>Do this first</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={2}>
                {t.title}
              </Text>
              <View style={styles.foot}>
                <View style={[styles.pill, { backgroundColor: DIFF_TINT[t.difficulty] }]}>
                  <Text style={styles.pillText}>{DIFFICULTY_LABEL[t.difficulty]}</Text>
                </View>
                {t.build_minutes ? <Text style={styles.meta}>{formatBuildTime(t.build_minutes)}</Text> : null}
              </View>
            </View>
          </AnimatedPressable>
        ))}
      </ScrollView>
      <NotMedicalNote />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing(3) },
  heading: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  bleed: { marginRight: -theme.spacing(4) },
  content: { gap: theme.spacing(3), paddingRight: theme.spacing(4), paddingBottom: theme.spacing(1) },
  card: {
    width: CARD_W,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  photo: { width: CARD_W, height: 112, backgroundColor: theme.colors.surfaceSunken },
  photoBlank: { backgroundColor: theme.colors.accentLight },
  first: {
    position: 'absolute',
    left: theme.spacing(2),
    top: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.inverse,
  },
  firstText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.onInverse },
  body: { padding: theme.spacing(3), gap: theme.spacing(3) },
  // Two lines held whether the title needs them or not, so every card is one height.
  title: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text, height: 44 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  pill: { paddingHorizontal: theme.spacing(3), paddingVertical: 2, borderRadius: theme.radii.pill },
  pillText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
})
