import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { View, Text, ScrollView, Pressable, Linking, StyleSheet, type StyleProp, type TextStyle } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { isNetworkError } from '@splat-connect/types'
import { logFailure } from '../../lib/log'
import type { Tutorial, Part, Tool, StlFile, Recommendation, TutorialStep, TutorialSafetyNote, ChildProfile, Difficulty } from '@splat-connect/types'
import {
  CHILD_QUESTIONS, DEVICE_TYPES, DIFFICULTY_LABEL, KIND_LABEL, MATURITY_LABEL, ONE_HAND_LABEL, SAFETY_CHECKLIST,
  fitLine, formatAgeRange, formatBuildTime, printSettingRows,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useSaves } from '../../lib/saves'
import { recordRecent } from '../../lib/recents'
import { useMyChildren } from '../../lib/my-children'
import { useCapabilities } from '../../lib/capabilities'
import { useGuideNotes, noteSummary, stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { takeGuideFocus } from '../../lib/guide-focus'
import { Byline, Provenance, type ProvenanceContributor, type ProvenanceOrg } from '../guides/provenance'
import { PicksRow } from '../guides/picks-row'
import { GuideParts } from '../guides/guide-parts'
import { GuideTools } from '../guides/guide-tools'
import { stepProgress, ticksKey, useDeviceTicks, useGatherTicks } from '../../lib/guide-progress'
import { CommunityNotes } from '../guides/community-notes'
import { Badge } from '../ui/Badge'
import { ItemActions } from '../ui/ItemActions'
import { Toast, useToast } from '../ui/Toast'
import { PhotoCarousel } from '../ui/PhotoCarousel'
import { PhotoViewer } from '../ui/PhotoViewer'
import { Button } from '../ui/Button'
import { stlName, webGuideUrl } from '../../lib/guide-files'
import { Section } from '../ui/Section'
import { Segmented } from '../ui/Segmented'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const HERO_HEIGHT = 264
// Same face as the prose around it: a bolder nested face is measured wrong on iOS and clips.
const linkStyle: TextStyle = { color: theme.colors.primaryDeep, textDecorationLine: 'underline' }

/** The lead sentence the board shows under the title; the rest reads below. */
export function splitLead(text: string): { lead: string; rest: string } {
  const m = /^[\s\S]*?[.!?](\s+|$)/.exec(text)
  if (!m) return { lead: text, rest: '' }
  return { lead: m[0].trim(), rest: text.slice(m[0].length).trim() }
}

type TutorialDetail = Tutorial & {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_contributors: ProvenanceContributor[]
  tutorial_orgs: ProvenanceOrg[]
  tutorial_recommendations: Recommendation[]
  steps?: TutorialStep[]
  safety_notes?: TutorialSafetyNote[]
}

type Tab = 'overview' | 'parts' | 'files' | 'notes'

const DIFF_TINT: Record<Difficulty, string> = {
  easy: theme.colors.successSoft,
  medium: theme.colors.honeySoft,
  hard: theme.colors.apricotSoft,
}

/**
 * Prose with its web addresses as links named by their site ("github.com"):
 * a bare URL is one unbreakable word that iOS clips at the card's edge.
 */
/**
 * The site a link opens, for its label — or null when the address is not
 * plainly one host. Only a bare host (letters, digits, dots, hyphens; an
 * optional port) followed by a path with no backslash or "@" qualifies, so
 * this reading and the browser's cannot disagree: "github.com@evil.example"
 * and "evil.example\\@github.com" stay plain text, never a link.
 */
export function linkSite(url: string): string | null {
  const m = /^https?:\/\/([a-z0-9.-]+)(:\d+)?(?:[/?#][^\s\\@]*)?$/i.exec(url)
  return m ? m[1].replace(/^www\./i, '') : null
}

function Linkified({ text, style }: { text: string; style: StyleProp<TextStyle> }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/)
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part
        const url = part.replace(/[.,;:)]+$/, '')
        const site = linkSite(url)
        if (!site) return part
        return (
          <Text key={i}>
            <Text accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={linkStyle}>{site}</Text>
            {part.slice(url.length)}
          </Text>
        )
      })}
    </Text>
  )
}

/** How far under the header a row scrolled into view sits. */
export const ROW_SCROLL_MARGIN = 72

/** One line of What you'll need: what, and the pill naming the tab it opens. */
function NeedRow({ testID, icon, text, tab, print, onPress }: { testID: string; icon: React.ComponentProps<typeof Ionicons>['name']; text: string; tab: string; print?: boolean; onPress: () => void }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}, opens ${tab}`} style={[styles.needRow, print && styles.needPrint]}>
      <View style={[styles.needIcon, print && styles.needIconPrint]}>
        <Ionicons name={icon} size={18} color={print ? theme.colors.ink : theme.colors.primaryDeep} />
      </View>
      <Text style={styles.needText}>{text}</Text>
      <View style={styles.needGo}>
        <Text style={styles.needGoText}>{tab}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.primaryDeep} />
      </View>
    </Pressable>
  )
}

/**
 * "Who it's for" as label → chosen answers, one row per answered question;
 * an answer the parent's first child shares is marked so the chip can say so.
 */
function whoRows(t: Tutorial, child: ChildProfile | undefined) {
  return CHILD_QUESTIONS.map((q) => {
    const childHas = (v: string) => {
      const c = child?.[q.child] as string | string[] | null | undefined
      return Array.isArray(c) ? c.includes(v) : c === v
    }
    const values = ((t[q.item] as string[] | null) ?? []).map((v) => ({
      label: q.options.find((o) => o.value === v)?.label ?? v,
      shared: childHas(v),
    }))
    if (q.item === 'access' && t.one_hand) values.push({ label: ONE_HAND_LABEL, shared: !!child?.one_hand })
    return {
      label: q.item === 'access' ? 'How a child uses it' : q.item === 'press_force' ? 'Press force it works with' : q.label,
      values,
    }
  }).filter((r) => r.values.length)
}

/**
 * One guide (spec docs/superpowers/specs/2026-10-06-guide-screens-redesign-design.md,
 * mockup https://claude.ai/artifact/WdsP8zR1HCdjhdMCFs516n, the Combined row):
 * the first screen says what it is, whether it suits your child and what it
 * takes, with Start building pinned to the bottom; the four tabs below stick
 * to the top as you scroll.
 */
/** The owner's route sends the editor's shape; the page reads the public one. */
function asPublicShape(t: TutorialDetail): TutorialDetail {
  return {
    ...t,
    tutorial_orgs: [], // backing is shown once an org has accepted, and a draft has no public page yet
    tutorial_contributors: (t.tutorial_contributors ?? []).map((c) => ({ former_names: [], former_count: 0, ...c })),
    tutorial_recommendations: (t.tutorial_recommendations ?? []).filter((r) => r.tutorials?.status === 'approved'),
  }
}

export function DetailScreen({ id, printWith, tab: startTab }: { id: string; printWith?: string; tab?: string }) {
  const router = useRouter()
  const bottom = useBottomClearance()
  const saves = useSaves()
  const children = useMyChildren()
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'offline' | 'other' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [photo, setPhoto] = useState(0)
  // Thanks (066): once per person, never on your own guide. Unknown until the
  // GET lands, and a failed GET hides the button rather than guessing.
  const [thanks, setThanks] = useState<{ thanked: boolean; own: boolean } | null>(null)
  const [thanking, setThanking] = useState(false)
  const [checksOpen, setChecksOpen] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const toaster = useToast()
  const { notes, reload } = useGuideNotes(id)
  const { caps } = useCapabilities()
  const scroller = useRef<ScrollView>(null)
  const [tab, setTab] = useState<Tab>(startTab === 'notes' || startTab === 'parts' || startTab === 'files' ? startTab : 'overview')
  const [tabsY, setTabsY] = useState(0)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  // The row rings for 2 s from when it lays out; drop the id after that so a
  // revisit doesn't repeat it.
  const highlightIdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (highlightIdTimer.current) clearTimeout(highlightIdTimer.current) }, [])
  const [highlight, setHighlight] = useState<'print' | null>(null)
  const printCard = useRef<View>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }, [])
  const stepIds = (tutorial?.steps ?? []).map((s) => s.id)
  const { ticked, reread } = useDeviceTicks(ticksKey('steps', id), stepIds)
  const gather = useGatherTicks(id, tutorial?.parts ?? [], tutorial?.tools ?? [])
  // Build mode ticks steps while this page stays mounted underneath; read them
  // again on the way back so Start building becomes Pick up at step N.
  useFocusEffect(
    useCallback(() => {
      reread()
      const focus = takeGuideFocus(id)
      if (focus) {
        void reload()
        setTab('notes')
        setHighlightId(focus.noteId)
        if (focus.noteId) toaster.show('Your feedback is on the guide')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  )

  const scrollToRow = (row: ComponentRef<typeof View>) => {
    const inner = (scroller.current as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.()
    if (!inner) return
    // ponytail: measureLayout against the inner view's host ref (getInnerViewNode is a number under Fabric and is refused); if RN drops getInnerViewRef, sum onLayout offsets instead.
    ;(row as unknown as { measureLayout: (n: unknown, ok: (x: number, y: number) => void, fail: () => void) => void }).measureLayout(
      inner,
      (_x, y) => scroller.current?.scrollTo({ y: Math.max(0, y - ROW_SCROLL_MARGIN), animated: true }),
      () => {}
    )
  }

  const scrollToHighlightedRow = (row: ComponentRef<typeof View>) => {
    scrollToRow(row)
    if (highlightIdTimer.current) clearTimeout(highlightIdTimer.current)
    highlightIdTimer.current = setTimeout(() => setHighlightId(null), 2200)
  }

  // "Pick up where you left off": once per open, when the guide has loaded.
  useEffect(() => {
    if (!tutorial) return
    recordRecent({
      id: tutorial.id,
      kind: 'guide',
      title: tutorial.title,
      subtitle: tutorial.build_minutes ? `Guide · ${tutorial.build_minutes} min build` : 'Guide',
      badge: DIFFICULTY_LABEL[tutorial.difficulty],
      href: `/guides/${tutorial.id}`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorial?.id])

  useEffect(() => {
    setError(null)
    apiClient
      .get<TutorialDetail>(`/api/public/tutorials/${id}`)
      // A draft or pending guide is not public: the hub's Preview opens it here,
      // and only the owner's own route (RLS-scoped) can return it.
      .catch((err) =>
        err instanceof Error && /status 404/.test(err.message)
          ? apiClient.get<TutorialDetail>(`/api/tutorials/${id}`).then(asPublicShape)
          : Promise.reject(err)
      )
      .then(setTutorial)
      .catch((err) => {
        logFailure('[DetailScreen] guide fetch failed:', err)
        setError(isNetworkError(err) ? 'offline' : 'other')
      })
      .finally(() => setLoading(false))
    apiClient
      .get<{ thanked: boolean; own: boolean }>(`/api/tutorials/${id}/thanks`)
      .then((t) => setThanks({ thanked: !!t?.thanked, own: !!t?.own }))
      .catch(() => {})
  }, [id, attempt])

  /** True once thanked (a 409 is "already thanked", the same end state). */
  async function sayThanks(): Promise<boolean> {
    setThanking(true)
    try {
      await apiClient.post(`/api/tutorials/${id}/thanks`, {})
      setThanks({ thanked: true, own: false })
      return true
    } catch (err) {
      if (err instanceof Error && /status 409/.test(err.message)) {
        setThanks({ thanked: true, own: false })
        return true
      }
      return false
    } finally {
      setThanking(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="100%" height={264} style={styles.loadingPhoto} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="50%" height={14} />
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="cloud-offline-outline"
          title={error === 'offline' ? "You seem to be offline." : "Couldn't load tutorial. Please try again."}
          hint={error === 'offline' ? 'Check your connection and try again.' : undefined}
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => { setLoading(true); setAttempt((n) => n + 1) }}
            style={styles.retry}
          />
        </EmptyState>
      </View>
    )
  }
  if (!tutorial) {
    return (
      <View style={styles.container}>
        <EmptyState icon="help-circle-outline" title="Tutorial not found." />
      </View>
    )
  }

  // 049 made tutorial-pdfs private: tutorial_pdf_url is now an object path,
  // not a URL. There's no /files route on mobile, so sign it in-process with
  // the app's own session rather than routing through the web app. The
  // 60-second window matches the web handler's — it only needs to survive
  // the WebView opening it, not sit around.
  async function openPreview() {
    const path = tutorial!.tutorial_pdf_url
    if (!path) {
      router.push({ pathname: '/guides/[id]/preview', params: { id: tutorial!.id, pdfUrl: '' } })
      return
    }
    const { data, error } = await supabase.storage.from('tutorial-pdfs').createSignedUrl(path, 60)
    router.push({
      pathname: '/guides/[id]/preview',
      params: { id: tutorial!.id, pdfUrl: error || !data ? '' : data.signedUrl },
    })
  }

  // The fit line: only when the guide shares an answer with one of the
  // parent's children. Anything else says nothing.
  const fit = fitLine(tutorial, children)
  const captionAt = (i: number) => tutorial.photo_captions?.[i] || tutorial.title
  const steps = tutorial.steps ?? []
  const progress = stepProgress(steps, ticked)
  const summary = noteSummary(notes, steps.length)
  const { lead, rest } = splitLead(tutorial.description ?? '')
  const ages = formatAgeRange(tutorial.age_min, tutorial.age_max)
  const who = whoRows(tutorial, children[0])
  const settings = printSettingRows(tutorial)
  const primary = tutorial.tutorial_contributors.find((c) => c.role === 'primary') ?? tutorial.tutorial_contributors[0]
  const gatherTotal = tutorial.parts.length + tutorial.tools.length
  const eyebrow = [
    ...(tutorial.device_types ?? []).map((d) => DEVICE_TYPES.find((o) => o.value === d)?.label ?? d),
    KIND_LABEL[tutorial.kind],
    ages,
  ].filter(Boolean).join(' · ')
  const openTab = (t: Tab, opts?: { highlight?: 'print' }) => {
    setTab(t)
    scroller.current?.scrollTo({ y: tabsY, animated: true })
    if (opts?.highlight) {
      setHighlight(opts.highlight)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlight(null), 1600)
      // The Files tab has rendered by the next frame; bring the print card up under the header.
      requestAnimationFrame(() => { if (printCard.current) scrollToRow(printCard.current) })
    }
  }
  const toPerson = (pid: string) => router.push(`/guides/contributor/${pid}`)
  const toOrg = (oid: string) => router.push(`/guides/organisation/${oid}`)
  const startBuild = () => router.push({ pathname: '/guides/[id]/build', params: { id: tutorial.id } })
  const openStep = (position: number) => router.push({ pathname: '/guides/[id]/build', params: { id: tutorial.id, step: String(position) } })
  const firstFix = summary.pinned[0]
  // "Mei and Dan": who a thanks reaches, by first name.
  const firsts = tutorial.tutorial_contributors.map((c) => c.profiles.name.split(' ')[0])
  const thankNames = firsts.length > 1 ? `${firsts.slice(0, -1).join(', ')} and ${firsts[firsts.length - 1]}` : (firsts[0] ?? 'the author')

  return (
    <View style={styles.container}>
      <ScrollView ref={scroller} style={styles.container} contentContainerStyle={styles.scroll} stickyHeaderIndices={[1]}>
        <View style={styles.pad}>
          {/* Bleeds to the screen's edges and up under the header, as the board's hero does. */}
          <View style={styles.hero}>
            <PhotoCarousel urls={tutorial.photo_urls} height={HERO_HEIGHT} emptyIcon="color-wand-outline" onIndexChange={setPhoto} onPress={setViewing} />
            {tutorial.photo_urls.length > 0 ? (
              <View style={styles.heroCount} pointerEvents="none">
                <Text style={styles.heroCountText} numberOfLines={1}>
                  {`${Math.min(photo, tutorial.photo_urls.length - 1) + 1}/${tutorial.photo_urls.length} · ${captionAt(Math.min(photo, tutorial.photo_urls.length - 1))}`}
                </Text>
              </View>
            ) : null}
            <View style={styles.heroActions}>
              <ItemActions
                save={{ slug: 'tutorials', id: tutorial.id, saves }}
                thanks={thanks && !thanks.own ? { to: thankNames, thanked: thanks.thanked, busy: thanking, send: sayThanks } : undefined}
                report={{ kind: 'guide', id: tutorial.id, label: tutorial.title }}
                onToast={toaster.show}
              />
            </View>
            {tutorial.photo_urls.length > 0 ? (
              <View style={styles.expand} pointerEvents="none">
                <Ionicons name="expand" size={18} color={theme.colors.ink} />
              </View>
            ) : null}
          </View>

          {tutorial.maturity !== 'complete' ? (
            <View style={styles.badgeRow}><Badge status={tutorial.maturity} label={MATURITY_LABEL[tutorial.maturity]} /></View>
          ) : null}
          <View style={styles.titleRow}>
            <Text style={styles.title}>{tutorial.title}</Text>
          </View>
          {eyebrow ? <Text style={styles.meta}>{eyebrow}</Text> : null}
          {lead ? <Text style={styles.lead}>{lead}</Text> : null}
          <Byline contributors={tutorial.tutorial_contributors} orgs={tutorial.tutorial_orgs} onPerson={toPerson} onOrg={toOrg} />

          <View style={styles.facts}>
            {tutorial.build_minutes ? (
              <View style={styles.fact}>
                <Text style={styles.factValue}>{formatBuildTime(tutorial.build_minutes)}</Text>
                <Text style={styles.factLabel}>build</Text>
              </View>
            ) : null}
            <View style={[styles.fact, { backgroundColor: DIFF_TINT[tutorial.difficulty] }]}>
              <Text style={styles.factWord}>{DIFFICULTY_LABEL[tutorial.difficulty]}</Text>
              <Text style={styles.factLabel}>level</Text>
            </View>
            {steps.length ? (
              <View style={styles.fact}>
                <Text style={styles.factValue}>{steps.length}</Text>
                <Text style={styles.factLabel}>{steps.length === 1 ? 'step' : 'steps'}</Text>
              </View>
            ) : null}
          </View>

          {fit ? (
            <View testID="fit-callout" style={styles.fit}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.successDeep} />
              <Text style={styles.fitText}>{fit}</Text>
            </View>
          ) : null}

          {gatherTotal || tutorial.stl_files.length ? (
            <View style={styles.need}>
              <Text style={styles.needTitle}>What you’ll need</Text>
              {tutorial.parts.length ? (
                <NeedRow testID="need-parts" icon="cube-outline" text={`${tutorial.parts.length} part${tutorial.parts.length === 1 ? '' : 's'}`} tab="Supplies" onPress={() => openTab('parts')} />
              ) : null}
              {tutorial.tools.length ? (
                <NeedRow testID="need-tools" icon="construct-outline" text={`${tutorial.tools.length} tool${tutorial.tools.length === 1 ? '' : 's'}`} tab="Supplies" onPress={() => openTab('parts')} />
              ) : null}
              {tutorial.stl_files.length ? (
                <NeedRow testID="need-print" icon="print-outline" print text={`${tutorial.stl_files.length} part${tutorial.stl_files.length === 1 ? '' : 's'} to 3D print`} tab="Files" onPress={() => openTab('files', { highlight: 'print' })} />
              ) : null}
            </View>
          ) : null}
        </View>

        <View onLayout={(e) => setTabsY(e.nativeEvent.layout.y)} style={styles.tabs}>
          <Segmented<Tab>
            label="Guide sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'parts', label: 'Supplies' },
              { value: 'files', label: 'Files' },
              { value: 'notes', label: 'Feedback', badge: notes.length },
            ]}
          />
        </View>

        <View style={styles.pad}>
          {tab === 'overview' ? (
            <View style={styles.stack}>
              {firstFix ? (
                <View style={styles.fixes}>
                  <View style={styles.fixHead}>
                    <Ionicons name="pin" size={18} color={theme.colors.ink} />
                    <Text style={styles.cardTitle}>{`${summary.pinned.length} fix${summary.pinned.length === 1 ? '' : 'es'} from builders`}</Text>
                  </View>
                  <Text style={styles.small}>
                    <Text style={styles.strong}>{`${stepLabel(firstFix, steps.length)}: `}</Text>
                    {firstFix.body}
                  </Text>
                  <Text accessibilityRole="link" onPress={() => openTab('notes')} style={styles.link}>
                    {summary.pinned.length === 1 ? 'Read the fix' : `Read all ${summary.pinned.length} fixes`}
                  </Text>
                </View>
              ) : null}

              {steps.length ? (
                <View style={styles.stepsWrap}>
                  <View style={styles.stepsHead}>
                    <Text style={styles.sectionTitle} accessibilityRole="header">The steps</Text>
                    <Text style={styles.needCount}>{`${progress.done}/${progress.total}`}</Text>
                  </View>
                  <View style={styles.card}>
                    {steps.map((st, i) => {
                      const done = ticked.has(st.id)
                      const here = progress.resume?.id === st.id
                      return (
                        <Pressable
                          key={st.id}
                          onPress={() => openStep(st.position)}
                          accessibilityRole="button"
                          accessibilityLabel={`Step ${st.position}: ${st.title || st.body}${done ? ', done' : ''}`}
                          style={[styles.stepRow, i > 0 && styles.rule, here && styles.stepHere]}
                        >
                          <View style={[styles.stepNum, done && styles.stepNumDone, here && styles.stepNumHere]}>
                            {done ? <Ionicons name="checkmark" size={16} color={theme.colors.onColor} /> : <Text style={[styles.stepNumText, here && styles.onColor]}>{st.position}</Text>}
                          </View>
                          <View style={styles.flex}>
                            <Text style={[styles.stepTitle, done && styles.struck]} numberOfLines={2}>{st.title || st.body}</Text>
                            {here ? (
                              <Text style={styles.here}>{st.minutes ? `You're here · ${st.minutes} min` : "You're here"}</Text>
                            ) : st.minutes ? (
                              <Text style={styles.stepMeta}>{`${st.minutes} min`}</Text>
                            ) : null}
                          </View>
                          {summary.labels.get(st.position) ? <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.colors.primaryDeep} /> : null}
                          {done ? null : <Ionicons name="chevron-forward" size={18} color={here ? theme.colors.primaryDeep : theme.colors.muted} />}
                        </Pressable>
                      )
                    })}
                  </View>
                  {summary.extras.length ? <Text style={styles.extras}>{`+ ${summary.extras.length} step${summary.extras.length === 1 ? '' : 's'} added by builders, in Feedback.`}</Text> : null}
                </View>
              ) : null}

              {tutorial.safety_notes?.length || tutorial.safety_declared_at ? (
                <Section title="Stay safe" style={styles.flush}>
                  {(tutorial.safety_notes ?? []).map((n) => (
                    <View key={n.id} style={styles.safetyRow}>
                      <Ionicons name="warning-outline" size={20} color={theme.colors.ink} />
                      <View style={styles.flex}>
                        <Text style={styles.safetyTitle}>{n.title}</Text>
                        {n.detail ? <Text style={styles.small}>{n.detail}</Text> : null}
                      </View>
                    </View>
                  ))}
                  {tutorial.safety_declared_at ? (
                    <View style={styles.checks}>
                      <Pressable onPress={() => setChecksOpen(!checksOpen)} accessibilityRole="button" accessibilityState={{ expanded: checksOpen }} style={styles.checksHead}>
                        <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.successDeep} />
                        <Text style={[styles.checksTitle, styles.flex]}>{`${SAFETY_CHECKLIST.length} safety checks passed`}</Text>
                        <Ionicons name={checksOpen ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.muted} />
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
                </Section>
              ) : null}

              {who.length ? (
                <Section title="Who it's for" style={styles.flush}>
                  {who.map((row) => (
                    <View key={row.label} style={styles.whoRow}>
                      <Text style={styles.whoLabel}>{row.label}</Text>
                      <View style={styles.chips}>
                        {row.values.map((v) => (
                          <View key={v.label} style={[styles.chip, v.shared && styles.chipShared]}>
                            {v.shared ? <Ionicons name="checkmark" size={14} color={theme.colors.successDeep} /> : null}
                            <Text style={styles.chipText}>{v.label}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </Section>
              ) : null}

              {rest ? (
                <Section title="About this guide" style={styles.flush}>
                  {/* One Text per paragraph: a blank line inside one Text is
                      measured taller than it draws on iOS. */}
                  <View style={styles.paras}>
                    {rest.split(/\n\s*\n/).map((para, i) => (
                      <Linkified key={i} text={para.trim()} style={styles.description} />
                    ))}
                  </View>
                </Section>
              ) : null}

              {tutorial.toy_name || tutorial.works_with || tutorial.no_build_note ? (
                <Section title={tutorial.kind === 'toy_adaptation' ? 'The toy' : 'Good to know'} style={styles.flush}>
                  {tutorial.toy_name ? <Text style={styles.description}>{[tutorial.toy_name, tutorial.toy_brand].filter(Boolean).join(' · ')}</Text> : null}
                  {tutorial.works_with ? <Text style={styles.small}>{`Works with: ${tutorial.works_with}`}</Text> : null}
                  {tutorial.no_build_note ? <Text style={styles.small}>{tutorial.no_build_note}</Text> : null}
                </Section>
              ) : null}

              <Provenance contributors={tutorial.tutorial_contributors} orgs={tutorial.tutorial_orgs} onPerson={toPerson} onOrg={toOrg} />

              {tutorial.tutorial_recommendations.length > 0 ? (
                <PicksRow
                  recommendations={tutorial.tutorial_recommendations}
                  firstName={primary?.profiles.name.split(' ')[0] ?? 'Creator'}
                  onOpen={(rid) => router.push(`/guides/${rid}`)}
                />
              ) : null}

              <AnimatedPressable
                onPress={() => router.push({ pathname: '/explore/makers-wanted/new', params: { guide: tutorial.id } })}
                accessibilityRole="button"
                accessibilityLabel="Can't build it? Ask a maker nearby"
                pressScale={0.985}
                style={[styles.printCard, styles.flush]}
              >
                <View style={styles.printHeader}>
                  <Text style={styles.printTitle}>Can&apos;t build it? Ask a maker nearby</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
                </View>
              </AnimatedPressable>
            </View>
          ) : tab === 'parts' ? (
            <>
              {gatherTotal ? (
                <View style={styles.gathered}>
                  <View style={styles.gatheredHead}>
                    <Text style={styles.gatheredText}>{gather.left ? `${gather.left} thing${gather.left === 1 ? '' : 's'} left to gather` : 'Everything’s here.'}</Text>
                    <Text style={styles.needCount}>{`${gatherTotal - gather.left}/${gatherTotal}`}</Text>
                  </View>
                  <View style={styles.meter} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: gatherTotal, now: gatherTotal - gather.left }}>
                    <View style={[styles.meterFill, { width: `${((gatherTotal - gather.left) / gatherTotal) * 100}%` }]} />
                  </View>
                </View>
              ) : null}
              <GuideParts parts={tutorial.parts} pricesCheckedOn={tutorial.prices_checked_on} ticks={gather.parts} />
              <GuideTools tools={tutorial.tools} ticks={gather.tools} />
            </>
          ) : tab === 'files' ? (
            <View style={styles.stack}>
              {tutorial.tutorial_pdf_url || tutorial.stl_files.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardHead}>Guide files</Text>
                  {tutorial.tutorial_pdf_url ? (
                    <View testID="file-row-pdf" style={styles.fileRow}>
                      <View style={styles.needIcon}><Ionicons name="document-text-outline" size={18} color={theme.colors.primaryDeep} /></View>
                      <View style={styles.flex}>
                        <Text style={styles.fileName}>Full guide</Text>
                        <Text style={styles.fileSub}>PDF · read on screen</Text>
                      </View>
                      <Pressable onPress={openPreview} accessibilityRole="button" accessibilityLabel="View" style={styles.filePill}>
                        <Ionicons name="eye-outline" size={14} color={theme.colors.primaryDeep} />
                        <Text style={styles.filePillText}>View</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {tutorial.stl_files.map((f) => {
                    const sub = [f.print_minutes ? `${f.print_minutes} min` : '', f.filament_grams ? `${f.filament_grams} g` : ''].filter(Boolean).join(' · ')
                    return (
                      <View key={f.id} testID={`file-row-${f.id}`} style={styles.fileRow}>
                        <View style={styles.needIcon}><Ionicons name="cube-outline" size={18} color={theme.colors.primaryDeep} /></View>
                        <View style={styles.flex}>
                          <Text style={styles.fileName} numberOfLines={1}>{stlName(f.filename)}</Text>
                          <Text style={styles.fileSub} numberOfLines={1}>{sub || f.filename}</Text>
                        </View>
                        <Pressable
                          onPress={() => router.push({ pathname: '/guides/[id]/model', params: { id: tutorial.id, file: f.id } })}
                          accessibilityRole="button"
                          accessibilityLabel={`3D view of ${stlName(f.filename)}`}
                          style={styles.filePill}
                        >
                          <Ionicons name="sync-outline" size={14} color={theme.colors.primaryDeep} />
                          <Text style={styles.filePillText}>3D</Text>
                        </Pressable>
                      </View>
                    )
                  })}
                  {webGuideUrl(tutorial.id) ? (
                    <Pressable testID="files-web-link" onPress={() => void Linking.openURL(webGuideUrl(tutorial.id)!)} accessibilityRole="link" style={styles.webLink}>
                      <Ionicons name="globe-outline" size={16} color={theme.colors.primaryDeep} />
                      <Text style={[styles.webLinkText, styles.flex]}>
                        Printing it yourself? <Text style={styles.webLinkStrong}>Download the files on the web</Text>
                      </Text>
                      <Ionicons name="open-outline" size={16} color={theme.colors.primaryDeep} />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.small}>Nothing to download for this guide.</Text>
              )}
              {tutorial.stl_files.length > 0 ? (
                <View ref={printCard} collapsable={false} testID="print-card">
                  <AnimatedPressable
                    onPress={() => router.push({ pathname: '/printing', params: printWith ? { guide: tutorial.id, printWith } : { guide: tutorial.id } })}
                    accessibilityRole="button"
                    accessibilityLabel="Ask someone to print"
                    accessibilityHint="Pick up to three printers nearby"
                    pressScale={0.985}
                    style={[styles.printCardFilled, styles.flush, highlight === 'print' && styles.printRing]}
                  >
                    <View style={styles.printHeader}>
                      <Text style={styles.printTitleOn}>Ask someone to print</Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.colors.onColor} />
                    </View>
                    <Text style={styles.printHintOn}>
                      {tutorial.stl_files.length} printable part{tutorial.stl_files.length === 1 ? '' : 's'} · pick up to three printers nearby
                    </Text>
                  </AnimatedPressable>
                </View>
              ) : null}
              {settings.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardHead}>Print settings</Text>
                  <View style={[styles.settings, styles.settingsPad]}>
                    {settings.map((r) => (
                      <View key={r.k} style={styles.setting}>
                        <Text style={styles.settingKey}>{r.k}</Text>
                        <Text style={styles.settingValue}>{r.v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
            <CommunityNotes
              tutorialId={tutorial.id}
              guideTitle={tutorial.title}
              authorName={primary?.profiles.name ?? 'The author'}
              steps={steps}
              notes={notes}
              reload={reload}
              canPin={!!thanks?.own || !!caps?.isAdmin}
              viewerId={caps?.profile.id ?? null}
              viewerName={caps?.profile.name ?? null}
              highlightId={highlightId}
              onHighlightRow={scrollToHighlightedRow}
              onPosted={(note) => { setHighlightId(note.id); toaster.show('Your feedback is on the guide') }}
            />
          )}
        </View>
      </ScrollView>

      <PhotoViewer
        photos={tutorial.photo_urls.map((uri, i) => ({ uri, caption: tutorial.photo_captions?.[i] || null }))}
        index={viewing}
        onClose={() => setViewing(null)}
      />

      <Toast toast={toaster.toast} onHide={toaster.hide} style={{ bottom: bottom + 84 }} />

      <View testID="guide-action-bar" style={[styles.actionBar, { paddingBottom: bottom }]}>
        {steps.length ? (
          <Button
            label={progress.allDone ? 'Build it again' : progress.resume ? `Pick up at step ${progress.resume.position}` : 'Start building'}
            onPress={startBuild}
            style={styles.primaryAction}
          />
        ) : (
          <Button label="View full guide" onPress={openPreview} style={styles.primaryAction} />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  container: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingBottom: theme.spacing(8) },
  pad: { paddingHorizontal: theme.spacing(4) },
  flex: { flex: 1 },
  onColor: { color: theme.colors.onColor },
  loading: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4), gap: theme.spacing(3) },
  loadingPhoto: { borderRadius: theme.radii.card, marginBottom: theme.spacing(2) },
  hero: { marginHorizontal: -theme.spacing(4), marginBottom: theme.spacing(3) },
  heroCount: {
    position: 'absolute',
    left: theme.spacing(3),
    top: HERO_HEIGHT - 40,
    maxWidth: '80%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    ...theme.shadow(1),
  },
  expand: { position: 'absolute', right: theme.spacing(3), top: HERO_HEIGHT - 44, width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', ...theme.shadow(1) },
  heroCountText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(1) },
  heroActions: { position: 'absolute', top: theme.spacing(3), right: theme.spacing(3) },
  stack: { gap: theme.spacing(6), paddingTop: theme.spacing(3) },
  flush: { marginTop: 0, marginBottom: 0 },
  badgeRow: { flexDirection: 'row', marginBottom: theme.spacing(1) },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing(3) },
  title: { flex: 1, fontFamily: theme.fonts.display, fontSize: theme.type.display, color: theme.colors.text, lineHeight: 34 },
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text, lineHeight: 24, marginTop: theme.spacing(3), marginBottom: theme.spacing(2) },
  facts: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(4) },
  fact: { flex: 1, gap: 2, paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(3), borderRadius: theme.radii.field, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  factValue: { fontFamily: theme.fonts.black, fontSize: theme.type.heading, color: theme.colors.ink },
  factWord: { fontFamily: theme.fonts.black, fontSize: theme.type.heading, color: theme.colors.ink },
  factLabel: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  fit: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.mintSoft, marginTop: theme.spacing(4) },
  fitText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  need: { marginTop: theme.spacing(4), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, overflow: 'hidden', ...theme.shadow(1) },
  needTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, paddingHorizontal: theme.spacing(5), paddingTop: theme.spacing(4), paddingBottom: theme.spacing(2) },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  needPrint: { backgroundColor: theme.colors.accentFaint },
  needIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  needIconPrint: { backgroundColor: theme.colors.apricotSoft },
  needGo: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: theme.spacing(2), paddingVertical: 3, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  needGoText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.primaryDeep },
  printRing: { borderWidth: 3, borderColor: theme.colors.primary },
  needText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  needCount: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.muted },
  tabs: { backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), marginTop: theme.spacing(3) },
  fixes: { gap: theme.spacing(2), padding: theme.spacing(5), borderRadius: theme.radii.panel, backgroundColor: theme.colors.honeySoft },
  fixHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  cardTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  strong: { fontFamily: theme.fonts.black },
  link: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  small: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  stepsWrap: { gap: theme.spacing(2) },
  stepsHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.text },
  extras: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  card: { borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  rule: { borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 56, paddingHorizontal: theme.spacing(5), paddingVertical: theme.spacing(2) },
  stepHere: { backgroundColor: theme.colors.accentLight },
  stepNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceSunken },
  stepNumDone: { backgroundColor: theme.colors.success },
  stepNumHere: { backgroundColor: theme.colors.primary },
  stepNumText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  stepTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  stepMeta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  here: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  struck: { textDecorationLine: 'line-through', color: theme.colors.muted },
  safetyRow: { flexDirection: 'row', gap: theme.spacing(3), alignItems: 'flex-start', paddingVertical: theme.spacing(1) },
  safetyTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  checks: { marginTop: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.successSoft, paddingHorizontal: theme.spacing(3), paddingBottom: theme.spacing(1) },
  checksHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), minHeight: 48 },
  checksTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  checkRow: { flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start', paddingLeft: theme.spacing(7), paddingBottom: theme.spacing(2) },
  whoRow: { paddingVertical: theme.spacing(1), gap: theme.spacing(1) },
  whoLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing(3), paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken },
  chipShared: { backgroundColor: theme.colors.mintSoft },
  chipText: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  paras: { gap: theme.spacing(3) },
  description: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text },
  printCard: { marginTop: theme.spacing(5), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing(5), ...theme.shadow(1) },
  printHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  printTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  printHint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
  gathered: { gap: theme.spacing(2), marginTop: theme.spacing(3), marginBottom: theme.spacing(5) },
  gatheredHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  gatheredText: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  meter: { height: 10, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: theme.radii.pill, backgroundColor: theme.colors.success },
  cardHead: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(4), paddingBottom: theme.spacing(2) },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  fileName: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  fileSub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing(3), paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  filePillText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  webLink: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceSunken },
  webLinkText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18 },
  webLinkStrong: { fontFamily: theme.fonts.black, color: theme.colors.primaryDeep },
  printCardFilled: { borderRadius: theme.radii.panel, backgroundColor: theme.colors.primary, padding: theme.spacing(5), ...theme.shadow(2) },
  printTitleOn: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.onColor },
  printHintOn: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.onColor, marginTop: theme.spacing(1) },
  settingsPad: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(4) },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  setting: { width: '48%', padding: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  settingKey: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  settingValue: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  actionBar: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
  primaryAction: { minHeight: 56 },
})
