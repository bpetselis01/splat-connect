// packages/mobile/components/printing/requests-screen.tsx
/**
 * My print requests — what the family has asked someone to print.
 *
 * One row per request, not per printer asked: a request sent to three printers
 * is three jobs, and `collapsePrintGroups` folds them into the one that
 * matters, carrying how many were asked. Live jobs sort first.
 *
 * The dashed "New request" row explains where requests start instead of
 * offering a button — a request needs a guide's parts, so it cannot start here.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ToyTransactionSummary } from '@splat-connect/types'
import { collapsePrintGroups } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { isLive, jobState, JOB_LABEL, JOB_TONE, plural } from '../../lib/printing'
import { Screen } from '../ui/Screen'
import { Badge } from '../ui/Badge'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const TINTS = [theme.colors.violetSoft, theme.colors.mintSoft, theme.colors.honeySoft]

function when(iso: string): string {
  const d = new Date(iso)
  return d.toDateString() === new Date().toDateString()
    ? 'Today'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function PrintRequestsScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [rows, setRows] = useState<ToyTransactionSummary[] | null>(null)
  const [error, setError] = useState(false)

  useFocusEffect(
    useCallback(() => {
      apiClient
        .get<ToyTransactionSummary[]>('/api/toy-transactions')
        .then((all) => {
          setRows(all)
          setError(false)
        })
        .catch((err) => {
          console.error('[PrintRequestsScreen] fetch failed:', err)
          setError(true)
        })
    }, [])
  )

  if (error && !rows) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your print requests." hint="Check your connection and try again." />
      </Screen>
    )
  }
  if (!rows || !caps) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const mine = collapsePrintGroups(rows.filter((t) => t.type === 'print' && t.requester_id === caps.profile.id))
  // Stable sort: the API's newest-first order holds inside each half.
  const ordered = [...mine].sort((a, b) => Number(isLive(b)) - Number(isLive(a)))

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.lede}>Parts you have asked someone to print. Tap one to see where it is.</Text>

        {ordered.map((tx, i) => {
          const state = jobState(tx)
          const parts = (tx.print_files ?? []).reduce((n, f) => n + f.quantity, 0)
          // Until somebody takes it, the family is waiting on a group, not a name.
          const who =
            state === 'asked' && tx.print_group_size > 1 ? `${tx.print_group_size} printers asked` : tx.other_party_name
          return (
            <AnimatedPressable
              key={tx.id}
              onPress={() => router.push(`/printing/jobs/${tx.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${tx.tutorial_title ?? 'A print job'}, ${JOB_LABEL[state]}`}
              pressScale={0.99}
              style={styles.row}
            >
              <View style={[styles.glyph, { backgroundColor: TINTS[i % TINTS.length] }]}>
                <Ionicons name="cube-outline" size={22} color={theme.colors.ink} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.title}>{tx.tutorial_title ?? 'A print job'}</Text>
                <Text style={styles.meta}>{[plural(parts, 'part'), who, when(tx.created_at)].join(' · ')}</Text>
                <Badge status={JOB_TONE[state]} label={JOB_LABEL[state]} />
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.muted} />
            </AnimatedPressable>
          )
        })}

        <AnimatedPressable
          onPress={() => router.push('/guides')}
          accessibilityRole="button"
          accessibilityLabel="New request. Open any guide with printable parts and tap Ask someone to print."
          style={styles.newRow}
        >
          <Ionicons name="add" size={20} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.title}>New request</Text>
            <Text style={styles.meta}>Open any guide with printable parts and tap Ask someone to print.</Text>
          </View>
        </AnimatedPressable>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 3 },
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(3) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    ...theme.shadow(2),
  },
  glyph: { width: 48, height: 48, borderRadius: theme.radii.field, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  },
})
