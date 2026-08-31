// packages/mobile/components/explore/explore-screen.tsx
import { useEffect, useState, type ReactNode } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, ToyWithOwner, Organization } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useLearnProgress } from '../../lib/learn'
import { LEARN_ARTICLES } from '../../lib/learn-content'
import { Screen } from '../ui/Screen'
import { ScreenHeader } from '../ui/ScreenHeader'
import { TextField } from '../ui/TextField'
import { Card } from '../ui/Card'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { Button } from '../ui/Button'

function ResultRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressScale={0.99}
      style={styles.resultRow}
    >
      <Text style={styles.resultLabel} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
    </AnimatedPressable>
  )
}

function ResultGroup({ eyebrow, children }: { eyebrow: string; children: ReactNode }) {
  return (
    <View style={styles.resultGroup}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Card style={styles.resultCard}>{children}</Card>
    </View>
  )
}

function DoorCard({
  title,
  blurb,
  tint,
  icon,
  extra,
  onPress,
}: {
  title: string
  blurb: string
  tint: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  extra?: ReactNode
  onPress: () => void
}) {
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={blurb}
      pressScale={0.985}
      style={styles.doorPress}
    >
      <Card style={[styles.doorCard, { backgroundColor: tint }]}>
        <View style={styles.doorIcon}>
          <Ionicons name={icon} size={22} color={theme.colors.primaryDeep} />
        </View>
        <View style={styles.doorBody}>
          <View style={styles.doorTitleRow}>
            <Text style={styles.doorTitle}>{title}</Text>
            {extra}
          </View>
          <Text style={styles.doorBlurb} numberOfLines={2}>
            {blurb}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
      </Card>
    </AnimatedPressable>
  )
}

export function ExploreScreen() {
  const router = useRouter()
  const { count } = useLearnProgress()
  const [search, setSearch] = useState('')
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [toys, setToys] = useState<ToyWithOwner[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [searchError, setSearchError] = useState(false)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // toy-library-screen's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)

  // Fetched once per reload, not once per keystroke — every source is small
  // enough to load whole and filter client-side as the query changes.
  //
  // allSettled rather than all: one source 500ing must not blank the other
  // two forever (this effect only reruns on retry, not on every render), so
  // each source is applied independently and only the failed one is reported.
  useEffect(() => {
    let ignore = false
    setLoading(true)
    setSearchError(false)
    Promise.allSettled([
      apiClient.get<Tutorial[]>('/api/public/tutorials'),
      apiClient.get<ToyWithOwner[]>('/api/public/toys'),
      apiClient.get<Organization[]>('/api/public/organizations'),
    ]).then(([t, ty, o]) => {
      if (ignore) return
      if (t.status === 'fulfilled') setTutorials(t.value)
      else console.error('[ExploreScreen] tutorials fetch failed:', t.reason)
      if (ty.status === 'fulfilled') setToys(ty.value)
      else console.error('[ExploreScreen] toys fetch failed:', ty.reason)
      if (o.status === 'fulfilled') setOrgs(o.value)
      else console.error('[ExploreScreen] organizations fetch failed:', o.reason)
      setSearchError([t, ty, o].some((r) => r.status === 'rejected'))
      setLoading(false)
    })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  const q = search.trim().toLowerCase()
  const matchedGuides = q ? tutorials.filter((t) => t.title.toLowerCase().includes(q)) : []
  const matchedToys = q ? toys.filter((t) => t.name.toLowerCase().includes(q)) : []
  const matchedOrgs = q ? orgs.filter((o) => o.name.toLowerCase().includes(q)) : []

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ScreenHeader
          title="Explore"
          subtitle="Search everything, plus Learn, Get Involved and About."
          showLogo
        />

        <TextField
          icon="search"
          placeholder="Search guides, toys, organisations"
          value={search}
          onChangeText={setSearch}
          boxStyle={styles.searchBar}
        />

        {searchError ? (
          <View style={styles.errorRow}>
            <Text style={styles.errorText}>Couldn&apos;t load everything — try again.</Text>
            <Button
              label="Try again"
              variant="secondary"
              disabled={loading}
              onPress={() => setReloadKey((k) => k + 1)}
              style={styles.errorRetry}
            />
          </View>
        ) : null}

        {q ? (
          <View style={styles.results}>
            {matchedGuides.length ? (
              <ResultGroup eyebrow="Guides">
                {matchedGuides.map((t) => (
                  <ResultRow key={t.id} label={t.title} onPress={() => router.push(`/guides/${t.id}`)} />
                ))}
              </ResultGroup>
            ) : null}
            {matchedToys.length ? (
              <ResultGroup eyebrow="Toys">
                {matchedToys.map((t) => (
                  <ResultRow key={t.id} label={t.name} onPress={() => router.push(`/toy-library/${t.id}`)} />
                ))}
              </ResultGroup>
            ) : null}
            {matchedOrgs.length ? (
              <ResultGroup eyebrow="Organisations">
                {matchedOrgs.map((o) => (
                  <ResultRow
                    key={o.id}
                    label={o.name}
                    onPress={() => router.push(`/toy-library/organisation/${o.id}`)}
                  />
                ))}
              </ResultGroup>
            ) : null}
          </View>
        ) : null}

        <DoorCard
          title="Learn"
          blurb="Toy adaptation 101 → Switch types → Choosing a toy → …"
          tint={theme.colors.honeySoft}
          icon="book-outline"
          extra={<Text style={styles.progressChip}>{`${count}/${LEARN_ARTICLES.length}`}</Text>}
          onPress={() => router.push('/explore/learn')}
        />
        <DoorCard
          title="Get Involved"
          blurb="Design challenges · Submit an idea"
          tint={theme.colors.mintSoft}
          icon="hand-left-outline"
          onPress={() => router.push('/explore/challenges')}
        />
        <DoorCard
          title="About SPLAT"
          blurb="Who we are · Partners · Contact · Safety"
          tint={theme.colors.surfaceSunken}
          icon="information-circle-outline"
          onPress={() => router.push('/explore/about')}
        />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  searchBar: {
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    paddingHorizontal: theme.spacing(4),
    ...theme.shadow(4),
  },
  errorRow: { marginBottom: theme.spacing(3), alignItems: 'center' },
  errorText: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.danger,
    textAlign: 'center',
    marginBottom: theme.spacing(2),
  },
  errorRetry: { paddingHorizontal: theme.spacing(6) },
  results: { marginBottom: theme.spacing(2) },
  resultGroup: { marginBottom: theme.spacing(3) },
  eyebrow: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: theme.spacing(1),
  },
  resultCard: { padding: theme.spacing(2) },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(2),
  },
  resultLabel: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.text },
  doorPress: { marginBottom: theme.spacing(3) },
  doorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(3),
  },
  doorIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.md,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorBody: { flex: 1 },
  doorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  doorTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.heading, color: theme.colors.text },
  progressChip: {
    fontFamily: theme.fonts.numeral,
    fontSize: 17,
    color: theme.colors.primaryDeep,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing(2),
    lineHeight: 20,
  },
  doorBlurb: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    marginTop: theme.spacing(1),
    lineHeight: 18,
  },
})
