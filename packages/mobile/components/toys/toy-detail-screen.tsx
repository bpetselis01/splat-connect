// packages/mobile/components/toys/toy-detail-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Toy, ToyWithOwner } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { useCapabilities } from '../../lib/capabilities'
import { Meter } from '../ui/Meter'
import { SaveButton } from '../ui/SaveButton'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { RequestBlock } from './request-block'

/**
 * The horizontal photo strip: cover photo first, then the switch-adapted
 * photos (only when the toy is switch-adapted, matching web's ToyPhotoGrid).
 *
 * The ScrollView's contentContainerStyle pads past the 4px hard shadow on
 * every frame, on both axes — the Phase 1 lesson (see picks-row.tsx) that a
 * hard shadow clips at the scroll edge without room for it to fall into.
 */
function PhotoStrip({ toy }: { toy: ToyWithOwner }) {
  const urls = [toy.cover_photo_url, ...(toy.switch_adapted ? toy.switch_photo_urls : [])].filter(
    (u): u is string => !!u
  )

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoStripContent}>
      {urls.length > 0 ? (
        urls.map((url, i) => <Image key={url + i} source={{ uri: url }} style={styles.photo} />)
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="cube-outline" size={48} color={theme.colors.primary} />
        </View>
      )}
    </ScrollView>
  )
}

export function ToyDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const saves = useSaves()
  const { caps } = useCapabilities()
  const [toy, setToy] = useState<ToyWithOwner | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [myToys, setMyToys] = useState<Toy[]>([])
  const [myToysLoaded, setMyToysLoaded] = useState(false)
  const [myToysError, setMyToysError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ToyWithOwner>(`/api/public/toys/${id}`)
      .then((data) => {
        if (!ignore) setToy(data)
      })
      .catch(() => {
        if (!ignore) setError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  const isOwner =
    !!caps &&
    !!toy &&
    (caps.profile.id === toy.owner_id || caps.ledOrgs.some((o) => o.id === toy.owner_org_id))

  // Only fetched once the toy has loaded, the caller's capabilities are
  // known, and they are not the owner — the owner never sees the chooser,
  // so there's nothing for this fetch to feed there.
  useEffect(() => {
    if (!toy || !caps || isOwner) return
    let ignore = false
    setMyToysLoaded(false)
    setMyToysError(null)
    apiClient
      .get<Toy[]>('/api/toys')
      .then((all) => {
        if (!ignore) setMyToys(all.filter((t) => t.status === 'published' && !t.archived_at))
      })
      .catch(() => {
        // RequestBlock reads this to keep "Arrange exchange" from claiming
        // there is nothing to offer — an empty chooser and a failed fetch
        // must not say the same thing.
        if (!ignore) setMyToysError("Couldn't load your toys — try again.")
      })
      .finally(() => {
        if (!ignore) setMyToysLoaded(true)
      })
    return () => {
      ignore = true
    }
  }, [toy, caps, isOwner])

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="100%" height={180} style={styles.loadingPhoto} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="50%" height={14} />
      </View>
    )
  }
  if (error || !toy) {
    return (
      <View style={styles.container}>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this toy." />
      </View>
    )
  }

  const orgName = toy.organizations?.name ?? null
  const personName = toy.profiles?.name ?? null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <PhotoStrip toy={toy} />

      <View style={styles.titleRow}>
        <Text style={styles.title}>{toy.name}</Text>
        <SaveButton slug="toys" id={toy.id} saves={saves} />
      </View>

      {orgName ? (
        <View style={styles.holderRow}>
          <Text style={styles.holder}>
            Held by{' '}
            <Text
              onPress={() => router.push(`/toy-library/organisation/${toy.owner_org_id}`)}
              accessibilityRole="link"
              style={styles.holderLink}
            >
              {orgName}
            </Text>
          </Text>
          <Text style={styles.holderQty}>{`· ${toy.quantity} available`}</Text>
        </View>
      ) : personName ? (
        <Text style={styles.holder}>{`Held by ${personName}`}</Text>
      ) : null}

      <View style={styles.factRow}>
        <View style={styles.factTile}>
          <Text style={styles.factLabel}>Condition</Text>
          <View style={styles.factValueRow}>
            <Meter value={toy.condition} />
            <Text style={styles.factValue}>{`${toy.condition} / 10`}</Text>
          </View>
        </View>
        <View style={styles.factTile}>
          <Text style={styles.factLabel}>Switch-adapted</Text>
          <Text style={styles.factValue}>{toy.switch_adapted ? 'Yes · 3.5mm jack' : 'No'}</Text>
        </View>
      </View>

      {toy.description ? <Text style={styles.description}>{toy.description}</Text> : null}

      {caps && !isOwner ? (
        <RequestBlock
          toy={toy}
          myToys={myToys}
          myToysLoaded={myToysLoaded}
          myToysError={myToysError}
          onStarted={(txId) => router.push(`/exchanges/${txId}`)}
        />
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10), gap: theme.spacing(4) },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  loadingPhoto: { borderRadius: theme.radii.lg, marginBottom: theme.spacing(2) },
  photoStripContent: { gap: theme.spacing(3), paddingRight: 6, paddingBottom: 8, paddingLeft: 2, paddingTop: 2 },
  photo: {
    width: 220,
    height: 180,
    borderRadius: theme.radii.lg,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.surfaceSunken,
    ...theme.shadow(4),
  },
  photoPlaceholder: {
    width: 220,
    height: 180,
    borderRadius: theme.radii.lg,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow(4),
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing(3) },
  title: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.title, color: theme.colors.text, lineHeight: 30 },
  holderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  holder: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  holderLink: { fontFamily: theme.fonts.bold, color: theme.colors.primaryDeep, textDecorationLine: 'underline' },
  holderQty: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  factRow: { flexDirection: 'row', gap: theme.spacing(3) },
  factTile: {
    flex: 1,
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(3),
    gap: theme.spacing(1),
    ...theme.shadow(3),
  },
  factLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  factValueRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  factValue: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  description: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.muted, lineHeight: 23 },
})
