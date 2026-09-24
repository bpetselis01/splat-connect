// packages/mobile/components/profile/child-wizard.tsx
// The child profile wizard, (onboarding)/child — the phone twin of web's
// components/child-wizard.tsx, so the two first runs match: name and age, the
// four switch questions, then the room. One question a screen, every one
// skippable. Continue saves what the step answered; Skip saves nothing, because
// not answering is not the same as answering blank.
//
// Edits the account's first child and creates one on the first answered step —
// useChildProfile's no-argument mode, the same rule web's wizard follows.
// ponytail: no mascot art on mobile yet; its lines are carried as plain text.
import { useEffect, useState } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { CHILD_QUESTIONS, type ChildAnswers } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { useChildProfile } from '../../lib/use-child-profile'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ChoiceChips, NeedsChips } from './fields'

const STEPS: { heading: string; line: string; fields: (keyof ChildAnswers)[] }[] = [
  { heading: 'Who are we finding toys for?', line: 'Hi! A few quick questions. Skip any you like.', fields: ['name', 'age'] },
  ...CHILD_QUESTIONS.map((q, i) => ({
    heading: q.prompt,
    line: [
      'Whichever hand they reach with first is the right answer.',
      'This decides how easy a switch needs to be to press.',
      'Big targets are easier. Either answer helps.',
      'Some switches want a tap, some a hold.',
    ][i],
    fields: [q.field] as (keyof ChildAnswers)[],
  })),
  { heading: 'What matters in the room?', line: 'Almost done. This one is fine to skip.', fields: ['everyday_needs'] },
]

const EMPTY: ChildAnswers = {
  name: null, age: null, working_hand: null, press_force: null, aim: null, hold: null, everyday_needs: [],
}

export function ChildWizard() {
  const router = useRouter()
  const { profile, loading, save } = useChildProfile()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<ChildAnswers>(EMPTY)
  // Seed once from an existing child, so coming back shows what is already set.
  useEffect(() => {
    if (profile) setDraft((d) => (d === EMPTY ? { ...EMPTY, ...pick(profile) } : d))
  }, [profile])

  const set = (patch: Partial<ChildAnswers>) => setDraft((d) => ({ ...d, ...patch }))

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else router.replace('/guides')
  }

  function saveAndNext() {
    // Only what this step answered. An emptied needs list is an answer when
    // the child had needs before; otherwise empty is the same as a skip.
    const answered = STEPS[step].fields.filter((f) => {
      const v = draft[f]
      return Array.isArray(v) ? v.length > 0 || (profile?.everyday_needs?.length ?? 0) > 0 : v !== null
    })
    const fields: Partial<ChildAnswers> = Object.fromEntries(answered.map((f) => [f, draft[f]]))
    if ('name' in fields) fields.name = fields.name?.trim() || null
    if (Object.keys(fields).length) save(fields)
    next()
  }

  const current = STEPS[step]
  const q = step >= 1 && step <= CHILD_QUESTIONS.length ? CHILD_QUESTIONS[step - 1] : null

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.bars} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.bar, { backgroundColor: i < step ? theme.colors.success : i === step ? theme.colors.primary : theme.colors.border }]}
          />
        ))}
      </View>
      <Text style={styles.stepOf}>STEP {step + 1} OF {STEPS.length}</Text>
      <Text accessibilityRole="header" style={styles.heading}>{current.heading}</Text>
      <Text style={styles.line}>{current.line}</Text>

      {loading ? null : step === 0 ? (
        <>
          <TextField
            label="First name (optional)"
            placeholder="e.g. Sam"
            value={draft.name ?? ''}
            onChangeText={(v) => set({ name: v || null })}
          />
          <TextField
            label="Age"
            accessibilityLabel="Age in years"
            keyboardType="numeric"
            value={draft.age != null ? String(draft.age) : ''}
            onChangeText={(v) => set({ age: v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v) })}
          />
        </>
      ) : q ? (
        <ChoiceChips options={q.options} value={draft[q.field]} onChange={(v) => set({ [q.field]: v })} />
      ) : (
        <NeedsChips value={draft.everyday_needs} onChange={(v) => set({ everyday_needs: v })} />
      )}

      <Text style={styles.private}>Saved automatically · nothing is shared</Text>
      <View style={styles.actions}>
        <Button label="Back" variant="ghost" disabled={step === 0} onPress={() => setStep(step - 1)} />
        <View style={styles.actionsRight}>
          <Button label="Skip" variant="ghost" onPress={next} />
          <Button label={step === STEPS.length - 1 ? 'Finish' : 'Continue'} onPress={saveAndNext} />
        </View>
      </View>
    </ScrollView>
  )
}

function pick(p: ChildAnswers): ChildAnswers {
  return {
    name: p.name, age: p.age, working_hand: p.working_hand, press_force: p.press_force,
    aim: p.aim, hold: p.hold, everyday_needs: p.everyday_needs ?? [],
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  bars: { flexDirection: 'row', gap: 6, marginBottom: theme.spacing(5) },
  bar: { flex: 1, height: 6, borderRadius: theme.radii.pill },
  stepOf: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, letterSpacing: 1.2, color: theme.colors.primaryDeep },
  heading: {
    fontFamily: theme.fonts.display,
    fontSize: theme.type.title,
    color: theme.colors.text,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  line: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(5),
  },
  private: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(2) },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing(5) },
  actionsRight: { flexDirection: 'row', gap: theme.spacing(2) },
})
