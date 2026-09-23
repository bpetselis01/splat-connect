import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, Part, Tool, StlFile, Recommendation, TutorialStep } from '@splat-connect/types'
import { KIND_LABEL, MATURITY_LABEL, fitLine } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useSaves } from '../../lib/saves'
import { useMyChildren } from '../../lib/my-children'
import { theme } from '../../lib/theme'
import { Provenance, type ProvenanceContributor, type ProvenanceOrg } from '../guides/provenance'
import { PicksRow } from '../guides/picks-row'
import { Badge } from '../ui/Badge'
import { SaveButton } from '../ui/SaveButton'
import { PhotoCarousel } from '../ui/PhotoCarousel'
import { Button } from '../ui/Button'
import { Section } from '../ui/Section'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { ReportProblem } from '../reports/report-problem'

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
}

/**
 * One line of the parts or tools list.
 *
 * `label` is deliberately a single Text node: the suite matches the whole
 * string ("Micro switch × 2"), which splitting the quantity into its own
 * element would break.
 */
function ListRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.listRow}>
      <Ionicons name={icon} size={17} color={theme.colors.primary} />
      <Text style={styles.listItem}>{label}</Text>
    </View>
  )
}

export function DetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const saves = useSaves()
  const children = useMyChildren()
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Thanks (066): once per person, never on your own guide. Unknown until the
  // GET lands, and a failed GET hides the button rather than guessing.
  const [thanks, setThanks] = useState<{ thanked: boolean; own: boolean } | null>(null)
  const [thanking, setThanking] = useState(false)

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
  const steps = tutorial.steps ?? []
  const { lead, rest } = splitLead(tutorial.description ?? '')

  const primary = tutorial.tutorial_contributors.find((c) => c.role === 'primary') ?? tutorial.tutorial_contributors[0]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Bleeds to the screen's edges and up under the header, as the board's hero does. */}
      <View style={styles.hero}>
        <PhotoCarousel urls={tutorial.photo_urls} height={HERO_HEIGHT} emptyIcon="color-wand-outline" />
        {/* ponytail: a count, not "1/5" — PhotoCarousel (components/ui) does not
            report its page yet; switch to an index once it has onIndexChange. */}
        {tutorial.photo_urls.length > 0 ? (
          <View style={styles.heroCount} pointerEvents="none">
            <Text style={styles.heroCountText} numberOfLines={1}>
              {`${tutorial.photo_urls.length} photo${tutorial.photo_urls.length === 1 ? '' : 's'} · ${tutorial.title}`}
            </Text>
          </View>
        ) : null}
      </View>

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

      {steps.length > 0 ? (
        <Section title="Steps" hint="One action at a time. The PDF has the same guide to print.">
          {steps.map((st) => (
            <View key={st.id} testID={`guide-step-${st.position}`} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{st.position}</Text>
              </View>
              <View style={styles.stepText}>
                {st.title ? <Text style={styles.stepTitle}>{st.title}</Text> : null}
                <Text style={styles.stepBody}>{st.body}</Text>
                {st.photo_url ? (
                  <Image
                    source={{ uri: st.photo_url }}
                    style={styles.stepPhoto}
                    accessibilityLabel={st.title ? `Step ${st.position}: ${st.title}` : `Step ${st.position}`}
                  />
                ) : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {rest ? (
        <Section title="About this guide">
          <Text style={styles.description}>{rest}</Text>
        </Section>
      ) : null}

      <Section title="Parts" hint="What you'll need to buy or salvage.">
        {tutorial.parts.length ? (
          tutorial.parts.map((item) => (
            <ListRow
              key={item.id}
              icon="cube-outline"
              label={`${item.name} × ${item.quantity}${item.is_optional ? ' (optional)' : ''}`}
            />
          ))
        ) : (
          <Text style={styles.listItem}>No parts listed.</Text>
        )}
      </Section>

      <Section title="Tools" hint="What you'll need on the bench.">
        {tutorial.tools.length ? (
          tutorial.tools.map((item) => (
            <ListRow
              key={item.id}
              icon="build-outline"
              label={`${item.name}${item.is_optional ? ' (optional)' : ''}`}
            />
          ))
        ) : (
          <Text style={styles.listItem}>No tools listed.</Text>
        )}
      </Section>

      {/* The way into printing. Keyed on the guide having STL files rather than
          on its kind: a print request's parts ARE those files, so a guide
          without any has nothing to ask for, whatever kind it is. */}
      {tutorial.stl_files.length > 0 ? (
        <AnimatedPressable
          onPress={() => router.push({ pathname: '/printing', params: { guide: tutorial.id } })}
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
  step: { flexDirection: 'row', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentLight,
  },
  stepNumText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  stepText: { flex: 1, gap: theme.spacing(1) },
  stepTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  stepBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21 },
  stepPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: theme.radii.field,
    marginTop: theme.spacing(1),
    backgroundColor: theme.colors.surfaceSunken,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  listItem: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    paddingVertical: theme.spacing(2),
  },
})
