// packages/mobile/components/toys/toy-detail-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { gradeOf, PICK_KIND_LABEL, toyFacts, toyHolderName, type OfferType, type Toy, type ToyDetail } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useSaves } from '../../lib/saves'
import { recordRecent } from '../../lib/recents'
import { useCapabilities } from '../../lib/capabilities'
import { ItemActions } from '../ui/ItemActions'
import { Toast, useToast } from '../ui/Toast'
import { PhotoViewer } from '../ui/PhotoViewer'
import { Skeleton } from '../ui/Skeleton'
import { PhotoCarousel } from '../ui/PhotoCarousel'
import { EmptyState } from '../ui/EmptyState'
import { RequestBlock } from './request-block'
import { Pill } from '../list/list-kit'

const OFFER_LABEL: Record<OfferType, string> = {
  donation: 'Gift — nothing comes back',
  exchange: 'Swap — one of yours for it',
  both: 'Gift or swap',
}

/** A read-only fact pill, the board's tinted chip with an optional glyph. */
export function ToyDetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const saves = useSaves()
  const { caps } = useCapabilities()
  const [toy, setToy] = useState<ToyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [myToys, setMyToys] = useState<Toy[]>([])
  const [myToysLoaded, setMyToysLoaded] = useState(false)
  const [myToysError, setMyToysError] = useState<string | null>(null)
  const [thanked, setThanked] = useState(false)
  const [thanking, setThanking] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  const toaster = useToast()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    let ignore = false
    apiClient
      .get<ToyDetail>(`/api/public/toys/${id}`)
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
        if (!ignore) setMyToys(all.filter((t) => t.status === 'published'))
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

  // "Pick up where you left off": once per open, when the toy has loaded.
  useEffect(() => {
    if (!toy) return
    recordRecent({
      id: toy.id,
      kind: 'toy',
      title: toy.name,
      subtitle: toy.holder_suburb ? `Toy · ${[toy.holder_suburb, toy.holder_state].filter(Boolean).join(', ')}` : 'Toy',
      badge: gradeOf(toy.condition).label,
      href: `/toy-library/${toy.id}`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toy?.id])

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="100%" height={288} style={styles.loadingPhoto} />
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
  // "Newcastle, NSW" — the board's subtitle. Nothing at all without a suburb.
  const place = toy.holder_suburb ? [toy.holder_suburb, toy.holder_state].filter(Boolean).join(', ') : null
  const canAsk = !!caps && !isOwner
  // The holder to thank: a person through 117, an organisation through 077.
  // Nobody to thank on your own toy.
  const thankTo = !canAsk ? null : toy.owner_org_id && orgName ? orgName : toy.owner_id && personName ? personName : null

  /** True once thanked (a 409 is "already thanked", the same end state). */
  async function thankHolder(): Promise<boolean> {
    setThanking(true)
    try {
      await apiClient.post(toy!.owner_org_id ? `/api/organizations/${toy!.owner_org_id}/thanks` : `/api/contributors/${toy!.owner_id}/thanks`, {})
      setThanked(true)
      return true
    } catch (err) {
      if (err instanceof Error && /status 409/.test(err.message)) {
        setThanked(true)
        return true
      }
      return false
    } finally {
      setThanking(false)
    }
  }

  return (
    <View style={styles.container}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <PhotoCarousel
          urls={toy.photo_urls}
          height={288}
          switchUrl={toy.switch_adapted ? toy.switch_photo_url : null}
          onPress={setViewing}
        />
        <View style={styles.heroActions}>
          <ItemActions
            save={{ slug: 'toys', id: toy.id, saves }}
            thanks={thankTo ? { to: thankTo, thanked, busy: thanking, send: thankHolder } : undefined}
            report={{ kind: 'toy', id: toy.id, label: toy.name }}
            onToast={toaster.show}
          />
        </View>
      </View>

      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {toy.name}
        </Text>
      </View>

      {orgName ? (
        // One Text, so a long organisation name wraps like a sentence instead of
        // pushing the count and suburb off the screen.
        <Text style={styles.holder}>
          Held by{' '}
          <Text
            onPress={() => router.push(`/toy-library/organisation/${toy.owner_org_id}`)}
            accessibilityRole="link"
            style={styles.holderLink}
          >
            {orgName}
          </Text>
          {` · ${toy.quantity} available`}
          {place ? ` · ${place}` : ''}
        </Text>
      ) : personName ? (
        <Text style={styles.holder}>{`Held by ${personName}${place ? ` · ${place}` : ''}`}</Text>
      ) : null}

      <View style={styles.pillRow}>
        {toy.offer_type ? <Pill variant="large" icon="gift-outline" label={OFFER_LABEL[toy.offer_type]} bg={theme.colors.tone.mint.bg} fg={theme.colors.tone.mint.fg} /> : null}
        <Pill variant="large" icon="checkmark-circle-outline" label={`${gradeOf(toy.condition).label} condition`} bg={theme.colors.tone.mint.bg} fg={theme.colors.tone.mint.fg} />
        {toy.switch_adapted ? <Pill variant="large" label="Switch-adapted" bg={theme.colors.tone.brand.bg} fg={theme.colors.tone.brand.fg} /> : null}
      </View>

      {toy.description ? (
        <View style={styles.notes}>
          <Text style={styles.notesTitle}>Notes from the holder</Text>
          <Text style={styles.description}>{toy.description}</Text>
        </View>
      ) : null}

      {/* 075's facts, in the holder's words — the board's grid under the notes. */}
      {toyFacts(toy).length > 0 ? (
        <View style={styles.factGrid}>
          {toyFacts(toy).map((f) => (
            <View key={f.k} style={styles.factCell}>
              <Text style={styles.factLabel}>{f.k}</Text>
              <Text style={styles.factValue}>{f.v}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {toy.guide ? (
        <Pressable
          onPress={() => router.push(`/guides/${toy.guide!.id}`)}
          accessibilityRole="link"
          accessibilityLabel={`Built from ${toy.guide.title}. Open the guide`}
          style={styles.builtFrom}
        >
          <View style={styles.builtFromIcon}>
            <Ionicons name="book-outline" size={24} color={theme.colors.primaryDeep} />
          </View>
          <View style={styles.builtFromText}>
            <Text style={styles.builtFromTitle}>{`Built from ${toy.guide.title}`}</Text>
            <Text style={styles.builtFromNote}>Worth reading even if you take this one.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.ink} />
        </Pressable>
      ) : null}

      {canAsk ? (
        <RequestBlock
          toy={toy}
          myToys={myToys}
          myToysLoaded={myToysLoaded}
          myToysError={myToysError}
          onStarted={(txId) => router.push(`/exchanges/${txId}`)}
        />
      ) : null}

      {(toy.picks ?? []).length > 0 ? (
        <View style={styles.picks}>
          <Text style={styles.picksTitle} accessibilityRole="header">
            Also worth a look
          </Text>
          <Text style={styles.holder}>
            {`Picked by ${toyHolderName(toy) ?? 'the holder'} — what else they have listed, and the guides behind it.`}
          </Text>
          {(toy.picks ?? []).map((p) => (
            <Pressable
              key={`${p.kind}:${p.id}`}
              onPress={() => router.push(p.kind === 'toy' ? `/toy-library/${p.id}` : `/guides/${p.id}`)}
              accessibilityRole="link"
              accessibilityLabel={`${PICK_KIND_LABEL[p.kind]}: ${p.title}`}
              style={styles.pick}
            >
              <View style={styles.builtFromText}>
                <Text style={styles.factLabel}>{PICK_KIND_LABEL[p.kind]}</Text>
                <Text style={styles.builtFromTitle}>{p.title}</Text>
                {p.meta ? <Text style={styles.builtFromNote}>{p.meta}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.ink} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
    <PhotoViewer photos={toy.photo_urls.map((uri) => ({ uri }))} index={viewing} onClose={() => setViewing(null)} />
    <Toast toast={toaster.toast} onHide={toaster.hide} style={{ bottom: insets.bottom + theme.spacing(4) }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(10), gap: theme.spacing(4) },
  hero: { marginHorizontal: -theme.spacing(4), marginBottom: -theme.spacing(1) },
  heroActions: { position: 'absolute', top: theme.spacing(3), right: theme.spacing(3) },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  notes: {
    borderRadius: theme.radii.panel,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    ...theme.shadow(1),
  },
  notesTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.ink },
  // Wraps: "Thank <a long organisation name>" leaves no room for Report on one line.
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  loadingPhoto: { borderRadius: theme.radii.card, marginBottom: theme.spacing(2) },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing(3) },
  title: { flex: 1, fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.text, lineHeight: 32 },
  holder: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  holderLink: { fontFamily: theme.fonts.bold, color: theme.colors.primaryDeep, textDecorationLine: 'underline' },
  factLabel: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.muted,
  },
  factValue: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(3) },
  // Two across, the gap taken out of the width rather than left to overflow.
  factCell: {
    width: '47%',
    flexGrow: 1,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(3),
    gap: theme.spacing(1),
  },
  builtFrom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.accentLight,
    padding: theme.spacing(4),
  },
  builtFromIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  builtFromText: { flex: 1, gap: theme.spacing(0.5) },
  builtFromTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  builtFromNote: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink },
  description: { fontFamily: theme.fonts.regular, fontSize: theme.type.body, color: theme.colors.text, lineHeight: 23 },
  picks: { gap: theme.spacing(3) },
  picksTitle: { fontFamily: theme.fonts.display, fontSize: theme.type.heading, color: theme.colors.ink },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(3),
  },
})
