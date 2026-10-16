// packages/mobile/components/my-tutorials/sections/details-section.tsx
//
// Title, description and the three chip rows. Everything writes through
// useDraft().save, which debounces and carries the concurrency token — there is
// no Save button here, and no local copy of the tutorial to fall out of sync
// with the one the hub is reading.
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { Difficulty, TutorialKind } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { SectionProgress } from './section-progress'
import { parseYears } from '../../../lib/tutorial-sections'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { InfoHint } from '../../ui/InfoHint'
import { BuildTimeSlider } from '../../ui/BuildTimeSlider'
import { Chip } from '../../ui/Chip'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'

const KIND_OPTIONS: { label: string; value: TutorialKind }[] = [
  { label: KIND_LABEL.toy_adaptation, value: 'toy_adaptation' },
  { label: KIND_LABEL.assistive_tech, value: 'assistive_tech' },
]
const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

export function DetailsSection() {
  const { tutorial, save, saveError } = useDraft()
  if (!tutorial) return null

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <SectionProgress section="details" />
        <Text style={styles.lead}>What the toy is and who it suits.</Text>
        <TextField
          label="Title"
          accessibilityLabel="Title"
          value={tutorial.title}
          onChangeText={(text) => save({ title: text })}
        />
        <TextField
          label="Description"
          accessibilityLabel="Description"
          value={tutorial.description ?? ''}
          multiline
          onChangeText={(text) => save({ description: text.trim() ? text : null })}
        />

        {/* Web's toy fields (edit-details-section.tsx): shown for every kind,
            lengths are the API's (80/80/300/300), blank clears to null. */}
        <Text style={styles.label}>The toy you start with</Text>
        <TextField
          label="Toy"
          accessibilityLabel="Toy"
          maxLength={80}
          defaultValue={tutorial.toy_name ?? ''}
          onChangeText={(text) => save({ toy_name: text.trim() ? text : null })}
        />
        <TextField
          label="Made by (optional)"
          accessibilityLabel="Made by"
          placeholder="e.g. ZURU"
          maxLength={80}
          defaultValue={tutorial.toy_brand ?? ''}
          onChangeText={(text) => save({ toy_brand: text.trim() ? text : null })}
        />
        <TextField
          label="Works with"
          labelAccessory={<InfoHint title="Works with">The switches this build accepts. Shown as its own card in the guide sidebar - a parent checks it before they start.</InfoHint>}
          accessibilityLabel="Works with"
          placeholder="Any 3.5mm switch - Jelly Bean, Big Red, or a printed lever switch."
          maxLength={300}
          defaultValue={tutorial.works_with ?? ''}
          onChangeText={(text) => save({ works_with: text.trim() ? text : null })}
        />
        <TextField
          label="If someone would rather not build it (optional)"
          labelAccessory={<InfoHint title="If someone would rather not build it">Sits next to "Get help with this build" in the sidebar, before the link to the toy library. Leave blank and we just show the link.</InfoHint>}
          accessibilityLabel="If someone would rather not build it"
          placeholder="e.g. Organisation 2 keeps printed mounts on the shelf if you would rather not print one."
          maxLength={300}
          defaultValue={tutorial.no_build_note ?? ''}
          onChangeText={(text) => save({ no_build_note: text.trim() ? text : null })}
        />

        <TextField
          label="Your closing line (optional)"
          labelAccessory={<InfoHint title="Your closing line">Shown to the builder once every step is ticked off. Leave blank to skip it.</InfoHint>}
          accessibilityLabel="Your closing line"
          placeholder="e.g. Nice work - show us how it turned out."
          multiline
          maxLength={300}
          defaultValue={tutorial.done_note ?? ''}
          onChangeText={(text) => save({ done_note: text.trim() ? text : null })}
        />

        <Text style={styles.label}>Kind</Text>
        <View style={styles.chipRow}>
          {KIND_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={tutorial.kind === o.value}
              onPress={() => save({ kind: o.value })}
            />
          ))}
        </View>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={tutorial.difficulty === o.value}
              onPress={() => save({ difficulty: o.value })}
            />
          ))}
        </View>

        <LabelRow hint={{ title: 'About how long does it take?', text: "Hands-on time only — printing time isn't included." }}>About how long does it take?</LabelRow>
        <BuildTimeSlider value={tutorial.build_minutes} onCommit={(m) => save({ build_minutes: m })} />

        {/* Web's two number fields (071). The empty string clears the end, so
            a guide can go back to "any age"; the 0–18 bound is the database's. */}
        <LabelRow hint={{ title: 'Age range', text: 'In years. Leave both blank if it suits any age.' }}>Age range</LabelRow>
        <View style={styles.chipRow}>
          <View style={styles.ageBox}>
            <TextField
              accessibilityLabel="Youngest age"
              placeholder="From"
              keyboardType="number-pad"
              value={tutorial.age_min == null ? '' : String(tutorial.age_min)}
              onChangeText={(text) => save({ age_min: parseYears(text) })}
            />
          </View>
          <View style={styles.ageBox}>
            <TextField
              accessibilityLabel="Oldest age"
              placeholder="To"
              keyboardType="number-pad"
              value={tutorial.age_max == null ? '' : String(tutorial.age_max)}
              onChangeText={(text) => save({ age_max: parseYears(text) })}
            />
          </View>
        </View>

        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section="details" />
    </Screen>
  )
}

function LabelRow({ children, hint }: { children: string; hint?: { title: string; text: string } }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, styles.labelInRow]}>{children}</Text>
      {hint ? <InfoHint title={hint.title}>{hint.text}</InfoHint> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  labelInRow: { marginBottom: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  // The board opens each section with what it is for.
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(4),
  },
  ageBox: {
    flex: 1,
  },
})
