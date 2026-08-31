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

  // Fetched once, on mount — every source is small enough to load whole and
  // filter client-side as the query changes, rather than a search endpoint
  // per keystroke.
  useEffect(() => {
    let ignore = false
    Promise.all([
      apiClient.get<Tutorial[]>('/api/public/tutorials'),
      apiClient.get<ToyWithOwner[]>('/api/public/toys'),
      apiClient.get<Organization[]>('/api/public/organizations'),
    ])
      .then(([t, ty, o]) => {
        if (ignore) return
        setTutorials(t)
        setToys(ty)
        setOrgs(o)
      })
      .catch((err) => console.error('[ExploreScreen] search fetch failed:', err))
    return () => {
      ignore = true
    }
  }, [])

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
          placeholder="Search guides, toys and organisations"
          value={search}
          onChangeText={setSearch}
          boxStyle={styles.searchBar}
        />

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
