import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, Part, Tool, StlFile, Recommendation, TutorialStep, TutorialSafetyNote } from '@splat-connect/types'
import { KIND_LABEL, MATURITY_LABEL, checkedOn, fitLine, formatCents, partsTotalCents, printSettingRows } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useSaves } from '../../lib/saves'
import { useMyChildren } from '../../lib/my-children'
import { useCapabilities } from '../../lib/capabilities'
import { useGuideNotes, noteSummary, pinCountLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Provenance, type ProvenanceContributor, type ProvenanceOrg } from '../guides/provenance'
import { PicksRow } from '../guides/picks-row'
import { GuideSteps } from '../guides/guide-steps'
import { GuideTools } from '../guides/guide-tools'
import { CommunityNotes } from '../guides/community-notes'
import { Badge } from '../ui/Badge'
import { SaveButton } from '../ui/SaveButton'
import { PhotoCarousel } from '../ui/PhotoCarousel'
import { Button } from '../ui/Button'
import { Section } from '../ui/Section'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ReportProblem } from '../reports/report-problem'
import { useFlash, FlashLine } from '../ui/Flash'

const SWITCH_TARGET_LABEL = { large: 'Big button', small: 'Small button' } as const
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

export function DetailScreen({ id, printWith }: { id: string; printWith?: string }) {
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
  const [built, setBuilt] = useState(false)
  const [flash, setFlash] = useFlash()
  const { notes, reload } = useGuideNotes(id)
  const { caps } = useCapabilities()
  const scroller = useRef<ScrollView>(null)
  const [notesY, setNotesY] = useState(0)

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

  // The board's fit callout: only when the guide suits one of the parent's
  // children. Anything else — no tags, no answers, a mismatch — says nothing.
  const fit = fitLine(tutorial, children)
  const total = partsTotalCents(tutorial.parts)
  const captionAt = (i: number) => tutorial.photo_captions?.[i] || tutorial.title
  const steps = tutorial.steps ?? []
  const summary = noteSummary(notes, steps.length)
  const { lead, rest } = splitLead(tutorial.description ?? '')

  const primary = tutorial.tutorial_contributors.find((c) => c.role === 'primary') ?? tutorial.tutorial_contributors[0]

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
        that hiding exists there because the whole row is one accessible
        button whose spoken name absorbs every descendant Text, so an unhidden
        badge both double-announces and collides with the filter chip's own
        name. Here the title is a plain Text, not a button — nothing
        aggregates these badges into another element's name, so each is just
        its own stop in the screen's natural top-to-bottom reading order.
      */}
      <View style={styles.badgeRow}>
        <Badge status={tutorial.difficulty} />
        {tutorial.build_minutes ? <Badge status="draft" label={`${tutorial.build_minutes} min`} /> : null}
        {tutorial.switch_target ? (
          <Badge status="accepted" label={SWITCH_TARGET_LABEL[tutorial.switch_target]} />
        ) : null}
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
        <Button label="Download PDF" onPress={openPreview} style={styles.primaryAction} />
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
      <View style={styles.reportRow}>
        <ReportProblem subjectKind="guide" subjectId={tutorial.id} subjectLabel={tutorial.title} />
      </View>

      {summary.pinned.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => scroller.current?.scrollTo({ y: notesY, animated: true })}
          style={styles.banner}
        >
          <Ionicons name="pin" size={20} color={theme.colors.ink} />
          <Text style={styles.bannerText}>
            <Text style={styles.bannerStrong}>{pinCountLabel(summary.pinned.length)}</Text> since this was written — read before you build.
          </Text>
          <Ionicons name="arrow-down" size={16} color={theme.colors.ink} />
        </Pressable>
      ) : null}

      {steps.length > 0 ? (
        <GuideSteps
          tutorialId={tutorial.id}
          steps={steps}
          noteLabels={summary.labels}
          extras={summary.extras}
          completion={(total) => (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>{`All ${total} steps done`}</Text>
              <Text style={styles.doneBody}>Log it and this build shows up in My SPLAT.</Text>
              <Button
                label={built ? 'Build logged' : 'Mark this build done'}
                disabled={built}
                onPress={async () => {
                  try {
                    await apiClient.post(`/api/tutorials/${tutorial.id}/build`, {})
                    setBuilt(true)
                    setFlash('Build logged — nice work')
                  } catch {
                    setFlash('Could not log that. Try again.')
                  }
                }}
              />
              <FlashLine message={flash} />
              {thanks && !thanks.own && !thanks.thanked ? (
                <Button
                  label={`Say thanks to ${primary?.profiles.name ?? 'the author'}`}
                  variant="secondary"
                  loading={thanking}
                  onPress={() => void sayThanks()}
                />
              ) : null}
            </View>
          )}
        />
      ) : null}
      <View onLayout={(e) => setNotesY(e.nativeEvent.layout.y)}>
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
      </View>

      {rest ? (
        <Section title="About this guide">
          <Text style={styles.description}>{rest}</Text>
        </Section>
      ) : null}

      <Section title="Parts" hint="What you'll need to buy or salvage.">
        {tutorial.parts.length ? (
          tutorial.parts.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <Ionicons name="cube-outline" size={17} color={theme.colors.primary} />
              <Text style={styles.listItem}>{`${item.name} ×${item.quantity}${item.is_optional ? ' (optional)' : ''}`}</Text>
              {item.price_cents != null ? <Text style={styles.cost}>{formatCents(item.price_cents)}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.listItem}>No parts listed.</Text>
        )}
        {total != null ? (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.cost}>{formatCents(total)}</Text>
            </View>
            {tutorial.prices_checked_on ? <Text style={styles.checked}>{`Prices checked ${checkedOn(tutorial.prices_checked_on)}`}</Text> : null}
          </>
        ) : null}
      </Section>

      <GuideTools tutorialId={tutorial.id} tools={tutorial.tools} />

      {tutorial.safety_notes?.length ? (
        <Section title="Safety notes">
          {tutorial.safety_notes.map((n) => (
            <View key={n.id} style={styles.safetyNote}>
              <Text style={styles.safetyTitle}>{n.title}</Text>
              {n.detail ? <Text style={styles.description}>{n.detail}</Text> : null}
            </View>
          ))}
        </Section>
      ) : null}

      {/* The way into printing. Keyed on the guide having STL files rather than
          on its kind: a print request's parts ARE those files, so a guide
          without any has nothing to ask for, whatever kind it is. */}
      {printSettingRows(tutorial).length ? (
        <Section title="Files & print settings">
          <View style={styles.settings}>
            {printSettingRows(tutorial).map((r) => (
              <View key={r.k} style={styles.setting}>
                <Text style={styles.settingKey}>{r.k}</Text>
                <Text style={styles.settingValue}>{r.v}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
      {tutorial.stl_files.length > 0 ? (
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

      {tutorial.tutorial_recommendations.length > 0 ? (
        <PicksRow
          recommendations={tutorial.tutorial_recommendations}
          firstName={primary?.profiles.name.split(' ')[0] ?? 'Creator'}
          onOpen={(rid) => router.push(`/guides/${rid}`)}
        />
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft, marginBottom: theme.spacing(3) },
  bannerText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  bannerStrong: { fontFamily: theme.fonts.black },
  safetyNote: { paddingVertical: theme.spacing(2), gap: theme.spacing(1) },
  safetyTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  settings: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  setting: { width: '48%', padding: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  settingKey: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted },
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
  heroCountText: { fontFamily: theme.fonts.black, fontSize: 12, color: theme.colors.ink },
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
  doneCard: { marginTop: theme.spacing(3), padding: theme.spacing(4), gap: theme.spacing(2), borderRadius: theme.radii.panel, backgroundColor: theme.colors.mintSoft, alignItems: 'center' },
  doneTitle: { fontFamily: theme.fonts.display, fontSize: 20, color: theme.colors.ink },
  doneBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, textAlign: 'center' },
  strip: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  thumb: { width: 52, height: 52, borderRadius: theme.radii.field, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: theme.colors.primaryDark },
  thumbImage: { width: '100%', height: '100%' },
  cost: { fontFamily: theme.fonts.numeral, fontSize: theme.type.caption, color: theme.colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.accentLight, marginTop: theme.spacing(2) },
  totalLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  checked: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  listItem: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    paddingVertical: theme.spacing(2),
  },
})
