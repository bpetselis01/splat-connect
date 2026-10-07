// packages/mobile/components/profile/child-wizard.tsx
// The child profile wizard, (onboarding)/child — the phone twin of web's
// components/child-wizard.tsx, so the two first runs match: name and age, the
// four child questions (128's CHILD_QUESTIONS — the same answers guides are
// tagged with), then the room. One question a screen, every one skippable.
// Measurements live in the child editor, not here. Continue saves what the step answered; Skip saves nothing, because
// not answering is not the same as answering blank.
//
// Edits the account's first child and creates one on the first answered step —
// useChildProfile's no-argument mode, the same rule web's wizard follows.
import { useEffect, useState } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { CHILD_QUESTIONS, ONE_HAND_LABEL, type ChildAnswers } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { readAge } from '../../lib/child-age'
import { useChildProfile } from '../../lib/use-child-profile'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { Mascot, type MascotPose } from '../ui/TabHero'
import { ChildDone } from './child-done'
import { ChoiceChips, ManyChips, NeedsChips } from './fields'

type Answers = ChildAnswers
type Kind = 'about' | 'question' | 'room'

// `line` is what the mascot says on the step; `pose` is the bear beside it.
const LINES: Record<(typeof CHILD_QUESTIONS)[number]['child'], [string, MascotPose]> = {
  helps_with: ['This is how we put the right guides first.', 'think'],
  access: ['Any part of the body counts, and so does just watching.', 'hold'],
  press_force: ['This decides how easy a switch needs to be to press.', 'think'],
  enjoys: ['Lights and sound are the classic reward. Some children prefer calm.', 'party'],
}
const STEPS: { kind: Kind; q?: (typeof CHILD_QUESTIONS)[number]; heading: string; line: string; pose: MascotPose; help?: string; fields: (keyof Answers)[] }[] = [
  { kind: 'about', heading: 'Who are we finding toys for?', line: 'Hi! A few quick questions. Skip any you like.', pose: 'wave', fields: ['name', 'age'] },
  ...CHILD_QUESTIONS.map((q) => ({
    kind: 'question' as const,
    q,
    heading: q.prompt,
    help: q.hint,
    line: LINES[q.child][0],
    pose: LINES[q.child][1],
    fields: (q.child === 'access' ? ['access', 'one_hand'] : [q.child]) as (keyof Answers)[],
  })),
  { kind: 'room', heading: 'Good to know', help: 'Notes for whoever makes or lends a toy. Pick any that apply.', line: 'Almost done.', pose: 'party', fields: ['everyday_needs'] },
]

const EMPTY: Answers = { name: null, age: null, helps_with: [], access: [], one_hand: false, press_force: null, enjoys: [], everyday_needs: [] }

export function ChildWizard() {
  const bottom = useBottomClearance()
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
      if (typeof v === 'boolean') return v || before === true
      return v !== null || (before != null && !Array.isArray(before))
    })
    const fields: Partial<Answers> = Object.fromEntries(answered.map((f) => [f, draft[f]]))
    if ('name' in fields) fields.name = fields.name?.trim() || null
    if (Object.keys(fields).length) save(fields)
    next()
  }

  const current = STEPS[step]
  const name = draft.name?.trim() || profile?.name?.trim() || 'your child'

  if (done) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
        <ChildDone child={draft} />
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
      <View style={styles.bars} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <View
            key={i}
            style={[styles.bar, { backgroundColor: i < step ? theme.colors.success : i === step ? theme.colors.primary : theme.colors.border }]}
          />
        ))}
      </View>
      <Text style={styles.stepOf}>STEP {step + 1} OF {STEPS.length}</Text>
      <Text accessibilityRole="header" style={styles.heading}>{current.heading.replace('{name}', name)}</Text>
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
      ) : current.kind === 'question' && current.q ? (
        current.q.child === 'press_force' ? (
          <ChoiceChips options={current.q.options} value={draft.press_force} onChange={(v) => set({ press_force: v as Answers['press_force'] })} />
        ) : (
          <>
            <ManyChips
              options={current.q.options as readonly { value: string; label: string }[]}
              value={draft[current.q.child] as string[]}
              onChange={(v) => set({ [current.q!.child]: v })}
            />
            {current.q.child === 'access' ? (
              <ManyChips
                options={[{ value: 'one_hand', label: `${ONE_HAND_LABEL} for ${name}` }]}
                value={draft.one_hand ? ['one_hand'] : []}
                onChange={(v) => set({ one_hand: v.length > 0 })}
              />
            ) : null}
          </>
        )
      ) : (
        <NeedsChips value={draft.everyday_needs} onChange={(v) => set({ everyday_needs: v })} />
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
    name: p.name, age: p.age, helps_with: p.helps_with ?? [], access: p.access ?? [], one_hand: p.one_hand === true,
    press_force: p.press_force, enjoys: p.enjoys ?? [], everyday_needs: p.everyday_needs ?? [],
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
  saysText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, lineHeight: 20, color: theme.colors.ink },
  help: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21, marginTop: -theme.spacing(3), marginBottom: theme.spacing(4) },
  private: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(3), textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing(5) },
  actionsRight: { flexDirection: 'row', gap: theme.spacing(2) },
})
