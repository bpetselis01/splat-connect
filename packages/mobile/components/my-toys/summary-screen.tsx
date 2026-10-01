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
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Toy, ToyTransactionSummary } from '@splat-connect/types'
import { isOwnerSide } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { loadOwnedToy, toySummaryLead } from '../../lib/my-toy'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { PendingRow } from '../ui/pending'
import { ListIntro, ListRow } from '../list/list-kit'

export function ToySummaryScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [toy, setToy] = useState<Toy | null>(null)
  const [requests, setRequests] = useState<ToyTransactionSummary[]>([])
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

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead={toySummaryLead(toy, open.length)} />
        <View style={styles.rows}>
          <ListRow title="Edit listing" meta="Photos, condition, notes" onPress={() => router.push(`/toys/${toy.id}/edit`)} />
          <PendingRow pending="toy-pause-unavailable" label="Mark unavailable" icon="pause-circle-outline" />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  rows: { gap: theme.spacing(3) },
})
