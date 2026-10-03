// packages/mobile/components/profile/child-wizard.tsx
// The child profile wizard, (onboarding)/child — the phone twin of web's
// components/child-wizard.tsx, so the two first runs match: name and age, the
// four switch questions, the room, then the board's Play and Measurements
// (120; web's wizard has not caught up). One question a screen, every one
// skippable. Continue saves what the step answered; Skip saves nothing, because
// not answering is not the same as answering blank.
//
// Edits the account's first child and creates one on the first answered step —
// useChildProfile's no-argument mode, the same rule web's wizard follows.
import { useEffect, useState } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { CHILD_MEASURES, CHILD_QUESTIONS, ENJOYS, type ChildAnswers, type ChildMeasureField, type ChildProfile } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { readAge } from '../../lib/child-age'
import { useChildProfile } from '../../lib/use-child-profile'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Mascot, type MascotPose } from '../ui/TabHero'
import { ChildDone } from './child-done'
import { ChoiceChips, ManyChips, MeasureField, NeedsChips } from './fields'

/** What the wizard writes: the board's questions (079) plus Play and Measurements (120). */
type Answers = ChildAnswers & Pick<ChildProfile, 'enjoys' | ChildMeasureField>

type Kind = 'about' | 'question' | 'room' | 'play' | 'measure'

// Six screens from 079 (not the board's About/Hands/Movement — those answers
// have no columns, and the four questions are what suitsChild matches on),
// then the board's last two. `line` is what web's mascot says on the step;
// `help` is the board's sentence under the heading, where it has one; `pose`
// is the bear beside the line (MB's poses, web's POSE).
// Play is data capture only (Byron 2026-10-02): the board's "We will put those
// toys first." is kept as drawn, but nothing sorts or matches on `enjoys` yet.
const STEPS: { kind: Kind; heading: string; line: string; pose: MascotPose; help?: string; fields: (keyof Answers)[] }[] = [
  { kind: 'about', heading: 'Who are we finding toys for?', line: 'Hi! A few quick questions. Skip any you like.', pose: 'wave', fields: ['name', 'age'] },
  ...CHILD_QUESTIONS.map((q, i) => ({
    kind: 'question' as const,
    heading: q.prompt,
    line: [
      'Whichever hand they reach with first is the right answer.',
      'This decides how easy a switch needs to be to press.',
      'Big targets are easier. Either answer helps.',
      'Some switches want a tap, some a hold.',
    ][i],
    pose: (['think', 'hold', 'think', 'hold'] as const)[i],
    fields: [q.field] as (keyof Answers)[],
  })),
  { kind: 'room', heading: 'What matters in the room?', line: 'Rather than in the hand. Pick any that apply.', pose: 'party', fields: ['everyday_needs'] },
  {
    kind: 'play',
    heading: 'What does your child enjoy?',
    help: 'We will put those toys first.',
    line: 'Lights and sound are the classic reward. Some children prefer calm.',
    pose: 'party',
    fields: ['enjoys'],
  },
  {
    kind: 'measure',
    heading: 'Any measurements? (optional)',
    help: 'Only for printed grips and mounts.',
    line: 'Almost done. This one is fine to skip.',
    pose: 'think',
    fields: CHILD_MEASURES.map((m) => m.field),
  },
]

const EMPTY: Answers = {
  name: null, age: null, working_hand: null, press_force: null, aim: null, hold: null, everyday_needs: [],
  enjoys: [], palm_width_mm: null, reach_cm: null, tray_mm: null,
}

export function ChildWizard() {
  const { profile, loading, save } = useChildProfile()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [draft, setDraft] = useState<Answers>(EMPTY)
  // Seed once from an existing child, so coming back shows what is already set.
  useEffect(() => {
    if (profile) setDraft((d) => (d === EMPTY ? { ...EMPTY, ...pick(profile) } : d))
  }, [profile])

  const set = (patch: Partial<Answers>) => setDraft((d) => ({ ...d, ...patch }))

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
    else setDone(true)
  }

  function saveAndNext() {
    // Only what this step answered. A cleared answer (an emptied list, a
    // chip or name taken back out) is an answer when the child had one
    // before; otherwise empty is the same as a skip.
    const answered = STEPS[step].fields.filter((f) => {
      const v = draft[f]
      const before = profile?.[f]
      if (Array.isArray(v)) return v.length > 0 || (Array.isArray(before) && before.length > 0)
      return v !== null || (before != null && !Array.isArray(before))
    })
    const fields: Partial<Answers> = Object.fromEntries(answered.map((f) => [f, draft[f]]))
    if ('name' in fields) fields.name = fields.name?.trim() || null
    if (Object.keys(fields).length) save(fields)
    next()
  }

  const current = STEPS[step]

  if (done) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ChildDone child={draft} />
      </ScrollView>
    )
  }

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
      <View style={styles.says}>
        <Mascot pose={current.pose} size={74} />
        <Text style={styles.saysText}>{current.line}</Text>
      </View>
      {current.help ? <Text style={styles.help}>{current.help}</Text> : null}

      {loading ? null : current.kind === 'about' ? (
        <>
          <TextField
            label="First name (optional)"
            placeholder="e.g. Sam"
            value={draft.name ?? ''}
            onChangeText={(v) => set({ name: v.trim() ? v : null })}
          />
          <TextField
            label="Age"
            accessibilityLabel="Age in years"
            keyboardType="numeric"
            value={draft.age != null ? String(draft.age) : ''}
            onChangeText={(v) => {
              const age = readAge(v)
              if (age !== undefined) set({ age })
            }}
          />
        </>
      ) : current.kind === 'question' ? (
        (() => {
          const q = CHILD_QUESTIONS[step - 1]
          return <ChoiceChips options={q.options} value={draft[q.field]} onChange={(v) => set({ [q.field]: v })} />
        })()
      ) : current.kind === 'room' ? (
        <NeedsChips value={draft.everyday_needs} onChange={(v) => set({ everyday_needs: v })} />
      ) : current.kind === 'play' ? (
        <ManyChips options={ENJOYS} value={draft.enjoys} onChange={(v) => set({ enjoys: v })} />
      ) : (
        CHILD_MEASURES.map((m) => (
          // An out-of-range number is not an answer: it stays on screen with its range.
          <MeasureField key={m.field} measure={m} value={draft[m.field]} onChange={(v) => set({ [m.field]: v ?? null })} />
        ))
      )}

      <View style={styles.actions}>
        <Button label="Back" variant="secondary" disabled={step === 0} onPress={() => setStep(step - 1)} />
        <View style={styles.actionsRight}>
          <Button label="Skip" variant="ghost" onPress={next} />
          <Button label={step === STEPS.length - 1 ? 'Finish' : 'Continue'} onPress={saveAndNext} />
        </View>
      </View>
      {/* Under the buttons, centred, as on the board. */}
      <Text style={styles.private}>Saved automatically · nothing is shared</Text>
    </ScrollView>
  )
}

function pick(p: Answers): Answers {
  return {
    name: p.name, age: p.age, working_hand: p.working_hand, press_force: p.press_force,
    aim: p.aim, hold: p.hold, everyday_needs: p.everyday_needs ?? [],
    enjoys: p.enjoys ?? [], palm_width_mm: p.palm_width_mm, reach_cm: p.reach_cm, tray_mm: p.tray_mm,
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
  says: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 13,
    borderRadius: 18,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentFaint,
    marginBottom: theme.spacing(5),
  },
  saysText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: 13.5, lineHeight: 20, color: theme.colors.ink },
  help: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21, marginTop: -theme.spacing(3), marginBottom: theme.spacing(4) },
  private: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(3), textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing(5) },
  actionsRight: { flexDirection: 'row', gap: theme.spacing(2) },
})
