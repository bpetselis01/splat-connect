// packages/mobile/components/my-tutorials/sections/details-section.tsx
//
// Title, description and the three chip rows. Everything writes through
// useDraft().save, which debounces and carries the concurrency token — there is
// no Save button here, and no local copy of the tutorial to fall out of sync
// with the one the hub is reading.
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { Difficulty, TutorialKind, TutorialMaturity } from '@splat-connect/types'
import { KIND_LABEL, MATURITY_LABEL } from '@splat-connect/types'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Chip } from '../../ui/Chip'
import { ErrorRow } from '../../auth-screen'
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
const MATURITY_OPTIONS = (Object.keys(MATURITY_LABEL) as TutorialMaturity[]).map((m) => ({
  label: MATURITY_LABEL[m],
  value: m,
}))

export function DetailsSection() {
  const { tutorial, save, saveError } = useDraft()
  if (!tutorial) return null

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
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

        <Text style={styles.label}>How far along is it?</Text>
        <View style={styles.chipRow}>
          {MATURITY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              active={tutorial.maturity === o.value}
              onPress={() => save({ maturity: o.value })}
            />
          ))}
        </View>
        <Text style={styles.hint}>Only complete guides appear in the public library listing.</Text>

        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section="details" />
    </Screen>
  )
}

const styles = StyleSheet.create({
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
  hint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
    marginBottom: theme.spacing(4),
  },
})
