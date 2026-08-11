// packages/mobile/components/profile/ability-screen.tsx
import { useState } from 'react'
import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { estimateAbility, QUESTIONS, type ChildProfile } from '@splat-connect/types'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Dropdown } from './fields'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Section } from '../ui/Section'
import { AnimatedPressable } from '../ui/AnimatedPressable'

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
  const answered = answers.filter((a) => a != null).length

  // The chevron points at the panel it controls, so it turns with it rather
  // than snapping once the content has already moved.
  const spin = useDerivedValue(() => withTiming(showQuiz ? 1 : 0, { duration: theme.motion.fast }))
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 180}deg` }] }))

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
      <Text style={styles.intro}>
        Used to match tutorials and 3D print models to your child&apos;s needs.
      </Text>

      <Section title="Diagnosis">
        <Dropdown
          label="Primary diagnosis"
          value={profile?.primary_diagnosis ?? null}
          options={DIAGNOSES}
          onChange={(v) => save({ primary_diagnosis: v })}
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
      </Section>

      <Section
        title="Hand function"
        hint="MACS describes how your child handles objects; BFMF describes hand function. If you don't know these, use the questions below."
      >
        <Dropdown
          label="MACS level"
          value={profile?.macs_level ?? null}
          options={MACS_LEVELS}
          onChange={(v) => save({ macs_level: v, macs_source: 'manual' })}
        />
        <Dropdown
          label="BFMF score"
          value={profile?.bfmf_score ?? null}
          options={BFMF_SCORES}
          onChange={(v) => save({ bfmf_score: v, bfmf_source: 'manual' })}
        />
      </Section>

      <AnimatedPressable
        onPress={() => setShowQuiz((s) => !s)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showQuiz }}
        pressScale={0.99}
      >
        <Card variant="feature" style={styles.quizToggle}>
          <View style={styles.quizToggleBody}>
            <Text style={styles.quizToggleText}>Not sure of the clinical terms?</Text>
            <Text style={styles.quizToggleHint}>
              Answer a few simple questions instead — we&apos;ll estimate MACS and BFMF for you.
            </Text>
          </View>
          <Animated.View style={chevron}>
            <Ionicons name="chevron-down" size={20} color={theme.colors.primaryDeep} />
          </Animated.View>
        </Card>
      </AnimatedPressable>

      {showQuiz ? (
        <View style={styles.quiz}>
          {QUESTIONS.map((q, qi) => (
            <Card key={qi} style={styles.question}>
              <Text style={styles.prompt}>{q.prompt}</Text>
              <View style={styles.optionRow}>
                {q.options.map((opt, oi) => (
                  <Chip key={oi} label={opt} active={answers[qi] === oi} onPress={() => setAnswer(qi, oi)} />
                ))}
              </View>
            </Card>
          ))}
          <Text style={styles.progress}>
            {answered} of {QUESTIONS.length} answered
          </Text>
          <Button label="Estimate" onPress={runEstimate} disabled={answered < QUESTIONS.length} />
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  intro: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 21,
    marginBottom: theme.spacing(5),
  },
  quizToggle: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  quizToggleBody: { flex: 1 },
  quizToggleText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.body,
    color: theme.colors.primaryDeep,
  },
  quizToggleHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDark,
    lineHeight: 18,
    marginTop: theme.spacing(1),
  },
  quiz: { marginTop: theme.spacing(4) },
  question: { marginBottom: theme.spacing(3) },
  prompt: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(3),
    lineHeight: 20,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  progress: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    textAlign: 'center',
    marginBottom: theme.spacing(3),
  },
})
