// packages/mobile/components/saved/saved-list-screen.tsx
// One saved-type list. GET /api/saves/:slug returns each entity in the same
// shape its public list serves (the route copies those selects on purpose), so
// this renders compact rows rather than re-implementing the three full cards —
// a saved list is a shortcut shelf, not a second browse surface.
//
// The native header carries the type's name (app/(my)/_layout.tsx).
import { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { gradeOf, guideMeta, type Difficulty, type SaveSlug } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { SaveButton } from '../ui/SaveButton'
import { ListIntro, ListRow, RowThumb } from '../list/list-kit'

/** The wire shape is per-slug; these are the fields the rows read. */
type SavedEntity = {
  id: string
  title?: string
  name?: string
  summary?: string | null
  description?: string | null
  condition?: number
  difficulty?: Difficulty
  build_minutes?: number | null
  author_name?: string | null
  toy_photo_url?: string | null
  cover_photo_url?: string | null
  profiles?: { name: string } | null
  organizations?: { name: string } | null
  filename?: string
  tutorial_id?: string
  tutorials?: { title: string } | null
}

/** The row's second line and picture, per kind of thing saved. */
function rowFacts(slug: SaveSlug, item: SavedEntity): { meta: string | null; photo: string | null } {
  if (slug === 'tutorials' && item.difficulty) {
    return {
      meta: guideMeta({ difficulty: item.difficulty, build_minutes: item.build_minutes ?? null }, item.author_name),
      photo: item.toy_photo_url ?? null,
    }
  }
  if (slug === 'toys' && item.condition != null) {
    const holder = item.organizations?.name ?? item.profiles?.name ?? null
    return { meta: [gradeOf(item.condition).label, holder].filter(Boolean).join(' · '), photo: item.cover_photo_url ?? null }
  }
  return { meta: item.summary ?? item.description ?? item.tutorials?.title ?? null, photo: null }
}

const KIND: Record<
  SaveSlug,
  {
    noun: string
    lead: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    route: (item: SavedEntity) => string
    browseLabel: string
    browse: string
  }
> = {
  tutorials: {
    noun: 'guides',
    lead: 'Guides you kept to build later.',
    icon: 'book-outline',
    route: (item) => `/guides/${item.id}`,
    browseLabel: 'Browse the guides',
    browse: '/guides',
  },
  toys: {
    noun: 'toys',
    lead: 'Toys you are considering asking for.',
    icon: 'cube-outline',
    route: (item) => `/toy-library/${item.id}`,
    browseLabel: 'Browse the toy library',
    browse: '/toy-library',
  },
  challenges: {
    noun: 'challenges',
    lead: 'Challenges to come back to.',
    icon: 'bulb-outline',
    route: (item) => `/explore/challenges/${item.id}`,
    browseLabel: 'Browse design challenges',
    browse: '/explore/challenges',
  },
  organisations: {
    noun: 'organisations',
    lead: 'Organisations you want to find again.',
    icon: 'business-outline',
    route: (item) => `/toy-library/organisation/${item.id}`,
    browseLabel: 'Browse organisations',
    browse: '/toy-library/organisations',
  },
  parts: {
    noun: 'parts',
    lead: 'Printable parts you want to make or ask someone to print for you.',
    icon: 'cube-outline',
    // The phone has no catalogue: a part opens the guide it belongs to.
    route: (item) => `/guides/${item.tutorial_id}`,
    browseLabel: 'Browse the guides',
    browse: '/guides',
  },
}

/** The header's name for a saved list: Saved guides, Saved toys… */
export function savedTitle(slug: string | undefined) {
  const noun = slug ? KIND[slug as keyof typeof KIND]?.noun : undefined
  return noun ? `Saved ${noun}` : 'Saved'
}

export function SavedListScreen({ slug }: { slug: SaveSlug }) {
  const router = useRouter()
  const saves = useSaves()
  const kind = KIND[slug]
  const [items, setItems] = useState<SavedEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let ignore = false
    // A pull-driven reload keeps the current rows on screen; skeletons are
    // for arriving with nothing.
    if (!refreshing) setLoading(true)
    setError(false)
    apiClient
      .get<SavedEntity[]>(`/api/saves/${slug}`)
      .then((data) => {
        if (!ignore) setItems(data)
      })
      .catch((err) => {
        console.error('[SavedListScreen] fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [slug, reloadKey])

  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  return (
    <Screen>
      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-offline-outline"
          title={`Couldn't load your saved ${kind.noun}.`}
          hint="Check your connection and try again."
        >
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          icon={kind.icon}
          title="Nothing saved here yet."
          hint="The bookmark on any card puts it on this shelf."
        >
          <Button label={kind.browseLabel} variant="accent" onPress={() => router.push(kind.browse)} style={styles.retry} />
        </EmptyState>
      ) : (
        // A ScrollView, not a View: this used to be a static container, which
        // capped the shelf at one screenful — anything below the fold was
        // unreachable.
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
        >
          <ListIntro lead={kind.lead} />
          {items.map((item) => {
            // tutorials/challenges carry title; toys and organisations carry name.
            const label = item.title ?? item.name ?? item.filename ?? ''
            const { meta, photo } = rowFacts(slug, item)
            return (
              // The bookmark is a sibling of the pressable, never a child —
              // the same rule as every other saveable row.
              <View key={item.id} style={styles.saveHost}>
                <ListRow
                  onPress={() => router.push(kind.route(item))}
                  accessibilityLabel={label}
                  thumb={<RowThumb photo={photo} glyph={kind.icon} />}
                  title={label}
                  meta={meta}
                  // Room for the island, which sits over the row beside the chevron.
                  trailing={<View style={styles.islandRoom} />}
                />
                <View style={styles.saveButtonWrap} pointerEvents="box-none">
                  <SaveButton slug={slug} id={item.id} saves={saves} />
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: theme.spacing(6) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(6) },
  saveHost: { position: 'relative', marginBottom: theme.spacing(3) },
  islandRoom: { width: 32 },
  // Centred beside the chevron: 15 padding + 18 chevron + 13 gap from the edge.
  saveButtonWrap: { position: 'absolute', top: 0, bottom: 0, right: 40, justifyContent: 'center' },
})
