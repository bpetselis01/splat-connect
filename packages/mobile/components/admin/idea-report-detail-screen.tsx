// packages/mobile/components/admin/idea-report-detail-screen.tsx
// One opened idea report: who was reported, why, and the decision. Remove and
// Dismiss resolve it (PATCH /api/admin/reports/:id); Reinstate undoes a removal
// afterwards. There is no single-report route, so it reads the queue and finds
// the row, as member-report-detail-screen does.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { ListSection, Pill } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, adminError, useAdminLoad } from './use-admin-load'
import { IDEA_REPORTS_PATH, type IdeaReport } from './idea-reports-list'

export function IdeaReportDetailScreen({ reportId }: { reportId: string }) {
  const router = useRouter()
  const bottom = useBottomClearance()
  const { data, loading, error, forbidden, retry } = useAdminLoad<IdeaReport[]>(IDEA_REPORTS_PATH)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const report = data?.find((r) => r.id === reportId)

  async function run(call: () => Promise<unknown>) {
    setBusy(true)
    setFailure(null)
    try {
      await call()
      router.back()
    } catch (err) {
      setFailure(adminError(err))
    } finally {
      setBusy(false)
    }
  }
  const decide = (action: 'remove' | 'dismiss') =>
    run(() => apiClient.patch(`/api/admin/reports/${reportId}`, { action, resolution_note: note.trim() }))
  const reinstate = () =>
    run(() => apiClient.delete(`/api/admin/ideas/${report!.idea_id}/participants/${report!.reported_profile_id}/removal`))

  if (forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }
  if (loading || error || !report) {
    return (
      <Screen>
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <LoadFailed onRetry={retry} />
        ) : (
          <EmptyState icon="flag-outline" title="That report isn't here any more." hint="Go back to the list to see what is waiting." />
        )}
      </Screen>
    )
  }

  const open = report.resolved_at === null
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.pills}>
          <Pill
            label={open ? 'Open' : 'Resolved'}
            bg={open ? theme.colors.apricotSoft : theme.colors.successSoft}
            icon={open ? 'flag-outline' : 'checkmark-circle-outline'}
            variant="large"
          />
          {report.removed ? <Pill label="Removed" bg={theme.colors.tone.sunken.bg} variant="large" /> : null}
        </View>
        <Text style={styles.title}>{`${report.reported_profile?.name ?? 'A member'} in ${report.toy_ideas?.title ?? 'a challenge'}`}</Text>
        <Text style={styles.meta}>{`Reported by ${report.reporter?.name ?? 'a member'} · ${shortDate(report.created_at)}`}</Text>

        <ListSection style={styles.section}>What was reported</ListSection>
        <Card style={styles.quote}>
          <Text style={styles.quoteText}>{report.reason}</Text>
        </Card>

        {open ? (
          <>
            <ListSection style={styles.section}>Your decision</ListSection>
            <TextField
              label="Note for the record"
              accessibilityLabel="Note for the record"
              hint="Only admins see this. The reporter is not told."
              multiline
              numberOfLines={4}
              maxLength={2000}
              style={styles.paragraph}
              value={note}
              onChangeText={setNote}
            />
          </>
        ) : report.resolution_note ? (
          <>
            <ListSection style={styles.section}>Decision note</ListSection>
            <Card style={styles.quote}>
              <Text style={styles.quoteText}>{report.resolution_note}</Text>
            </Card>
          </>
        ) : null}
        <ErrorRow message={failure} />
      </ScrollView>
      {open || report.removed ? (
        <View style={[styles.footer, { paddingBottom: bottom }]}>
          {open ? (
            <>
              <Button label="Dismiss" variant="secondary" disabled={busy} onPress={() => void decide('dismiss')} style={styles.flex} />
              <Button label="Remove" disabled={busy} onPress={() => void decide('remove')} style={styles.flex} />
            </>
          ) : (
            <Button label="Reinstate" variant="secondary" disabled={busy} onPress={() => void reinstate()} style={styles.flex} />
          )}
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: theme.spacing(4) },
  pills: { flexDirection: 'row', gap: 6, marginBottom: theme.spacing(3) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, lineHeight: 30, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginTop: theme.spacing(1) },
  section: { marginTop: theme.spacing(6) },
  quote: { marginTop: theme.spacing(3) },
  quoteText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.text },
  paragraph: { minHeight: 96, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', gap: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
})
