// packages/mobile/components/organisation/org-requests-screen.tsx
/**
 * Requests to your organisation — web's /dashboard/organisation/requests. Every
 * ask a family can make of an organisation (a toy, parts, a build) is one
 * table, so it is one queue, in three segments.
 *
 * Rows open the thread rather than acting here: accepting a toy needs a pickup
 * address, a print a bed check, a decline a reason, and the thread is where
 * each of those lives. Not the review queue at /organisation — that asks a
 * different question of a different thing.
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { subjectName, type ToyTransactionSummary } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Badge } from '../ui/Badge'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'

const TABS = [
  { key: 'toys', label: 'Lend a toy', types: ['donation', 'exchange'], empty: 'No toy requests right now.' },
  { key: 'parts', label: 'Print parts', types: ['print'], empty: 'No part requests yet.' },
  { key: 'builds', label: 'Build a guide', types: ['build'], empty: 'No build requests right now.' },
] as const

type TabKey = (typeof TABS)[number]['key']

const threadRoute = (t: ToyTransactionSummary) =>
  t.type === 'build' ? `/exchanges/build/${t.id}` : t.type === 'print' ? `/printing/jobs/${t.id}` : `/exchanges/${t.id}`

export function OrgRequestsScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [all, setAll] = useState<ToyTransactionSummary[] | null>(null)
  const [tab, setTab] = useState<TabKey | null>(null)

  useFocusEffect(
    useCallback(() => {
      let ignore = false
      apiClient
        .get<ToyTransactionSummary[]>('/api/toy-transactions?role=owner')
        .catch(() => [] as ToyTransactionSummary[])
        .then((rows) => !ignore && setAll(rows))
      return () => {
        ignore = true
      }
    }, [])
  )

  if (!all || !caps) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  // The organisation's, not the leader's own; finished records leave the queue.
  const led = new Set(caps.ledOrgs.map((o) => o.id))
  const mine = all.filter(
    (t) => t.owner_org_id && led.has(t.owner_org_id) && (t.status === 'requested' || t.status === 'accepted')
  )
  const rowsFor = (key: TabKey) => {
    const types: readonly string[] = TABS.find((t) => t.key === key)!.types
    return mine
      .filter((t) => types.includes(t.type))
      .sort((a, b) => (a.status === b.status ? 0 : a.status === 'requested' ? -1 : 1))
  }
  const pending = (key: TabKey) => rowsFor(key).filter((t) => t.status === 'requested').length
  // Open on whatever is waiting, like web without a ?tab.
  const current =
    TABS.find((t) => t.key === tab) ??
    TABS.find((t) => pending(t.key) > 0) ??
    TABS.find((t) => rowsFor(t.key).length > 0) ??
    TABS[0]
  const rows = rowsFor(current.key)

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>
          Everything a family can ask of {caps.ledOrgs[0]?.name ?? 'your organisation'}, in one place. A declined
          family is told straight away.
        </Text>
        <View style={styles.tabs} accessibilityRole="radiogroup">
          {TABS.map((t) => {
            const n = pending(t.key)
            return (
              <Chip
                key={t.key}
                role="radio"
                label={n > 0 ? `${t.label} · ${n}` : t.label}
                active={t.key === current.key}
                onPress={() => setTab(t.key)}
              />
            )
          })}
        </View>
        {rows.length === 0 ? (
          <EmptyState icon="file-tray-outline" title={current.empty} />
        ) : (
          rows.map((t) => {
            const note = t.last_message?.kind === 'user' ? t.last_message.body : null
            return (
              <AnimatedPressable
                key={t.id}
                onPress={() => router.push(threadRoute(t) as never)}
                accessibilityRole="button"
                accessibilityLabel={`${t.requester_name ?? 'A family'}, ${subjectName(t)}`}
              >
                <Card style={styles.row}>
                  <View style={styles.top}>
                    <Text style={styles.name}>{t.requester_name ?? 'A family'}</Text>
                    {t.status === 'requested' ? <Badge status="requested" label="Needs you" /> : <Badge status={t.status} />}
                  </View>
                  <Text style={styles.meta} numberOfLines={2}>
                    {subjectName(t)}
                    {note ? ` · “${note}”` : ''}
                  </Text>
                </Card>
              </AnimatedPressable>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(2), paddingBottom: theme.spacing(8) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21, marginBottom: theme.spacing(1) },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  row: { padding: theme.spacing(3), gap: theme.spacing(1) },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing(2) },
  name: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, flexShrink: 1 },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
