import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, Part, Tool, StlFile, Recommendation } from '@splat-connect/types'
import { KIND_LABEL, MATURITY_LABEL } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { useSaves } from '../../lib/saves'
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

type TutorialDetail = Tutorial & {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_contributors: ProvenanceContributor[]
  tutorial_orgs: ProvenanceOrg[]
  tutorial_recommendations: Recommendation[]
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
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiClient
      .get<TutorialDetail>(`/api/public/tutorials/${id}`)
      .then(setTutorial)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

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

  const primary = tutorial.tutorial_contributors.find((c) => c.role === 'primary') ?? tutorial.tutorial_contributors[0]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhotoCarousel urls={tutorial.photo_urls} emptyIcon="color-wand-outline" />

      <View style={styles.titleRow}>
        <Text style={styles.title}>{tutorial.title}</Text>
        <SaveButton slug="tutorials" id={tutorial.id} saves={saves} />
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
        <Badge status={tutorial.kind} label={KIND_LABEL[tutorial.kind]} />
        {tutorial.maturity !== 'complete' ? (
          <Badge status={tutorial.maturity} label={MATURITY_LABEL[tutorial.maturity]} />
        ) : null}
      </View>
      {tutorial.description ? <Text style={styles.description}>{tutorial.description}</Text> : null}

      <Provenance
        contributors={tutorial.tutorial_contributors}
        orgs={tutorial.tutorial_orgs}
        onPerson={(pid) => router.push(`/guides/contributor/${pid}`)}
        onOrg={(oid) => router.push(`/guides/organisation/${oid}`)}
      />

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

      <Button label="Preview Tutorial" onPress={openPreview} />

      {tutorial.kind === 'assistive_tech' ? (
        <View style={styles.printCard}>
          <View style={styles.printHeader}>
            <Text style={styles.printTitle}>Request this 3D print</Text>
            <Badge status="pending" label="Soon" />
          </View>
          <Text style={styles.printHint}>Ask a contributor or organisation with a printer</Text>
        </View>
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
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  loadingPhoto: { borderRadius: theme.radii.lg, marginBottom: theme.spacing(2) },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing(4),
    backgroundColor: theme.colors.surfaceSunken,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.lg,
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
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
    lineHeight: 30,
  },
  badgeRow: { flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2) },
  printCard: {
    marginTop: theme.spacing(5),
    opacity: 0.62,
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(4),
    ...theme.shadow(4),
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
    color: theme.colors.muted,
    lineHeight: 23,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(6),
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
