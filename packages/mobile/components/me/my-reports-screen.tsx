// packages/mobile/components/me/my-reports-screen.tsx
// What you reported, and what SPLAT said back (GET /api/reports). Mobile's half
// of web's app/dashboard/reports/page.tsx. A report_resolved notice opens here.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro, ListRow, Pill, RowThumb } from '../list/list-kit'
import { CATEGORY_LABEL, type MemberReport } from '../admin/member-reports-screen'

type MyReport = Omit<MemberReport, 'reporter_name'>

// The reporter's words for the admin's three states.
const STATUS = {
  new: { label: 'Sent', bg: theme.colors.apricotSoft, icon: 'paper-plane-outline' },
  looking: { label: 'Being looked at', bg: theme.colors.honeySoft, icon: 'eye-outline' },
  resolved: { label: 'Resolved', bg: theme.colors.successSoft, icon: 'checkmark-circle-outline' },
} as const

export function MyReportsScreen() {
  const [reports, setReports] = useState<MyReport[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let ignore = false
      setLoadFailed(false)
      apiClient
        .get<MyReport[]>('/api/reports')
        .then((rows) => {
          if (!ignore) setReports(rows)
        })
        .catch((err) => {
          logFailure('[MyReportsScreen] fetch failed:', err)
          if (!ignore) setLoadFailed(true)
        })
      return () => {
        ignore = true
      }
    }, [reloadKey]),
  )

  if (loadFailed && !reports) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your reports." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
        </EmptyState>
      </Screen>
    )
  }
  if (!reports) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead="Problems you told SPLAT about. The person you reported is never told it was you." />
        {reports.length === 0 ? (
          <EmptyState icon="flag-outline" title="No reports yet" hint="When you report a problem, you can follow what happened to it here." />
        ) : (
          reports.map((r) => (
            <View key={r.id} style={styles.item}>
              <ListRow
                thumb={<RowThumb glyph="flag-outline" tint={theme.colors.apricotSoft} />}
                title={r.subject_label}
                meta={`Sent ${shortDate(r.created_at)}`}
                pill={
                  <>
                    <Pill {...STATUS[r.status]} />
                    <Pill label={CATEGORY_LABEL[r.category]} bg={theme.colors.tone.sunken.bg} />
                  </>
                }
              />
              {r.note_to_reporter ? (
                <Card style={styles.reply}>
                  <Text style={styles.replyLabel}>From SPLAT</Text>
                  <Text style={styles.replyText}>{r.note_to_reporter}</Text>
                </Card>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(10) },
  item: { marginBottom: theme.spacing(3), gap: theme.spacing(2) },
  reply: { gap: theme.spacing(1) },
  replyLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.muted },
  replyText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.text },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
})
