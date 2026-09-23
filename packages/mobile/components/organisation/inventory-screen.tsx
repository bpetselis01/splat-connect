// packages/mobile/components/organisation/inventory-screen.tsx
// What an organisation holds. Mobile's half of web's
// app/dashboard/organisation/toys/page.tsx: rows from GET /api/toys/inventory,
// the quantity as the Jersey-10 numeral. Five of the same bear is one listing.
//
// The spec's "Handed in" group is omitted on purpose: a handoff decrements
// quantity and mints the receiver's row — nothing marks a unit as handed in,
// and web's own page has no such group either. Ledgered, not invented.
//
// Title comes from the native header (app/(my)/_layout.tsx: "Toy inventory").
import { useCallback, useEffect, useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { ToyWithOwner } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useCapabilities } from '../../lib/capabilities'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro, ListRow, ListSection, Pill, RowThumb } from '../list/list-kit'

function StockRow({ toy, onPress }: { toy: ToyWithOwner; onPress: () => void }) {
  // The board's shelf words: nothing left is Out, a published listing is
  // Available, anything else is still the leader's draft.
  const pill =
    toy.quantity === 0 ? (
      <Pill label="Out" bg={theme.colors.honeySoft} icon="arrow-redo-outline" />
    ) : toy.status === 'published' ? (
      <Pill label="Available" bg={theme.colors.mintSoft} icon="checkmark-circle-outline" />
    ) : (
      <Pill label="Draft" bg={theme.colors.surfaceSunken} fg={theme.colors.muted} icon="eye-off-outline" />
    )
  return (
    <View style={styles.rowPress}>
      <ListRow
        title={toy.name}
        meta={`${toy.quantity} in stock · Condition ${toy.condition}/10${toy.switch_adapted ? ' · Switch-adapted' : ''}`}
        thumb={<RowThumb photo={toy.cover_photo_url} />}
        pill={pill}
        onPress={onPress}
        accessibilityHint={`${toy.quantity} in stock. Opens the toy.`}
        titleLines={1}
      />
    </View>
  )
}

export function InventoryScreen() {
  const router = useRouter()
  const { caps, loading: capsLoading } = useCapabilities()
  const ledOrgs = caps?.ledOrgs ?? []
  const [toys, setToys] = useState<ToyWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const isLeader = ledOrgs.length > 0

  useEffect(() => {
    if (!isLeader) {
      setLoading(false)
      return
    }
    let ignore = false
    setLoading(true)
    setError(false)
    apiClient
      .get<ToyWithOwner[]>('/api/toys/inventory')
      .then((data) => {
        if (!ignore) setToys(data)
      })
      .catch((err) => {
        console.error('[InventoryScreen] inventory fetch failed:', err)
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey, isLeader])

  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  // While capabilities are in flight, ledOrgs is empty for everyone — showing
  // the not-a-leader copy in that window tells a real leader this isn't their
  // screen for as long as the fetch takes.
  if (capsLoading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (!isLeader) {
    return (
      <Screen>
        <EmptyState
          icon="business-outline"
          title="This screen belongs to organisation leaders."
          hint="When an organisation makes you a leader, its shelf shows up here."
        />
      </Screen>
    )
  }

  // One flat list when one org; grouped shelves when several — one org's name
  // on every row would be noise, and no heading at all would mix two shelves.
  const groups =
    ledOrgs.length > 1
      ? ledOrgs
          .map((org) => ({ name: org.name, toys: toys.filter((t) => t.owner_org_id === org.id) }))
          .filter((g) => g.toys.length > 0)
      : [{ name: null as string | null, toys }]

  const units = toys.reduce((n, t) => n + t.quantity, 0)
  const openToy = (id: string) => router.push(`/toys/${id}`)

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* The API's POST /api/toys takes owner_org_id + quantity, but the
            add-toy screen has no org mode yet — this lands on the personal
            form. Ledgered as the follow-up rather than a form invented here. */}
        <ListIntro
          lead={
            loading || error
              ? undefined
              : `${toys.length} listing${toys.length === 1 ? '' : 's'}, ${units} unit${units === 1 ? '' : 's'} on the shelf.`
          }
          cta="+ Add to inventory"
          onCta={() => router.push('/toys/new')}
        />

        {loading ? (
          <View>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : error ? (
          <EmptyState icon="cloud-offline-outline" title="Couldn't load the shelf." hint="Check your connection and try again.">
            <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
          </EmptyState>
        ) : toys.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="Nothing on the shelf yet."
            hint="Add stock to hold toys for local families — five of the same bear is one listing."
          />
        ) : (
          groups.map((group) => (
            <View key={group.name ?? 'all'} style={styles.group}>
              {group.name ? <ListSection>{group.name}</ListSection> : null}
              {group.toys.map((toy) => (
                <StockRow key={toy.id} toy={toy} onPress={() => openToy(toy.id)} />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  group: { marginBottom: theme.spacing(4) },
  rowPress: { marginBottom: theme.spacing(3) },
})
