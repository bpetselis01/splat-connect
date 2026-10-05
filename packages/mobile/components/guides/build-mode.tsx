// packages/mobile/components/guides/build-mode.tsx
//
// "Start building" (spec D, mockup https://claude.ai/artifact/6AShefEyee5vRADQb9LCyT):
// the guide one step a screen, the way iFixit, cook modes and LEGO Builder
// separate doing from reading. It opens on "Before you start" (the safety
// notes and the author's checklist), then each step with its photo and any
// pinned community note on it, then the done screen. "Done, next" ticks the
// step in the same device ticks the guide page shows, so the page's
// "Pick up at step N" and this screen agree, and a reopened build resumes.
import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SAFETY_CHECKLIST, type TutorialSafetyNote, type TutorialStep } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { stepProgress, ticksKey, useDeviceTicks } from '../../lib/guide-progress'
import { useGuideNotes } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { FlashLine, useFlash } from '../ui/Flash'

type BuildGuide = {
  id: string
  title: string
  safety_declared_at: string | null
  steps?: TutorialStep[]
  safety_notes?: TutorialSafetyNote[]
}

export function BuildMode({ id }: { id: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [guide, setGuide] = useState<BuildGuide | null>(null)
  const [failed, setFailed] = useState(false)
  const { notes } = useGuideNotes(id)
  const steps = guide?.steps ?? []
  const { ticked, toggle, loaded } = useDeviceTicks(ticksKey('steps', id), steps.map((s) => s.id))
  // 0 is Before you start, 1..n the steps, n+1 the done screen. Null until the
  // guide lands, then the first step not yet ticked (a resumed build).
  const [at, setAt] = useState<number | null>(null)
  const [built, setBuilt] = useState(false)
  const [flash, setFlash] = useFlash()

  useEffect(() => {
    apiClient
      .get<BuildGuide>(`/api/public/tutorials/${id}`)
      .then(setGuide)
      .catch(() => setFailed(true))
  }, [id])

  useEffect(() => {
    // Wait for the stored ticks of this guide's steps, or every reopen would
    // land on Before you start.
    if (!guide || at !== null || !loaded) return
    const resume = stepProgress(steps, ticked).resume
    setAt(resume ? resume.position : 0)
    // Once, on arrival; ticks read later must not move the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide, ticked, loaded])

  const close = () => router.back()
  const head = (label: string) => (
    <View style={[styles.head, { paddingTop: insets.top + theme.spacing(2) }]}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close build mode" hitSlop={8} style={styles.close}>
        <Ionicons name="close" size={18} color={theme.colors.ink} />
      </Pressable>
      <Text style={styles.headText} accessibilityRole="header">{label}</Text>
      <View style={styles.close} />
    </View>
  )

  if (failed) return <View style={styles.page}>{head('Build')}<EmptyState icon="cloud-offline-outline" title="Couldn't load this guide. Please try again." /></View>
  if (!guide || at === null) {
    return (
      <View style={styles.page}>
        {head('Build')}
        <View style={styles.body}><Skeleton width="100%" height={180} /><Skeleton width="70%" height={22} /></View>
      </View>
    )
  }
  if (!steps.length) return <View style={styles.page}>{head(guide.title)}<EmptyState icon="list-outline" title="This guide has no steps yet." hint="The PDF on the guide page has the full build." /></View>

  const total = steps.length
  const step = at >= 1 && at <= total ? steps[at - 1] : null
  const pinned = step ? notes.filter((n) => n.pinned_at && n.step_position === step.position) : []
  const label = at === 0 ? 'Before you start' : step ? `Step ${at} of ${total}` : 'All done'
  const next = () => {
    if (step && !ticked.has(step.id)) toggle(step.id)
    setAt(at + 1)
  }

  return (
    <View style={styles.page}>
      {head(label)}
      <View
        style={styles.bar}
        accessibilityRole="progressbar"
        accessibilityLabel="Build progress"
        accessibilityValue={{ min: 0, max: total, now: Math.min(Math.max(at - 1, 0), total) }}
      >
        <View style={[styles.barFill, { width: `${(Math.min(Math.max(at - 1, 0), total) / total) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {at === 0 ? (
          <>
            <Text style={styles.title}>{guide.title}</Text>
            <Text style={styles.text}>{`${total} step${total === 1 ? '' : 's'}. Each one is ticked as you go, so you can stop and come back.`}</Text>
            {guide.safety_notes?.length ? (
              <View style={styles.safety}>
                <Text style={styles.safetyHead}>Safety</Text>
                {guide.safety_notes.map((n) => (
                  <View key={n.id} style={styles.safetyRow}>
                    <Ionicons name="warning-outline" size={16} color={theme.colors.ink} />
                    <View style={styles.flex}>
                      <Text style={styles.safetyTitle}>{n.title}</Text>
                      {n.detail ? <Text style={styles.safetyDetail}>{n.detail}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {guide.safety_declared_at ? (
              <View style={styles.checklist}>
                <Text style={styles.safetyHead}>The author checked that</Text>
                {SAFETY_CHECKLIST.map((s) => (
                  <View key={s} style={styles.safetyRow}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                    <Text style={[styles.safetyDetail, styles.flex]}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : step ? (
          <>
            {step.photo_url ? (
              <Image source={{ uri: step.photo_url }} style={styles.photo} accessibilityLabel={step.title ? `Step ${at}: ${step.title}` : `Step ${at}`} />
            ) : null}
            {step.title ? <Text style={styles.title}>{step.title}</Text> : null}
            <Text style={styles.text}>{step.body}</Text>
            {pinned.map((n) => (
              <View key={n.id} style={styles.note}>
                <Ionicons name="pin" size={15} color={theme.colors.ink} />
                <Text style={[styles.noteText, styles.flex]}>{`${n.body} — pinned by ${n.pinned_by_name ?? 'the author'}`}</Text>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.done}>
            <Text style={styles.title}>{`All ${total} steps done`}</Text>
            <Text style={styles.text}>Log it and this build shows up in My SPLAT. Did it work? A note on the guide helps the next family.</Text>
            <Button
              label={built ? 'Build logged' : 'Mark this build done'}
              disabled={built}
              onPress={async () => {
                try {
                  await apiClient.post(`/api/tutorials/${id}/build`, {})
                  setBuilt(true)
                  setFlash('Build logged — nice work')
                } catch {
                  setFlash('Could not log that. Try again.')
                }
              }}
            />
            <FlashLine message={flash} />
            <Button label="Leave a note" variant="secondary" onPress={() => router.replace({ pathname: '/guides/[id]', params: { id, tab: 'notes' } })} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
        <Button label="Back" variant="secondary" disabled={at === 0} onPress={() => setAt(at - 1)} />
        {at <= total ? (
          <Button label={at === 0 ? 'Start step 1' : at === total ? 'Done' : 'Done, next step'} onPress={next} style={styles.flex} />
        ) : (
          <Button label="Back to the guide" onPress={close} style={styles.flex} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2) },
  close: { width: 36, height: 36, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  headText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  bar: { height: 6, marginHorizontal: theme.spacing(4), borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.colors.primary },
  body: { padding: theme.spacing(4), gap: theme.spacing(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink, lineHeight: 30 },
  text: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text, lineHeight: 24 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.panel, backgroundColor: theme.colors.surfaceSunken },
  safety: { padding: theme.spacing(3), gap: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft },
  checklist: { padding: theme.spacing(3), gap: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.mintSoft },
  safetyHead: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  safetyRow: { flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start' },
  safetyTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  safetyDetail: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  note: { flexDirection: 'row', gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.violetSoft },
  noteText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  done: { gap: theme.spacing(3), alignItems: 'stretch' },
  foot: { flexDirection: 'row', gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  flex: { flex: 1 },
})
