// packages/mobile/components/profile/ability-screen.tsx
//
// Copy here is deliberate (see web's /legal/intended-purpose): the questions
// are framed as fitting/matching, never as estimating a clinical score for
// the parent. MACS/BFMF appear only inside the collapsed "Clinical scores
// (optional)" disclosure, which records a clinician's existing finding.
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { deriveFitProfile, QUESTIONS, type ChildProfile } from '@splat-connect/types'
import { useChildProfile } from '../../lib/use-child-profile'
import { theme } from '../../lib/theme'
import { Dropdown, FormScreen } from './fields'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Section } from '../ui/Section'
import { AnimatedPressable } from '../ui/AnimatedPressable'

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

/** A tappable header that folds a panel open, chevron turning with it. */
function DisclosureCard({
  open,
  onToggle,
  title,
  hint,
}: {
  open: boolean
  onToggle: () => void
  title: string
  hint: string
}) {
  const spin = useDerivedValue(() => withTiming(open ? 1 : 0, { duration: theme.motion.fast }))
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 180}deg` }] }))
  return (
    <AnimatedPressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      pressScale={0.99}
    >
      <Card variant="feature" style={styles.disclosure}>
        <View style={styles.disclosureBody}>
          <Text style={styles.disclosureText}>{title}</Text>
          <Text style={styles.disclosureHint}>{hint}</Text>
        </View>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={20} color={theme.colors.primaryDeep} />
        </Animated.View>
      </Card>
    </AnimatedPressable>
  )
}

export function AbilityScreen({ childId }: { childId?: string } = {}) {
  const { profile, save } = useChildProfile(childId)
  const [showQuiz, setShowQuiz] = useState(false)
  const [showScores, setShowScores] = useState(false)
  const [answers, setAnswers] = useState<(number | null)[]>(() => QUESTIONS.map(() => null))

  const isUnilateral = profile?.hand_involvement === 'unilateral'
  const answered = answers.filter((a) => a != null).length

  function setAnswer(qi: number, oi: number) {
    setAnswers((prev) => {
      const next = [...prev]
      next[qi] = oi
      return next
    })
  }

  function saveAnswers() {
    if (answers.some((a) => a == null)) return // require all questions answered
    const { macsInternal, bfmfInternal } = deriveFitProfile(answers as number[])
    save({ macs_level: macsInternal, bfmf_score: bfmfInternal, macs_source: 'estimated', bfmf_source: 'estimated' })
  }

  return (
    <FormScreen intro="Used to match guides and devices to how your child plays.">

      <Section title="Hand use">
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

      <DisclosureCard
        open={showQuiz}
        onToggle={() => setShowQuiz((s) => !s)}
        title="How does your child use their hands?"
        hint="A few questions. We use your answers to suggest guides and devices that are likely to suit them. This is not an assessment, and it doesn't replace advice from your child's occupational therapist."
      />

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
          <Button label="Save answers" onPress={saveAnswers} disabled={answered < QUESTIONS.length} />
        </View>
      ) : null}

      <DisclosureCard
        open={showScores}
        onToggle={() => setShowScores((s) => !s)}
        title="Clinical scores (optional)"
        hint="If an occupational therapist or paediatrician has given you a MACS or BFMF level, you can enter it here and we'll use it instead of our own estimate. Leave this blank if you're not sure — you don't need it."
      />

      {showScores ? (
        <View style={styles.scores}>
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
        </View>
      ) : null}
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), marginBottom: theme.spacing(4) },
  disclosureBody: { flex: 1 },
  disclosureText: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.body,
    color: theme.colors.primaryDeep,
  },
  disclosureHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDark,
    lineHeight: 18,
    marginTop: theme.spacing(1),
  },
  quiz: { marginBottom: theme.spacing(4) },
  scores: { marginBottom: theme.spacing(4) },
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
