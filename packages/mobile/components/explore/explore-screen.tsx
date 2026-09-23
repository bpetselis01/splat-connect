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

/**
 * The board's Explore row (#explore): a white card, a 52px tinted icon tile,
 * a Baloo title over one line of blurb, and a caret.
 */
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
      pressScale={0.98}
      style={styles.door}
    >
      <View style={[styles.doorIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={26} color={theme.colors.ink} />
      </View>
      <View style={styles.doorBody}>
        <View style={styles.doorTitleRow}>
          <Text style={styles.doorTitle}>{title}</Text>
          {extra}
        </View>
        <Text style={styles.doorBlurb}>{blurb}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
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
    // The native header draws "Explore" and the back button (explore/_layout).
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <TextField
          icon="search"
          placeholder="Search guides, toys, organisations"
          value={search}
          onChangeText={setSearch}
          boxStyle={styles.searchBar}
          search
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

        {/* The board's seven, in its order. Every destination the old doors
            had is here: Get Involved was the challenges list, and is now
            named for what it opens. */}
        <DoorCard
          title="Learn"
          blurb="How switch adaptation works, first switch to safe finish."
          tint={theme.colors.honeySoft}
          icon="school-outline"
          extra={<Text style={styles.progressChip}>{`${count}/${LEARN_ARTICLES.length}`}</Text>}
          onPress={() => router.push('/explore/learn')}
        />
        <DoorCard
          title="Design challenges"
          blurb="Problems nobody has solved yet, open to anyone."
          tint={theme.colors.violetSoft}
          icon="extension-puzzle-outline"
          onPress={() => router.push('/explore/challenges')}
        />
        <DoorCard
          title="Makers wanted"
          blurb="Families who found the guide but cannot build it. Claim one."
          tint={theme.colors.mintSoft}
          icon="hammer-outline"
          onPress={() => router.push('/explore/makers-wanted')}
        />
        <DoorCard
          title="Organisations"
          blurb="The services standing behind the work."
          tint={theme.colors.mintSoft}
          icon="business-outline"
          onPress={() => router.push('/toy-library/organisations')}
        />
        <DoorCard
          title="3D printing"
          blurb="Someone nearby prints the parts; you cover the filament. Or offer your printer."
          tint={theme.colors.apricotSoft}
          icon="cube-outline"
          onPress={() => router.push('/printing')}
        />
        <DoorCard
          title="Recycle plastic"
          blurb="Drop clean waste plastic at an organisation that can extrude it. Earn print credit on their machines."
          tint={theme.colors.mintSoft}
          icon="leaf-outline"
          onPress={() => router.push('/explore/recycling')}
        />
        <DoorCard
          title="About SPLAT"
          blurb="Who runs this, and how to reach us."
          tint={theme.colors.accentLight}
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
    borderRadius: theme.radii.pill,
    borderWidth: theme.border.hairline,
    paddingHorizontal: theme.spacing(4),
    ...theme.shadow(2),
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
  door: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    marginBottom: theme.spacing(3),
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  doorIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorBody: { flex: 1 },
  doorTitleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  doorTitle: { fontFamily: theme.fonts.display, fontSize: 18, lineHeight: 24, color: theme.colors.ink },
  progressChip: {
    fontFamily: theme.fonts.numeral,
    fontSize: 13,
    color: theme.colors.primaryDeep,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    paddingHorizontal: theme.spacing(2),
    lineHeight: 20,
    overflow: 'hidden',
  },
  doorBlurb: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
    lineHeight: 19,
  },
})
