// packages/mobile/components/guides/showcase-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ContributorProfile, OrgPublicProfile, Tutorial } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

type ShowcaseKind = 'person' | 'org'
type ShowcaseProfile = ContributorProfile | OrgPublicProfile
type ShelfToy = OrgPublicProfile['toysShared'][number]

/**
 * Same visual markup as library-screen's TutorialRow card (photo/placeholder,
 * title, difficulty + kind badges) — kept as its own copy rather than an
 * import, since that component is private to the library list.
 */
function GuideCard({ tutorial, onPress }: { tutorial: Tutorial; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tutorial.title}
      accessibilityHint={`${tutorial.difficulty} difficulty. ${KIND_LABEL[tutorial.kind]}. Opens the guide.`}
      pressScale={0.985}
      style={styles.rowPress}
    >
      <Card style={styles.card}>
        {tutorial.toy_photo_url ? (
          <Image source={{ uri: tutorial.toy_photo_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Ionicons name="color-wand-outline" size={30} color={theme.colors.primary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {tutorial.title}
          </Text>
          {/* Hidden from the accessibility tree, same reason as library-screen's
              TutorialRow: the row is already a button whose spoken name would
              otherwise absorb these badges and double-announce them. The
              row's hint carries difficulty and kind instead. */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.badgeRow}>
            <Badge status={tutorial.difficulty} />
            <Badge status={tutorial.kind} label={KIND_LABEL[tutorial.kind]} />
          </View>
        </View>
      </Card>
    </AnimatedPressable>
  )
}

function ToyRow({ toy }: { toy: ShelfToy }) {
  return (
    <View style={styles.toyRow}>
      <Text style={styles.toyName}>{toy.name}</Text>
      <Badge status="published" label={`${toy.quantity} available`} />
    </View>
  )
}

/**
 * The contributor or organisation showcase behind a guide's byline / backing
 * chip. `kind` picks the endpoint and the field names it renders — the two
 * response shapes (`ContributorProfile`, `OrgPublicProfile`) differ, so this
 * always narrows on `kind` rather than probing which fields are present.
 */
export function ShowcaseScreen({ kind, id }: { kind: ShowcaseKind; id: string }) {
  const router = useRouter()
  const [profile, setProfile] = useState<ShowcaseProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // library-screen's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(false)
    const path = kind === 'person' ? `/api/public/contributors/${id}` : `/api/public/organizations/${id}`
    apiClient
      .get<ShowcaseProfile>(path)
      .then((data) => {
        if (!ignore) setProfile(data)
      })
      .catch((err) => {
        console.error('[ShowcaseScreen] profile fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [kind, id, reloadKey])

  if (loading) {
    return (
      <View style={styles.container}>
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
    )
  }

  if (error || !profile) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this profile."
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      </View>
    )
  }

  const guides: Tutorial[] =
    kind === 'person' ? (profile as ContributorProfile).tutorials : (profile as OrgPublicProfile).tutorialsBacked
  const toys = kind === 'org' ? (profile as OrgPublicProfile).toysShared : []
  const firstName = profile.name.split(' ')[0]

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={[styles.avatar, kind === 'org' && styles.avatarSquare]}>
          <Text style={styles.avatarInitial}>{profile.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.meta}>
            {guides.length} guides · {profile.toysShared.length} toys shared
          </Text>
        </View>
      </View>

      {guides.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{kind === 'person' ? `Guides by ${firstName}` : 'Guides they back'}</Text>
          {guides.map((t) => (
            <GuideCard
              key={t.id}
              tutorial={t}
              onPress={() => router.push({ pathname: '/guides/[id]', params: { id: t.id } })}
            />
          ))}
        </View>
      ) : null}

      {kind === 'org' && toys.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Toys on their shelf</Text>
          {toys.map((toy) => (
            <ToyRow key={toy.id} toy={toy} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  header: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(4), marginBottom: theme.spacing(6) },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Square for orgs — the same distinction web's initial badge draws with
  // rounded-2xl vs. a person's circular avatar.
  avatarSquare: { borderRadius: theme.radii.md },
  avatarInitial: { fontFamily: theme.fonts.bold, fontSize: theme.type.title, color: theme.colors.primaryDeep },
  headerBody: { flex: 1 },
  name: { fontFamily: theme.fonts.bold, fontSize: theme.type.title, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(1) },
  section: { marginBottom: theme.spacing(6) },
  sectionTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text, marginBottom: theme.spacing(3) },
  rowPress: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', gap: theme.spacing(4), padding: theme.spacing(3) },
  thumbnail: { width: 104, height: 104, borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceSunken },
  thumbnailPlaceholder: {
    width: 104,
    height: 104,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, justifyContent: 'center', gap: theme.spacing(2) },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: theme.type.heading, lineHeight: 24 },
  badgeRow: { flexDirection: 'row', gap: theme.spacing(2) },
  toyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing(2),
    ...theme.shadow(3),
  },
  toyName: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
})
