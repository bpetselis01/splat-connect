// packages/mobile/components/guides/build-mode.tsx
//
// "Start building" (spec docs/superpowers/specs/2026-10-06-guide-screens-redesign-design.md,
// mockup https://claude.ai/artifact/WdsP8zR1HCdjhdMCFs516n, the Combined row):
// the guide one step a screen, the way iFixit, cook modes and LEGO Builder
// separate doing from reading. It opens on Get ready (what you need, the
// safety notes, the author's checklist), then each step, then the done screen.
// "Next" ticks the step in the same device ticks the guide page shows, so the
// page's "Pick up at step N" and this screen agree, and a reopened build
// resumes. The screen stays awake while it is open.
import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Pressable, Modal, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useKeepAwake } from 'expo-keep-awake'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SAFETY_CHECKLIST, initials, type GuideNote, type Part, type Tool, type TutorialSafetyNote, type TutorialStep } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { stepProgress, ticksKey, useDeviceTicks, useGatherTicks } from '../../lib/guide-progress'
import { useGuideNotes } from '../../lib/guide-notes'
import { sentences } from '../../lib/sentences'
import { relativeTime } from '../../lib/notifications'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { FlashLine, useFlash } from '../ui/Flash'
import { PhotoViewer } from '../ui/PhotoViewer'
import { GuideParts } from './guide-parts'
import { GuideTools } from './guide-tools'

type BuildGuide = {
  id: string
  title: string
  safety_declared_at: string | null
  done_note?: string | null
  build_minutes?: number | null
  photo_urls?: string[]
  steps?: TutorialStep[]
  safety_notes?: TutorialSafetyNote[]
  parts?: Part[]
  tools?: Tool[]
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

export function BuildMode({ id, step: startStep }: { id: string; step?: string }) {
  useKeepAwake()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [guide, setGuide] = useState<BuildGuide | null>(null)
  const [failed, setFailed] = useState(false)
  const { notes } = useGuideNotes(id)
  const steps = guide?.steps ?? []
  const { ticked, toggle, reset, loaded } = useDeviceTicks(ticksKey('steps', id), steps.map((s) => s.id))
  const gather = useGatherTicks(id, guide?.parts ?? [], guide?.tools ?? [])
  // 0 is Get ready, 1..n the steps, n+1 the done screen. Null until the guide
  // lands, then the step asked for, or the first step not yet ticked.
  const [at, setAt] = useState<number | null>(null)
  const [sheet, setSheet] = useState<'steps' | 'gather' | null>(null)
  const [checksOpen, setChecksOpen] = useState(false)
  const [viewing, setViewing] = useState<{ uri: string; caption: string | null } | null>(null)
  const [notesOpen, setNotesOpen] = useState(true)
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
    // land on Get ready.
    if (!guide || at !== null || !loaded) return
    const asked = Number(startStep)
    if (Number.isInteger(asked) && asked >= 1 && asked <= steps.length) return setAt(asked)
    const resume = stepProgress(steps, ticked).resume
    setAt(resume ? resume.position : 0)
    // Once, on arrival; ticks read later must not move the reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide, ticked, loaded])

  const close = () => router.back()
  const toNotes = () => router.replace({ pathname: '/guides/[id]', params: { id, tab: 'notes' } })
  const head = (label: string, withSteps = false) => (
    <View style={[styles.head, { paddingTop: insets.top + theme.spacing(2) }]}>
      <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close build mode" hitSlop={6} style={styles.round}>
        <Ionicons name="close" size={20} color={theme.colors.ink} />
      </Pressable>
      <Text style={styles.headText} accessibilityRole="header">{label}</Text>
      {withSteps ? (
        <Pressable onPress={() => setSheet('steps')} accessibilityRole="button" accessibilityLabel="All steps" hitSlop={6} style={styles.round}>
          <Ionicons name="list" size={20} color={theme.colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.roundSpace} />
      )}
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
  const onStep = step ? notes.filter((n) => n.step_position === step.position).length : 0
  const label = at === 0 ? 'Get ready' : step ? `Step ${at} of ${total}` : 'All done'
  const parts = guide.parts ?? []
  const tools = guide.tools ?? []
  const next = () => {
    if (step && !ticked.has(step.id)) toggle(step.id)
    setAt(at + 1)
  }
  const go = (n: number) => {
    setAt(n)
    setSheet(null)
  }
  const lines = step ? sentences(step.body) : []

  return (
    <View style={styles.page}>
      {head(label, true)}
      <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel="Build progress" accessibilityValue={{ min: 0, max: total, now: steps.filter((s) => ticked.has(s.id)).length }}>
        {steps.map((s, i) => (
          <View key={s.id} style={[styles.seg, ticked.has(s.id) ? styles.segDone : i === at - 1 ? styles.segNow : null]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {at === 0 ? (
          <>
            <Text style={styles.title}>{guide.title}</Text>
            <View style={styles.chips}>
              {guide.build_minutes ? (
                <View style={styles.chip}><Ionicons name="time-outline" size={16} color={theme.colors.ink} /><Text style={styles.chipText}>{`${guide.build_minutes} min`}</Text></View>
              ) : null}
              <View style={styles.chip}><Text style={styles.chipText}>{plural(total, 'step')}</Text></View>
            </View>
            {parts.length || tools.length ? (
              <Pressable onPress={() => setSheet('gather')} accessibilityRole="button" style={styles.rowCard}>
                <View style={styles.rowIcon}><Ionicons name="cube-outline" size={22} color={theme.colors.primaryDeep} /></View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>Parts and tools</Text>
                  <Text style={styles.rowSub}>{`${gather.partsGot}/${parts.length} parts · ${gather.toolsGot}/${tools.length} tools`}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.primaryDeep} />
              </Pressable>
            ) : null}
            {guide.safety_notes?.length ? (
              <View style={styles.safety}>
                <Text style={styles.safetyHead} accessibilityRole="header">Stay safe</Text>
                {guide.safety_notes.map((n) => (
                  <View key={n.id} style={styles.safetyRow}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.ink} />
                    <View style={styles.flex}>
                      <Text style={styles.safetyTitle}>{n.title}</Text>
                      {n.detail ? <Text style={styles.small}>{n.detail}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            {guide.safety_declared_at ? (
              <View style={styles.checks}>
                <Pressable onPress={() => setChecksOpen(!checksOpen)} accessibilityRole="button" accessibilityState={{ expanded: checksOpen }} style={styles.checksHead}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.successDeep} />
                  <Text style={[styles.rowTitle, styles.flex]}>{`${SAFETY_CHECKLIST.length} safety checks passed`}</Text>
                  <Text style={styles.link}>{checksOpen ? 'Hide' : 'Show'}</Text>
                </Pressable>
                {checksOpen
                  ? SAFETY_CHECKLIST.map((s) => (
                      <View key={s} style={styles.checkRow}>
                        <Ionicons name="checkmark" size={16} color={theme.colors.successDeep} />
                        <Text style={[styles.small, styles.flex]}>{s}</Text>
                      </View>
                    ))
                  : null}
              </View>
            ) : null}
            <View style={styles.awake}>
              <Ionicons name="sunny-outline" size={18} color={theme.colors.muted} />
              <Text style={styles.muted}>Screen stays on</Text>
            </View>
          </>
        ) : step ? (
          <>
            {step.photo_url ? (
              <Pressable
                onPress={() => setViewing({ uri: step.photo_url!, caption: step.title ?? null })}
                accessibilityRole="imagebutton"
                accessibilityLabel={`Open the photo for step ${at} full screen`}
              >
                <Image source={{ uri: step.photo_url }} style={styles.photo} accessibilityLabel={step.title ? `Step ${at}: ${step.title}` : `Step ${at}`} />
                <View style={styles.expand} pointerEvents="none">
                  <Ionicons name="expand" size={18} color={theme.colors.ink} />
                </View>
              </Pressable>
            ) : null}
            <View style={styles.stepTop}>
              <View style={styles.num}><Text style={styles.numText}>{at}</Text></View>
              {step.minutes ? (
                <View style={styles.chip}><Ionicons name="time-outline" size={16} color={theme.colors.ink} /><Text style={styles.chipText}>{`${step.minutes} min`}</Text></View>
              ) : null}
            </View>
            {step.title ? <Text style={styles.title}>{step.title}</Text> : null}
            {lines.length > 1 ? (
              lines.map((l, i) => (
                <View key={i} style={styles.line}>
                  <View style={styles.letter}><Text style={styles.letterText}>{LETTERS[i] ?? i + 1}</Text></View>
                  <Text style={[styles.text, styles.flex]}>{l}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.text}>{step.body}</Text>
            )}
            {/* 129: the author's tip or caution, on the step it is about. */}
            {step.tip ? (
              <View style={styles.tip}>
                <Ionicons name="bulb-outline" size={20} color={theme.colors.ink} />
                <View style={styles.flex}>
                  <Text style={styles.cardHead}>Tip</Text>
                  <Text style={styles.noteText}>{step.tip}</Text>
                </View>
              </View>
            ) : null}
            {/* Notes the guide's contributors approved (pinned), read here on
                the step; the rest of the discussion stays on the Notes tab. */}
            {pinned.length ? (
              <View style={styles.notes}>
                <Pressable
                  onPress={() => setNotesOpen(!notesOpen)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: notesOpen }}
                  style={styles.notesHead}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.violet} />
                  <Text style={[styles.rowTitle, styles.flex]}>Notes from builders</Text>
                  <View style={styles.count}><Text style={styles.countText}>{pinned.length}</Text></View>
                  <Text style={styles.toggle}>{notesOpen ? 'Hide' : 'Show'}</Text>
                </Pressable>
                {notesOpen ? (
                  <View style={styles.notesBody}>
                    {pinned.map((n) => (
                      <StepNote key={n.id} note={n} onPhoto={(uri) => setViewing({ uri, caption: n.photo_caption })} />
                    ))}
                    {onStep > pinned.length ? (
                      <Pressable onPress={toNotes} accessibilityRole="link" style={styles.notesLink}>
                        <Text style={styles.link}>{`${plural(onStep - pinned.length, 'more note')} in the guide's Notes`}</Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.colors.primaryDeep} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : onStep ? (
              <Pressable onPress={toNotes} accessibilityRole="link" style={styles.notesLink}>
                <Ionicons name="chatbubble-outline" size={20} color={theme.colors.primaryDeep} />
                <Text style={styles.link}>{`${plural(onStep, 'note')} on this step in the guide's Notes`}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <View style={styles.done}>
            <View style={styles.medal}>
              {guide.photo_urls?.[0] ? (
                <Image source={{ uri: guide.photo_urls[0] }} style={styles.medalPhoto} accessibilityLabel="The finished build" />
              ) : (
                <View style={[styles.medalPhoto, styles.medalBlank]} />
              )}
              <View style={styles.medalTick}><Ionicons name="checkmark" size={26} color={theme.colors.onColor} /></View>
            </View>
            <Text style={[styles.title, styles.center]}>You built it!</Text>
            <Text style={[styles.muted, styles.center]}>{`All ${total} steps done`}</Text>
            {guide.done_note ? (
              <View style={styles.doneNote}>
                <Text style={styles.cardHead}>Try it out</Text>
                <Text style={styles.text}>{guide.done_note}</Text>
              </View>
            ) : null}
            <Button
              label={built ? 'Added to My SPLAT' : 'Add to My SPLAT'}
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
              style={styles.big}
            />
            <FlashLine message={flash} />
            <View style={styles.pair}>
              <Button label="Leave a note" variant="secondary" onPress={toNotes} style={styles.flex} />
              <Button label="Back to the guide" variant="ghost" onPress={close} style={styles.flex} />
            </View>
          </View>
        )}
      </ScrollView>

      {at <= total ? (
        <View style={[styles.foot, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
          {at === 0 ? (
            <Button label="Start step 1" onPress={next} style={[styles.flex, styles.big]} />
          ) : (
            <>
              <Pressable onPress={() => setAt(at - 1)} accessibilityRole="button" accessibilityLabel="Previous step" style={styles.backRound}>
                <Ionicons name="arrow-back" size={22} color={theme.colors.ink} />
              </Pressable>
              <Button label={at === total ? 'Done' : 'Next'} onPress={next} style={[styles.flex, styles.big]} />
            </>
          )}
        </View>
      ) : null}

      <PhotoViewer
        photos={viewing ? [viewing] : []}
        index={viewing ? 0 : null}
        onClose={() => setViewing(null)}
      />

      <Modal visible={sheet === 'steps'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)} onDismiss={() => setSheet(null)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={styles.flex}>
              <Text style={styles.sheetTitle}>All steps</Text>
              <Text style={styles.muted}>{`${steps.filter((s) => ticked.has(s.id)).length} of ${total} done`}</Text>
            </View>
            <Pressable onPress={() => setSheet(null)} accessibilityRole="button" accessibilityLabel="Close all steps" style={styles.round}>
              <Ionicons name="close" size={20} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetList}>
            <Pressable onPress={() => go(0)} accessibilityRole="button" style={[styles.sheetRow, at === 0 && styles.sheetRowNow]}>
              <View style={styles.dot}><Ionicons name="warning-outline" size={18} color={theme.colors.ink} /></View>
              <Text style={[styles.rowTitle, styles.flex]}>Get ready</Text>
            </Pressable>
            {steps.map((s) => {
              const done = ticked.has(s.id)
              const now = s.position === at
              return (
                <Pressable key={s.id} onPress={() => go(s.position)} accessibilityRole="button" accessibilityLabel={`Step ${s.position}: ${s.title || s.body}${done ? ', done' : ''}`} style={[styles.sheetRow, now && styles.sheetRowNow]}>
                  <View style={[styles.dot, done && styles.dotDone, now && !done && styles.dotNow]}>
                    {done ? <Ionicons name="checkmark" size={18} color={theme.colors.onColor} /> : <Text style={[styles.dotText, now && styles.onColor]}>{s.position}</Text>}
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.rowTitle, done && styles.struck]} numberOfLines={2}>{s.title || s.body}</Text>
                    {now ? <Text style={styles.here}>{s.minutes ? `You're here · ${s.minutes} min` : "You're here"}</Text> : s.minutes ? <Text style={styles.rowSub}>{`${s.minutes} min`}</Text> : null}
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
          <View style={[styles.sheetFoot, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
            <Button label="Start over and clear ticks" variant="secondary" onPress={() => { reset(); go(0) }} />
          </View>
        </View>
      </Modal>

      <Modal visible={sheet === 'gather'} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(null)} onDismiss={() => setSheet(null)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTitle, styles.flex]}>Parts and tools</Text>
            <Pressable onPress={() => setSheet(null)} accessibilityRole="button" accessibilityLabel="Close parts and tools" style={styles.round}>
              <Ionicons name="close" size={20} color={theme.colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetList}>
            <GuideParts parts={parts} pricesCheckedOn={null} ticks={gather.parts} />
            <GuideTools tools={tools} ticks={gather.tools} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

/** One approved note on a step: who, who approved it, the note, its photo. */
function StepNote({ note, onPhoto }: { note: GuideNote; onPhoto: (uri: string) => void }) {
  return (
    <View style={styles.note}>
      <View style={styles.avatar}><Text style={styles.avatarText}>{initials(note.author_name, '?')}</Text></View>
      <View style={[styles.flex, styles.noteMain]}>
        <View style={styles.noteTop}>
          <Text style={styles.noteAuthor}>{note.author_name}</Text>
          <View style={styles.approved}>
            <Ionicons name="pin" size={12} color={theme.colors.ink} />
            <Text style={styles.approvedText}>{`Approved by ${(note.pinned_by_name ?? 'the author').split(' ')[0]}`}</Text>
          </View>
        </View>
        <Text style={styles.noteText}>{note.body}</Text>
        {note.photo_url ? (
          <Pressable onPress={() => onPhoto(note.photo_url!)} accessibilityRole="imagebutton" accessibilityLabel={`Open ${note.author_name}'s photo full screen`}>
            <Image source={{ uri: note.photo_url }} style={styles.notePhoto} accessibilityLabel={note.photo_caption ?? `Photo from ${note.author_name}`} />
          </Pressable>
        ) : null}
        <Text style={styles.noteWhen}>{relativeTime(note.created_at)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  notes: { borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  notesHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 60, paddingHorizontal: theme.spacing(5) },
  count: { paddingHorizontal: theme.spacing(2), paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.violetSoft },
  countText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  toggle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  notesBody: { paddingHorizontal: theme.spacing(5), paddingBottom: theme.spacing(5), gap: theme.spacing(4) },
  note: { flexDirection: 'row', gap: theme.spacing(3) },
  noteMain: { gap: theme.spacing(1) },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  avatarText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  noteTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing(2) },
  noteAuthor: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  approved: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing(2), paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.violetSoft },
  approvedText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  notePhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken, marginTop: theme.spacing(1) },
  noteWhen: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  page: { flex: 1, backgroundColor: theme.colors.background },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2) },
  round: { width: 44, height: 44, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  roundSpace: { width: 44, height: 44 },
  headText: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  bar: { flexDirection: 'row', gap: 6, marginHorizontal: theme.spacing(4) },
  seg: { flex: 1, height: 8, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken },
  segDone: { backgroundColor: theme.colors.success },
  segNow: { backgroundColor: theme.colors.primary },
  body: { padding: theme.spacing(4), gap: theme.spacing(4) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.display, color: theme.colors.ink, lineHeight: 34 },
  text: { fontFamily: theme.fonts.regular, fontSize: theme.type.heading, color: theme.colors.text, lineHeight: 29 },
  small: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.ink, lineHeight: 20 },
  muted: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.muted },
  link: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.primaryDeep },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: theme.spacing(3), paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken },
  chipText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(5), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  rowIcon: { width: 44, height: 44, borderRadius: theme.radii.field, backgroundColor: theme.colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  rowSub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  safetyHead: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink },
  expand: { position: 'absolute', right: theme.spacing(3), bottom: theme.spacing(3), width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadow(1) },
  cardHead: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  safety: { padding: theme.spacing(5), gap: theme.spacing(3), borderRadius: theme.radii.panel, backgroundColor: theme.colors.honeySoft },
  safetyRow: { flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start' },
  safetyTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  checks: { borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: theme.spacing(5), paddingBottom: theme.spacing(1) },
  checksHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), minHeight: 52 },
  checkRow: { flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start', paddingLeft: theme.spacing(7), paddingBottom: theme.spacing(2) },
  awake: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.panel, backgroundColor: theme.colors.surfaceSunken },
  stepTop: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  num: { width: 44, height: 44, borderRadius: theme.radii.field, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: theme.fonts.black, fontSize: theme.type.heading, color: theme.colors.onColor },
  line: { flexDirection: 'row', gap: theme.spacing(3), alignItems: 'flex-start' },
  letter: { width: 28, height: 28, marginTop: 0, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  tip: { flexDirection: 'row', gap: theme.spacing(3), padding: theme.spacing(5), borderRadius: theme.radii.panel, backgroundColor: theme.colors.honeySoft },
  fix: { flexDirection: 'row', gap: theme.spacing(3), padding: theme.spacing(5), borderRadius: theme.radii.panel, backgroundColor: theme.colors.violetSoft },
  noteText: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.ink, lineHeight: 23 },
  notesLink: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), minHeight: 44 },
  done: { gap: theme.spacing(3), alignItems: 'stretch' },
  medal: { alignSelf: 'center', width: 168, height: 168, marginTop: theme.spacing(2) },
  medalPhoto: { width: 168, height: 168, borderRadius: 84, borderWidth: 6, borderColor: theme.colors.surface, backgroundColor: theme.colors.surfaceSunken },
  medalBlank: { backgroundColor: theme.colors.mintSoft },
  medalTick: { position: 'absolute', right: 4, bottom: 4, width: 52, height: 52, borderRadius: 26, borderWidth: 4, borderColor: theme.colors.background, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center' },
  doneNote: { gap: theme.spacing(1), padding: theme.spacing(4), borderRadius: theme.radii.panel, backgroundColor: theme.colors.mintSoft },
  big: { minHeight: 56 },
  pair: { flexDirection: 'row', gap: theme.spacing(2) },
  foot: { flexDirection: 'row', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  backRound: { width: 56, height: 56, borderRadius: 28, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, backgroundColor: theme.colors.surface },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(4) },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  sheetList: { paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(6) },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 60, paddingHorizontal: theme.spacing(2), borderRadius: theme.radii.field },
  sheetRowNow: { backgroundColor: theme.colors.accentLight },
  sheetFoot: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  dot: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  dotDone: { backgroundColor: theme.colors.success },
  dotNow: { backgroundColor: theme.colors.primary },
  dotText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  onColor: { color: theme.colors.onColor },
  struck: { textDecorationLine: 'line-through', color: theme.colors.muted },
  here: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.primaryDeep },
})
