// packages/mobile/components/guides/guide-steps.tsx
//
// The board's Steps block on a guide: tap a step to tick it, a percent and a
// bar, Reset, and "Pick up at step N". Ticks live on the device
// (lib/guide-progress.ts); nothing here is sent anywhere.
import type { ReactNode } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { TutorialStep } from '@splat-connect/types'
import { stepProgress, ticksKey, useDeviceTicks } from '../../lib/guide-progress'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'
import { Meter } from '../ui/Meter'
import { Button } from '../ui/Button'
import { FlashLine, useFlash } from '../ui/Flash'

export function GuideSteps({
  tutorialId,
  steps,
  completion,
  noteLabels,
  extras,
}: {
  tutorialId: string
  steps: TutorialStep[]
  /** Drawn once every step is ticked; given how many there are. */
  completion: (total: number) => ReactNode
  /** "1 pinned revision · 2 notes", by step position (lib/guide-notes.ts). */
  noteLabels?: Map<number, string>
  /** Pinned "Missing step" notes, drawn as steps after the last. */
  extras?: { no: number; body: string; by: string; pinnedBy: string }[]
}) {
  const { ticked, toggle, reset } = useDeviceTicks(ticksKey('steps', tutorialId), steps.map((s) => s.id))
  const progress = stepProgress(steps, ticked)
  const [flash, setFlash] = useFlash()

  return (
    <Section title="Steps" hint="One action at a time. The PDF has the same guide to print.">
      <View style={styles.head}>
        <Text style={styles.pct}>{`${progress.pct}%`}</Text>
        <View style={styles.headText}>
          <Text style={styles.done}>{`${progress.done} of ${progress.total} steps done`}</Text>
          <View accessibilityRole="progressbar" accessibilityLabel="Build progress" accessibilityValue={{ min: 0, max: 100, now: progress.pct }}>
            <Meter value={progress.pct} max={100} width={150} />
          </View>
        </View>
        <Button
          label="Reset"
          variant="ghost"
          onPress={() => {
            reset()
            setFlash('Step progress cleared')
          }}
        />
      </View>
      <FlashLine message={flash} />
      {progress.resume ? (
        <Text style={styles.resume}>
          {`Pick up at step ${progress.resume.position}${progress.resume.title ? ` — ${progress.resume.title}` : ''}`}
        </Text>
      ) : null}

      {steps.map((st) => {
        const done = ticked.has(st.id)
        return (
          <Pressable
            key={st.id}
            testID={`guide-step-${st.position}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={done ? `Mark step ${st.position} as not done` : `Mark step ${st.position} done`}
            onPress={() => toggle(st.id)}
            style={[styles.step, done && styles.stepDone]}
          >
            <View style={[styles.stepNum, done && styles.stepNumDone]}>
              {done ? (
                <Ionicons name="checkmark" size={16} color={theme.colors.onColor} />
              ) : (
                <Text style={styles.stepNumText}>{st.position}</Text>
              )}
            </View>
            <View style={styles.stepText}>
              {st.title ? <Text style={[styles.stepTitle, done && styles.muted]}>{st.title}</Text> : null}
              <Text style={styles.stepBody}>{st.body}</Text>
              {st.photo_url ? (
                <Image
                  source={{ uri: st.photo_url }}
                  style={styles.stepPhoto}
                  accessibilityLabel={st.title ? `Step ${st.position}: ${st.title}` : `Step ${st.position}`}
                />
              ) : null}
              {noteLabels?.get(st.position) ? <Text style={styles.noteLabel}>{noteLabels.get(st.position)}</Text> : null}
            </View>
          </Pressable>
        )
      })}

      {(extras ?? []).map((x) => (
        <View key={x.no} style={styles.extra}>
          <View style={styles.extraHead}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{x.no}</Text>
            </View>
            <Text style={styles.stepTitle}>Added by the community</Text>
          </View>
          <Text style={styles.stepBody}>{x.body}</Text>
          <Text style={styles.noteLabel}>{`Pinned by ${x.pinnedBy} · suggested by ${x.by}`}</Text>
        </View>
      ))}

      {progress.allDone ? completion(progress.total) : null}
    </Section>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), marginBottom: theme.spacing(2) },
  pct: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  headText: { flex: 1, gap: theme.spacing(1) },
  done: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  resume: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink, marginBottom: theme.spacing(2) },
  step: { flexDirection: 'row', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  stepDone: { opacity: 0.7 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  stepNumDone: { backgroundColor: theme.colors.success },
  stepNumText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  stepText: { flex: 1, gap: theme.spacing(1) },
  stepTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  muted: { color: theme.colors.muted },
  stepBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21 },
  stepPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.field, marginTop: theme.spacing(1), backgroundColor: theme.colors.surfaceSunken },
  noteLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDark },
  extra: { padding: theme.spacing(3), gap: theme.spacing(1), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft, marginVertical: theme.spacing(1) },
  extraHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
})
