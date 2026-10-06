import { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, Part, Tool, StlFile, Recommendation, TutorialStep, TutorialSafetyNote } from '@splat-connect/types'
import {
  CHILD_QUESTIONS, DEVICE_TYPES, DIFFICULTY_LABEL, KIND_LABEL, MATURITY_LABEL, ONE_HAND_LABEL, SAFETY_CHECKLIST,
  fitLine, formatAgeRange, printSettingRows,
} from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useSaves } from '../../lib/saves'
import { recordRecent } from '../../lib/recents'
import { useMyChildren } from '../../lib/my-children'
import { useCapabilities } from '../../lib/capabilities'
import { useGuideNotes, noteSummary, pinCountLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Provenance, type ProvenanceContributor, type ProvenanceOrg } from '../guides/provenance'
import { PicksRow } from '../guides/picks-row'
import { GuideParts } from '../guides/guide-parts'
import { GuideTools } from '../guides/guide-tools'
import { stepProgress, ticksKey, useDeviceTicks, useGatherTicks } from '../../lib/guide-progress'
import { CommunityNotes } from '../guides/community-notes'
import { Badge } from '../ui/Badge'
import { SaveButton } from '../ui/SaveButton'
import { PhotoCarousel } from '../ui/PhotoCarousel'
import { Button } from '../ui/Button'
import { Section } from '../ui/Section'
import { Segmented } from '../ui/Segmented'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ReportProblem } from '../reports/report-problem'

const HERO_HEIGHT = 240

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

/** "Who it's for" as label → chosen labels, one row per answered question. */
function whoRows(t: Tutorial): { label: string; values: string[] }[] {
  const pick = (opts: readonly { value: string; label: string }[], vals: readonly string[] | null | undefined) =>
    (vals ?? []).map((v) => opts.find((o) => o.value === v)?.label ?? v)
  const rows = CHILD_QUESTIONS.map((q) => ({
    label: q.item === 'access' ? 'How a child uses it' : q.item === 'press_force' ? 'Press force it works with' : q.label,
    values: [...pick(q.options, t[q.item] as string[] | null), ...(q.item === 'access' && t.one_hand ? [ONE_HAND_LABEL] : [])],
  }))
  return rows.filter((r) => r.values.length)
}

/**
 * One guide (spec D, mockup https://claude.ai/artifact/6AShefEyee5vRADQb9LCyT):
 * a short header that says whether it suits your child and what it takes,
 * then Start building (build mode, one step a screen) and four tabs —
 * Overview, Parts & tools, Files, Notes — instead of one long scroll.
 */
export function DetailScreen({ id, printWith, tab: startTab }: { id: string; printWith?: string; tab?: string }) {
  const router = useRouter()
  const saves = useSaves()
  const children = useMyChildren()
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [photo, setPhoto] = useState(0)
  const [pick, setPick] = useState<number | undefined>(undefined)
  // Thanks (066): once per person, never on your own guide. Unknown until the
  // GET lands, and a failed GET hides the button rather than guessing.
  const [thanks, setThanks] = useState<{ thanked: boolean; own: boolean } | null>(null)
  const [thanking, setThanking] = useState(false)
  const { notes, reload } = useGuideNotes(id)
  const { caps } = useCapabilities()
  const scroller = useRef<ScrollView>(null)
  const [tab, setTab] = useState<Tab>(startTab === 'notes' || startTab === 'parts' || startTab === 'files' ? startTab : 'overview')
  const [tabsY, setTabsY] = useState(0)
  const stepIds = (tutorial?.steps ?? []).map((s) => s.id)
  const { ticked, reread } = useDeviceTicks(ticksKey('steps', id), stepIds)
  const gather = useGatherTicks(id, tutorial?.parts ?? [], tutorial?.tools ?? [])
  // Build mode ticks steps while this page stays mounted underneath; read them
  // again on the way back so Start building becomes Pick up at step N.
  useFocusEffect(
    useCallback(() => {
      reread()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  )

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
    apiClient
      .get<TutorialDetail>(`/api/public/tutorials/${id}`)
      .then(setTutorial)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    apiClient
      .get<{ thanked: boolean; own: boolean }>(`/api/tutorials/${id}/thanks`)
      .then((t) => setThanks({ thanked: !!t?.thanked, own: !!t?.own }))
      .catch(() => {})
  }, [id])

  async function sayThanks() {
    setThanking(true)
    try {
      await apiClient.post(`/api/tutorials/${id}/thanks`, {})
      setThanks({ thanked: true, own: false })
    } catch (err) {
      // 409 is "already thanked" — the button's end state either way.
      if (err instanceof Error && /status 409/.test(err.message)) setThanks({ thanked: true, own: false })
    } finally {
      setThanking(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="100%" height={200} style={styles.loadingPhoto} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="50%" height={14} />
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load tutorial. Please try again." />
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

  // The fit callout: only when the guide shares an answer with one of the
  // parent's children. Anything else says nothing.
  const fit = fitLine(tutorial, children)
  const captionAt = (i: number) => tutorial.photo_captions?.[i] || tutorial.title
  const steps = tutorial.steps ?? []
  const progress = stepProgress(steps, ticked)
  const summary = noteSummary(notes, steps.length)
  const { lead, rest } = splitLead(tutorial.description ?? '')
  const ages = formatAgeRange(tutorial.age_min, tutorial.age_max)
  const who = whoRows(tutorial)
  const settings = printSettingRows(tutorial)
  const primary = tutorial.tutorial_contributors.find((c) => c.role === 'primary') ?? tutorial.tutorial_contributors[0]
  const openTab = (t: Tab) => {
    setTab(t)
    scroller.current?.scrollTo({ y: tabsY, animated: true })
  }
  const startBuild = () => router.push({ pathname: '/guides/[id]/build', params: { id: tutorial.id } })

  return (
    <ScrollView ref={scroller} style={styles.container} contentContainerStyle={styles.content}>
      {/* Bleeds to the screen's edges and up under the header, as the board's hero does. */}
      <View style={styles.hero}>
        <PhotoCarousel
          urls={tutorial.photo_urls}
          height={HERO_HEIGHT}
          emptyIcon="color-wand-outline"
          onIndexChange={setPhoto}
          index={pick}
        />
        {tutorial.photo_urls.length > 0 ? (
          <View style={styles.heroCount} pointerEvents="none">
            <Text style={styles.heroCountText} numberOfLines={1}>
              {`${Math.min(photo, tutorial.photo_urls.length - 1) + 1}/${tutorial.photo_urls.length} · ${captionAt(Math.min(photo, tutorial.photo_urls.length - 1))}`}
            </Text>
          </View>
        ) : null}
      </View>
      {tutorial.photo_urls.length > 1 ? (
        <View accessibilityRole="tablist" accessibilityLabel="Photos" style={styles.strip}>
          {tutorial.photo_urls.map((url, i) => (
            <Pressable
              key={url}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === photo }}
              accessibilityLabel={`Show photo ${i + 1}: ${captionAt(i)}`}
              onPress={() => setPick(i)}
              style={[styles.thumb, i === photo && styles.thumbOn]}
            >
              <Image source={{ uri: url }} style={styles.thumbImage} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {/*
        Plain, visible badges rather than library-screen's a11y-hidden wrapper:
        here the title is a plain Text, not a button, so each badge is just its
        own stop in the screen's natural top-to-bottom reading order.
      */}
      <View style={styles.badgeRow}>
        <Badge status={tutorial.difficulty} />
        {tutorial.build_minutes ? <Badge status="draft" label={`${tutorial.build_minutes} min`} /> : null}
        {ages ? <Badge status="draft" label={ages} /> : null}
        {(tutorial.device_types ?? []).map((d) => (
          <Badge key={d} status="accepted" label={DEVICE_TYPES.find((o) => o.value === d)?.label ?? d} />
        ))}
        <Badge status={tutorial.kind} label={KIND_LABEL[tutorial.kind]} />
        {tutorial.maturity !== 'complete' ? (
          <Badge status={tutorial.maturity} label={MATURITY_LABEL[tutorial.maturity]} />
        ) : null}
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{tutorial.title}</Text>
        <SaveButton slug="tutorials" id={tutorial.id} saves={saves} />
      </View>
      {lead ? <Text style={styles.lead}>{lead}</Text> : null}

      <Provenance
        contributors={tutorial.tutorial_contributors}
        orgs={tutorial.tutorial_orgs}
        onPerson={(pid) => router.push(`/guides/contributor/${pid}`)}
        onOrg={(oid) => router.push(`/guides/organisation/${oid}`)}
      />

      {/* Above everything that follows: a parent should know it suits their
          child before reading a single step. */}
      {fit ? (
        <View testID="fit-callout" style={styles.fit}>
          <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
          <Text style={styles.fitText}>{fit}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        {steps.length ? (
          <Button
            label={progress.allDone ? 'Build it again' : progress.resume ? `Pick up at step ${progress.resume.position}` : 'Start building'}
            onPress={startBuild}
            style={styles.primaryAction}
          />
        ) : (
          <Button label="Download PDF" onPress={openPreview} style={styles.primaryAction} />
        )}
        {thanks && !thanks.own ? (
          <Button
            label={thanks.thanked ? 'Thanked' : 'Thanks'}
            variant="secondary"
            disabled={thanks.thanked}
            loading={thanking}
            onPress={() => void sayThanks()}
          />
        ) : null}
      </View>
      <Text style={styles.progressLine}>
        {steps.length
          ? progress.done
            ? `${progress.done} of ${progress.total} steps done`
            : `${steps.length} step${steps.length === 1 ? '' : 's'}${tutorial.stl_files.length ? ` · ${tutorial.stl_files.length} printed part${tutorial.stl_files.length === 1 ? '' : 's'}` : ''}`
          : 'The steps are in the PDF.'}
      </Text>
      <View style={styles.reportRow}>
        <ReportProblem subjectKind="guide" subjectId={tutorial.id} subjectLabel={tutorial.title} />
      </View>

      {summary.pinned.length ? (
        <Pressable accessibilityRole="button" onPress={() => openTab('notes')} style={styles.banner}>
          <Ionicons name="pin" size={20} color={theme.colors.ink} />
          <Text style={styles.bannerText}>
            <Text style={styles.bannerStrong}>{pinCountLabel(summary.pinned.length)}</Text> since this was written — read before you build.
          </Text>
          <Ionicons name="arrow-down" size={16} color={theme.colors.ink} />
        </Pressable>
      ) : null}

      <View onLayout={(e) => setTabsY(e.nativeEvent.layout.y)} style={styles.tabs}>
        <Segmented<Tab>
          label="Guide sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'parts', label: 'Parts & tools' },
            { value: 'files', label: 'Files' },
            { value: 'notes', label: notes.length ? `Notes ${notes.length}` : 'Notes' },
          ]}
        />
      </View>

      {tab === 'overview' ? (
        <>
          {tutorial.safety_notes?.length || tutorial.safety_declared_at ? (
            <View style={styles.safety}>
              <Text style={styles.cardTitle}>Before you start</Text>
              {(tutorial.safety_notes ?? []).map((n) => (
                <View key={n.id} style={styles.safetyNote}>
                  <Text style={styles.safetyTitle}>{n.title}</Text>
                  {n.detail ? <Text style={styles.small}>{n.detail}</Text> : null}
                </View>
              ))}
              {tutorial.safety_declared_at ? (
                <Text style={styles.small}>{`The author checked all ${SAFETY_CHECKLIST.length} safety points: tool-only battery doors, no choking-size parts, no sharp edges, cleanable materials, no mains, no strangling cords.`}</Text>
              ) : null}
            </View>
          ) : null}

          {rest ? (
            <Section title="About this guide">
              <Text style={styles.description}>{rest}</Text>
            </Section>
          ) : null}

          {tutorial.toy_name || tutorial.works_with || tutorial.no_build_note ? (
            <Section title={tutorial.kind === 'toy_adaptation' ? 'The toy' : 'Good to know'}>
              {tutorial.toy_name ? <Text style={styles.description}>{[tutorial.toy_name, tutorial.toy_brand].filter(Boolean).join(' · ')}</Text> : null}
              {tutorial.works_with ? <Text style={styles.small}>{`Works with: ${tutorial.works_with}`}</Text> : null}
              {tutorial.no_build_note ? <Text style={styles.small}>{tutorial.no_build_note}</Text> : null}
            </Section>
          ) : null}

          {who.length ? (
            <Section title="Who it's for">
              {who.map((row) => (
                <View key={row.label} style={styles.whoRow}>
                  <Text style={styles.whoLabel}>{row.label}</Text>
                  <Text style={styles.small}>{row.values.join(' · ')}</Text>
                </View>
              ))}
            </Section>
          ) : null}

          {steps.length ? (
            <Section title={`${steps.length} step${steps.length === 1 ? '' : 's'}`} hint="Start building shows one step a screen.">
              {steps.map((st) => {
                const done = ticked.has(st.id)
                return (
                  <View key={st.id} style={styles.stepRow}>
                    <View style={[styles.stepNum, done && styles.stepNumDone]}>
                      {done ? <Ionicons name="checkmark" size={14} color={theme.colors.onColor} /> : <Text style={styles.stepNumText}>{st.position}</Text>}
                    </View>
                    <Text style={[styles.stepTitle, done && styles.muted]} numberOfLines={2}>
                      {st.title || st.body}
                    </Text>
                    {summary.labels.get(st.position) ? <Ionicons name="chatbubble-ellipses-outline" size={15} color={theme.colors.primaryDark} /> : null}
                  </View>
                )
              })}
              {summary.extras.length ? <Text style={styles.small}>{`+ ${summary.extras.length} step${summary.extras.length === 1 ? '' : 's'} added by the community — see Notes.`}</Text> : null}
            </Section>
          ) : null}

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
            style={styles.printCard}
          >
            <View style={styles.printHeader}>
              <Text style={styles.printTitle}>Can&apos;t build it? Ask a maker nearby</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
            </View>
            <Text style={styles.printHint}>
              A maker nearby gives the time and the skill; you cover the parts. You agree a pickup in My exchanges.
            </Text>
          </AnimatedPressable>
        </>
      ) : tab === 'parts' ? (
        <>
          <GuideParts parts={tutorial.parts} pricesCheckedOn={tutorial.prices_checked_on} ticks={gather.parts} />
          <GuideTools tools={tutorial.tools} ticks={gather.tools} />
        </>
      ) : tab === 'files' ? (
        <>
          <Section title="Guide PDF" hint="The same guide, to print and keep by the bench.">
            <Button label="Download PDF" variant="secondary" onPress={openPreview} />
          </Section>
          {settings.length ? (
            <Section title="Print settings">
              <View style={styles.settings}>
                {settings.map((r) => (
                  <View key={r.k} style={styles.setting}>
                    <Text style={styles.settingKey}>{r.k}</Text>
                    <Text style={styles.settingValue}>{r.v}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}
          {/* The way into printing. Keyed on the guide having STL files rather
              than on its kind: a print request's parts ARE those files. */}
          {tutorial.stl_files.length > 0 ? (
            <>
              <Section title="Printable parts">
                {tutorial.stl_files.map((f) => (
                  <View key={f.id} style={styles.fileRow}>
                    <Ionicons name="cube-outline" size={17} color={theme.colors.primary} />
                    <Text style={styles.fileName} numberOfLines={1}>{f.filename}</Text>
                  </View>
                ))}
              </Section>
              <AnimatedPressable
                onPress={() => router.push({ pathname: '/printing', params: printWith ? { guide: tutorial.id, printWith } : { guide: tutorial.id } })}
                accessibilityRole="button"
                accessibilityLabel="Ask someone to print"
                accessibilityHint="Pick up to three printers nearby"
                pressScale={0.985}
                style={styles.printCard}
              >
                <View style={styles.printHeader}>
                  <Text style={styles.printTitle}>Ask someone to print</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
                </View>
                <Text style={styles.printHint}>
                  {tutorial.stl_files.length} printable part{tutorial.stl_files.length === 1 ? '' : 's'} · pick up to three
                  printers nearby
                </Text>
              </AnimatedPressable>
            </>
          ) : (
            <Text style={styles.small}>Nothing to print for this guide.</Text>
          )}
        </>
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
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft, marginBottom: theme.spacing(3) },
  bannerText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  bannerStrong: { fontFamily: theme.fonts.black },
  safetyNote: { paddingVertical: theme.spacing(1), gap: 2 },
  safety: { padding: theme.spacing(3), gap: theme.spacing(1), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft, marginTop: theme.spacing(4) },
  cardTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  small: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.text, lineHeight: 19 },
  progressLine: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted, textAlign: 'center', marginTop: theme.spacing(2) },
  tabs: { marginTop: theme.spacing(2), marginBottom: theme.spacing(1) },
  whoRow: { paddingVertical: theme.spacing(1), gap: 2 },
  whoLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(1) },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  stepNumDone: { backgroundColor: theme.colors.success },
  stepNumText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  stepTitle: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  muted: { color: theme.colors.muted },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(1) },
  fileName: { flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  safetyTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  setting: { width: '48%', padding: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  settingKey: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  settingValue: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(10) },
  hero: { marginHorizontal: -theme.spacing(4), marginBottom: theme.spacing(2) },
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
  heroCountText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.muted,
    lineHeight: 23,
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
  },
  actions: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(4) },
  primaryAction: { flex: 1 },
  reportRow: { alignItems: 'flex-end', marginBottom: theme.spacing(2) },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  loadingPhoto: { borderRadius: theme.radii.card, marginBottom: theme.spacing(2) },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.card,
    marginBottom: theme.spacing(4),
    backgroundColor: theme.colors.surfaceSunken,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
  },
  title: {
    flex: 1,
    fontFamily: theme.fonts.display,
    fontSize: theme.type.title,
    color: theme.colors.text,
    lineHeight: 32,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  printCard: {
    marginTop: theme.spacing(5),
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(4),
    ...theme.shadow(2),
  },
  printHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  printTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  printHint: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
  },
  description: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.text,
    lineHeight: 23,
  },
  fit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(3),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.mintSoft,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    marginTop: theme.spacing(3),
  },
  fitText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  strip: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  thumb: { width: 52, height: 52, borderRadius: theme.radii.field, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: theme.colors.primaryDark },
  thumbImage: { width: '100%', height: '100%' },
})
