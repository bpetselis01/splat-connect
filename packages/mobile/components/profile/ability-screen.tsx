// packages/mobile/components/profile/ability-screen.tsx
import { useState } from 'react'
import { ScrollView, View, Text, Pressable, StyleSheet } from 'react-native'
import type { ChildProfile } from '@splat-connect/types'
import { useChildProfile } from '../../lib/use-child-profile'
import { estimateAbility, QUESTIONS } from '../../lib/estimate-ability'
import { theme } from '../../lib/theme'
import { Dropdown } from './fields'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'

const DIAGNOSES = ['Cerebral palsy', 'Limb difference', 'Brachial plexus injury', 'Other'].map((d) => ({ label: d, value: d }))
const MACS_LEVELS = ['I', 'II', 'III', 'IV', 'V'].map((l) => ({ label: l, value: l }))
const BFMF_SCORES = ['1', '2', '3', '4', '5'].map((s) => ({ label: s, value: s }))
const HAND_INVOLVEMENT = [
  { label: 'Bilateral', value: 'bilateral' },
  { label: 'Unilateral', value: 'unilateral' },
]
const ASSIST_HAND = [
  { label: 'Left', value: 'left' },
  { label: 'Right', value: 'right' },
]

export function AbilityScreen() {
  const { profile, save } = useChildProfile()
  const [showQuiz, setShowQuiz] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null))

  const isUnilateral = profile?.hand_involvement === 'unilateral'

  function setAnswer(qi: number, oi: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[qi] = oi
      return next
    })
  }

  function runEstimate() {
    if (answers.some((a) => a == null)) return // require all questions answered
    const { macs, bfmf } = estimateAbility(answers as number[])
    save({ macs_level: macs, bfmf_score: bfmf, macs_source: 'estimated', bfmf_source: 'estimated' })
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Dropdown
        label="Primary diagnosis"
        value={profile?.primary_diagnosis ?? null}
        options={DIAGNOSES}
        onChange={(v) => save({ primary_diagnosis: v })}
      />
      <Dropdown
        label="MACS level"
        value={profile?.macs_level ?? null}
        options={MACS_LEVELS}
        onChange={(v) => save({ macs_level: v, macs_source: 'manual' })}
      />
      <Dropdown
        label="Hand involvement"
        value={profile?.hand_involvement ?? null}
        options={HAND_INVOLVEMENT}
        onChange={(v) => save({ hand_involvement: v as ChildProfile['hand_involvement'] })}
      />
      {isUnilateral ? (
        <Dropdown
          label="Assisting hand"
          value={profile?.assist_hand ?? null}
          options={ASSIST_HAND}
          onChange={(v) => save({ assist_hand: v as ChildProfile['assist_hand'] })}
        />
      ) : null}
      <Dropdown
        label="BFMF score"
        value={profile?.bfmf_score ?? null}
        options={BFMF_SCORES}
        onChange={(v) => save({ bfmf_score: v, bfmf_source: 'manual' })}
      />

      <Pressable onPress={() => setShowQuiz((s) => !s)} style={styles.quizToggle}>
        <Text style={styles.quizToggleText}>Not sure of the clinical terms?</Text>
      </Pressable>

      {showQuiz ? (
        <View>
          {QUESTIONS.map((q, qi) => (
            <View key={qi} style={styles.question}>
              <Text style={styles.prompt}>{q.prompt}</Text>
              <View style={styles.optionRow}>
                {q.options.map((opt, oi) => (
                  <Chip key={oi} label={opt} active={answers[qi] === oi} onPress={() => setAnswer(qi, oi)} />
                ))}
              </View>
            </View>
          ))}
          <Button label="Estimate" onPress={runEstimate} />
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4) },
  quizToggle: {
    backgroundColor: theme.colors.accentLight,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
  },
  quizToggleText: { fontFamily: theme.fonts.semiBold, color: theme.colors.primary },
  question: { marginBottom: theme.spacing(4) },
  prompt: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(2) },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
