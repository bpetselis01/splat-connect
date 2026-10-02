// packages/mobile/components/my-toys/summary-screen.tsx
/**
 * The board's "Your toy" (MB toy_detail): a lead that says where the listing
 * stands, then rows — the requests waiting on you, Edit listing, Mark
 * unavailable. The editor is one row away at /toys/[id]/edit.
 *
 * Reloaded on focus: the editor one push away changes the name and condition
 * the lead reads.
 */
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Toy, ToyTransactionSummary } from '@splat-connect/types'
import { apiMessage, isOwnerSide } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { loadOwnedToy, toySummaryLead } from '../../lib/my-toy'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { TextField } from '../ui/TextField'
import { ListIntro, ListRow, Pill } from '../list/list-kit'

export function ToySummaryScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [toy, setToy] = useState<Toy | null>(null)
  const [requests, setRequests] = useState<ToyTransactionSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [retireNote, setRetireNote] = useState('')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useFocusEffect(
    useCallback(() => {
      let ignore = false
      Promise.all([loadOwnedToy(id), apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')])
        .then(([owned, txs]) => {
          if (ignore) return
          if (!owned) {
            setState('error')
            return
          }
          setToy(owned.toy)
          setRequests(txs)
          setState('ready')
        })
        .catch((err) => {
          console.error('[ToySummaryScreen] load failed:', err)
          if (!ignore) setState('error')
        })
      return () => {
        ignore = true
      }
    }, [id])
  )

  if (state === 'loading') {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (state === 'error' || !toy) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this toy." hint="Check your connection and try again." />
      </Screen>
    )
  }

  const ledOrgIds = caps?.ledOrgs.map((o) => o.id) ?? []
  // Requests still waiting on this holder — the same isOwnerSide check the
  // editor's count uses, so a leader's org toy counts too.
  const open = requests.filter(
    (t) => t.toy_id === toy.id && t.status === 'requested' && !!caps && isOwnerSide(t, caps.profile.id, ledOrgIds)
  )

  async function togglePaused() {
    setError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, { paused_at: toy?.paused_at ? null : new Date().toISOString() })
      setToy((cur) => (cur ? { ...cur, ...updated } : updated))
    } catch (err) {
      setError(apiMessage(err, 'Could not save that. Please try again.'))
    }
  }

  /** The family's own note, never a system line or a reply. */
  const noteOf = (t: ToyTransactionSummary) =>
    t.last_message?.kind === 'user' && t.last_message.sender_id === t.requester_id ? t.last_message.body : null

  async function accept(t: ToyTransactionSummary) {
    // A person picks where to meet as they accept: the exchange's own form.
    if (!t.owner_org_id) {
      router.push(`/exchanges/${t.id}?accept=1`)
      return
    }
    // An organisation's pickup point is fixed; accept reads it from the org.
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/toy-transactions/${t.id}/accept`, {})
      setRequests((rs) => rs.map((r) => (r.id === t.id ? { ...r, status: 'accepted' } : r)))
    } catch (err) {
      setError(apiMessage(err, 'Could not accept that request. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function retire() {
    setBusy(true)
    setError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, {
        retired_at: new Date().toISOString(),
        retired_note: retireNote.trim() || null,
      })
      setToy((cur) => (cur ? { ...cur, ...updated } : updated))
    } catch (err) {
      setError(apiMessage(err, 'Could not retire this toy. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead={toySummaryLead(toy, open.length)} />
        <View style={styles.rows}>
          {open.map((t) => (
            <ListRow
              key={t.id}
              title={t.requester_name ?? t.other_party_name}
              meta={noteOf(t)}
              onPress={() => router.push(`/exchanges/${t.id}`)}
              trailing={
                <Button
                  label="Accept"
                  variant="secondary"
                  disabled={busy || t.blocked_by_rival_accept}
                  onPress={() => void accept(t)}
                  style={styles.accept}
                />
              }
            />
          ))}
          <ListRow title="Edit listing" meta="Photos, condition, notes" onPress={() => router.push(`/toys/${toy.id}/edit`)} />
          {/* A retired toy takes no requests either way: no pause to toggle. */}
          {toy.status === 'published' && !toy.retired_at ? (
            <ListRow
              title={toy.paused_at ? 'Take requests again' : 'Mark unavailable'}
              meta={toy.paused_at ? null : 'Keeps it listed but hides the request button'}
              onPress={togglePaused}
            />
          ) : null}
          <ErrorRow message={error} />
        </View>
        {toy.owner_org_id ? (
          toy.retired_at ? (
            <View style={styles.retired}>
              <Pill label="Retired" bg={theme.colors.surfaceSunken} fg={theme.colors.muted} icon="archive-outline" />
              {toy.retired_note ? <Text style={styles.note}>{toy.retired_note}</Text> : null}
            </View>
          ) : (
            <View style={styles.retired}>
              <TextField
                label="Why it is retired"
                accessibilityLabel="Why it is retired"
                placeholder="Broken 12 Aug"
                maxLength={80}
                value={retireNote}
                onChangeText={setRetireNote}
              />
              <Button label="Retire" variant="secondary" disabled={busy} onPress={() => void retire()} />
            </View>
          )
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  rows: { gap: theme.spacing(3) },
  accept: { paddingHorizontal: theme.spacing(4), minHeight: 40 },
  retired: { marginTop: theme.spacing(5), gap: theme.spacing(2) },
  note: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
})
