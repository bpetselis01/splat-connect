// packages/mobile/components/list/list-kit.tsx
//
// The board's shared list pattern ("#list"): a lead line, a full-width add
// button, a segmented stage filter with counts, then rows of a 52px photo or
// glyph, a title, one line of meta and a status pill where the row has state.
// Every "my" list screen composes these rather than restyling its own card.
import type { ComponentProps, ReactNode } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { STAGE, type StageKey, type StageOption } from './stage'

type IconName = ComponentProps<typeof Ionicons>['name']

/** A tinted pill with an optional icon — the board's status pill. */
export function Pill({ label, bg, fg = theme.colors.ink, icon }: { label: string; bg: string; fg?: string; icon?: IconName }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={fg} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  )
}

/** `label` overrides the stage's own word, e.g. "Draft" for a hidden guide. */
export function StagePill({ stage, label }: { stage: StageKey; label?: string }) {
  const s = STAGE[stage]
  return <Pill label={label ?? s.label} bg={s.bg} fg={s.fg} icon={s.icon} />
}

/** The lead line and the full-width add button above a list. */
export function ListIntro({ lead, cta, onCta }: { lead?: string; cta?: string; onCta?: () => void }) {
  return (
    <View style={styles.intro}>
      {lead ? <Text style={styles.lead}>{lead}</Text> : null}
      {cta && onCta ? <Button label={cta} variant="accent" onPress={onCta} style={styles.cta} /> : null}
    </View>
  )
}

/** The uppercase group label ("CHILD PROFILES", "HISTORY"). */
export function ListSection({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Text accessibilityRole="header" style={[styles.section, style]}>
      {children}
    </Text>
  )
}

/** The segmented stage filter: one sunken track, the chosen option lifted. */
export function StageFilter({
  label,
  options,
  current,
  onPick,
}: {
  label: string
  options: StageOption[]
  current: string
  onPick: (id: StageOption['id']) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      style={styles.track}
      contentContainerStyle={styles.trackInner}
    >
      {options.map((o) => {
        const on = o.id === current
        return (
          <Pressable
            key={o.id}
            testID={`stage-${o.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${o.label}, ${o.n}`}
            accessibilityState={{ selected: on }}
            onPress={() => onPick(o.id)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.seg, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]}>{o.label}</Text>
            <Text style={styles.segN}>{o.n}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

/** The board's "Nothing at that stage." with its way back to everything. */
export function StageNone({ onClear }: { onClear: () => void }) {
  return (
    <View style={styles.none}>
      <Text style={styles.noneTitle}>Nothing at that stage.</Text>
      <Button label="Show everything" variant="secondary" onPress={onClear} style={styles.noneBtn} />
    </View>
  )
}

/** A 52px photo, or a tinted glyph tile when there is no photo. */
export function RowThumb({ photo, glyph = 'cube-outline', tint }: { photo?: string | null; glyph?: IconName; tint?: string }) {
  if (photo) return <Image source={{ uri: photo }} style={styles.thumb} />
  return (
    <View style={[styles.thumb, styles.glyph, tint ? { backgroundColor: tint } : null]}>
      <Ionicons name={glyph} size={24} color={theme.colors.primaryDeep} />
    </View>
  )
}

export function ListRow({
  title,
  meta,
  pill,
  thumb,
  trailing,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  titleLines = 2,
  metaLines = 2,
  dim,
}: {
  title: string
  meta?: string | null
  pill?: ReactNode
  /** A RowThumb, an avatar, or nothing for a text-only row. */
  thumb?: ReactNode
  /** Beside the chevron — a count chip, a check. */
  trailing?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
  accessibilityHint?: string
  testID?: string
  titleLines?: number
  metaLines?: number
  dim?: boolean
}) {
  const body = (
    <View style={[styles.row, dim && styles.dim]}>
      {thumb}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={titleLines}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={metaLines}>
            {meta}
          </Text>
        ) : null}
        {pill ? <View style={styles.pillRow}>{pill}</View> : null}
      </View>
      {trailing}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} /> : null}
    </View>
  )
  if (!onPress) return body
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      pressScale={0.98}
    >
      {body}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: theme.radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  pillText: { fontFamily: theme.fonts.black, fontSize: 11, letterSpacing: 0.3 },
  intro: { marginBottom: theme.spacing(4), gap: theme.spacing(4) },
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  cta: { borderRadius: theme.radii.pill, minHeight: 50, borderWidth: 0 },
  section: {
    fontFamily: theme.fonts.black,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: theme.colors.muted,
    marginHorizontal: 2,
    marginBottom: theme.spacing(2),
  },
  track: {
    flexGrow: 0,
    marginBottom: theme.spacing(4),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surfaceSunken,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  trackInner: { flexGrow: 1, padding: 4, gap: 0 },
  seg: {
    flexGrow: 1,
    minHeight: 36,
    paddingHorizontal: 6,
    borderRadius: theme.radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  segOn: { backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  segText: { fontFamily: theme.fonts.black, fontSize: 12.5, color: theme.colors.muted },
  segTextOn: { color: theme.colors.ink },
  segN: { fontFamily: theme.fonts.black, fontSize: 11, color: theme.colors.ink, opacity: 0.55 },
  none: { alignItems: 'center', paddingVertical: theme.spacing(10), paddingHorizontal: theme.spacing(5) },
  noneTitle: { fontFamily: theme.fonts.display, fontSize: 16, color: theme.colors.ink },
  noneBtn: { marginTop: theme.spacing(4), borderRadius: theme.radii.pill, minHeight: 44 },
  thumb: { width: 52, height: 52, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  glyph: { backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(1),
  },
  // Receded, not hidden — the same 60% web's Given away section takes.
  dim: { opacity: 0.6 },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: theme.fonts.black, fontSize: 15, lineHeight: 20, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: 12.5, lineHeight: 18, color: theme.colors.muted, marginTop: 2 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
})
