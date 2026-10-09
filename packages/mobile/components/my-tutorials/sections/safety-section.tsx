// packages/mobile/components/my-tutorials/sections/safety-section.tsx
//
// Its own screen rather than a block at the bottom of Details, because it is
// its own gate: a guide cannot be submitted without it, and a checklist buried
// under three chip rows was one nobody read.
import { useState } from 'react'
import { Text, ScrollView, Pressable, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SAFETY_CHECKLIST } from '@splat-connect/types'
import { confirmDestructive } from '../../../lib/confirm'
import { useDraft, type SafetyNoteRow } from '../../../lib/use-tutorial-draft'
import { SectionProgress } from './section-progress'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'
import { DraftGate } from './draft-gate'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/TextField'

// The editor mounts once the draft has arrived (see DraftGate).
export function SafetySection() {
  return <DraftGate>{() => <SafetyEditor />}</DraftGate>
}

function SafetyEditor() {
  const { tutorial, save, saveError, replaceSafetyNotes } = useDraft()
  const [notes, setNotes] = useState<SafetyNoteRow[]>(() =>
    (tutorial?.safety_notes ?? []).map((n) => ({ title: n.title, detail: n.detail }))
  )
  if (!tutorial) return null
  const commit = (next: SafetyNoteRow[]) => {
    setNotes(next)
    replaceSafetyNotes(next)
  }

  const declared = tutorial.safety_declared_at

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <SectionProgress section="safety" />
        <Text style={styles.lead}>Anything that could hurt a child, stated plainly.</Text>
        {SAFETY_CHECKLIST.map((item) => (
          <Text key={item} style={styles.item}>
            {'•'} {item}
          </Text>
        ))}

        {declared ? (
          // No way to unmake it: a declaration that can be toggled off is not a
          // declaration. Reversing one is a support conversation, not a tap.
          <Text style={styles.declared}>
            Declared on {new Date(declared).toLocaleDateString('en-AU')}.
          </Text>
        ) : (
          // Defaults to off on purpose — a declaration is made, never assumed.
          // The client only ever affirms; the server stamps the timestamp.
          <Pressable
            testID="safety-declare"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            onPress={() =>
              confirmDestructive(
                'Declare this design safe?',
                "Once you declare it, you can't untick it. Check every point above first.",
                'Declare',
                () => save({ safety_declared: true })
              )
            }
            style={styles.tick}
          >
            <Ionicons name="square-outline" size={20} color={theme.colors.primaryDeep} />
            <Text style={styles.tickText}>
              I have checked this design against every point above. A guide cannot be
              submitted for review without this.
            </Text>
          </Pressable>
        )}

        <Text style={styles.label}>Your safety notes</Text>
        {notes.map((n, i) => (
          <View key={i} style={styles.note}>
            <TextField
              accessibilityLabel={`Safety note ${i + 1} title`}
              placeholder="Battery door must be screwed shut"
              maxLength={80}
              value={n.title}
              onChangeText={(title) => commit(notes.map((x, k) => (k === i ? { ...x, title } : x)))}
            />
            <TextField
              accessibilityLabel={`Safety note ${i + 1} detail`}
              placeholder="The base clips by default. Add the screw."
              maxLength={500}
              multiline
              value={n.detail ?? ''}
              onChangeText={(detail) => commit(notes.map((x, k) => (k === i ? { ...x, detail: detail || null } : x)))}
            />
            <Button label="Remove" variant="ghost" onPress={() => commit(notes.filter((_, k) => k !== i))} />
          </View>
        ))}
        {notes.length < 20 ? (
          <Button label="+ Add a safety note" variant="ghost" onPress={() => commit([...notes, { title: '', detail: null }])} />
        ) : null}
        <ErrorRow message={saveError} />
      </ScrollView>
      <SectionFooter section="safety" />
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
  item: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 21,
    marginBottom: theme.spacing(2),
  },
  declared: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: theme.spacing(4),
  },
  tick: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    marginTop: theme.spacing(4),
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: theme.spacing(5),
    marginBottom: theme.spacing(2),
  },
  note: { marginBottom: theme.spacing(3) },
  tickText: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 18,
  },
})
