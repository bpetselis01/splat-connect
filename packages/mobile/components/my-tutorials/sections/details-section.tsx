// packages/mobile/components/my-tutorials/sections/details-section.tsx
//
// Title, description and the three chip rows. Everything writes through
// useDraft().save, which debounces and carries the concurrency token — there is
// no Save button here, and no local copy of the tutorial to fall out of sync
// with the one the hub is reading.
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import type { Difficulty, TutorialKind } from '@splat-connect/types'
import {
  BUILD_TIME_OPTIONS,
  KIND_LABEL,
  formatBuildTime,
} from '@splat-connect/types'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { parseYears } from '../../../lib/tutorial-sections'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
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
  const router = useRouter()
  const { tutorial, save, saveError } = useDraft()
  if (!tutorial) return null

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text style={styles.lead}>What the toy is, who it suits, and who is backing the guide.</Text>
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
          accessibilityLabel="Works with"
          placeholder="Any 3.5mm switch - Jelly Bean, Big Red, or a printed lever switch."
          maxLength={300}
          defaultValue={tutorial.works_with ?? ''}
          onChangeText={(text) => save({ works_with: text.trim() ? text : null })}
        />
        <Text style={styles.hint}>
          The switches this build accepts. Shown as its own card in the guide sidebar - a parent checks it before they start.
        </Text>
        <TextField
          label="If someone would rather not build it (optional)"
          accessibilityLabel="If someone would rather not build it"
          placeholder="e.g. Organisation 2 keeps printed mounts on the shelf if you would rather not print one."
          maxLength={300}
          defaultValue={tutorial.no_build_note ?? ''}
          onChangeText={(text) => save({ no_build_note: text.trim() ? text : null })}
        />
        <Text style={styles.hint}>
          Sits next to "Get help with this build" in the sidebar, before the link to the toy library. Leave blank and we just show the link.
        </Text>

        <TextField
          label="Your closing line (optional)"
          accessibilityLabel="Your closing line"
          placeholder="e.g. Nice work - show us how it turned out."
          multiline
          maxLength={300}
          defaultValue={tutorial.done_note ?? ''}
          onChangeText={(text) => save({ done_note: text.trim() ? text : null })}
        />
        <Text style={styles.hint}>Shown to the builder once every step is ticked off. Leave blank to skip it.</Text>

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

        {/* Web's field (edit-details-section.tsx), as chips: the same values,
            the same "printing isn't included" rule. */}
        <Text style={styles.label}>About how long does it take?</Text>
        <View style={styles.chipRow}>
          {BUILD_TIME_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={m === 240 ? '4 h or more' : formatBuildTime(m)}
              active={tutorial.build_minutes === m}
              onPress={() => save({ build_minutes: m })}
            />
          ))}
        </View>
        <Text style={styles.hint}>Hands-on time only — printing time isn't included.</Text>

        {/* Web's two number fields (071). The empty string clears the end, so
            a guide can go back to "any age"; the 0–18 bound is the database's. */}
        <Text style={styles.label}>Age range</Text>
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
        <Text style={styles.hint}>In years. Leave both blank if it suits any age.</Text>

        <Button label="Backing" variant="secondary" onPress={() => router.push(`/tutorials/${tutorial.id}/backing`)} />

        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section="details" />
    </Screen>
  )
}

const styles = StyleSheet.create({
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
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing(4),
  },
})
