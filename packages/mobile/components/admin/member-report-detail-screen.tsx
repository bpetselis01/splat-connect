// packages/mobile/components/admin/member-report-detail-screen.tsx
// One opened report: what was said, a note to the reporter, and the next step
// pinned at the bottom. There is no single-report route, so it reads the queue
// and finds the row, as web's admin idea page does.
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
import { CATEGORY_LABEL, STATUS_PILL, type MemberReport, type ReportStatus } from './member-reports-screen'

export function MemberReportDetailScreen({ reportId }: { reportId: string }) {
  const router = useRouter()
  const bottom = useBottomClearance()
  const { data, loading, error, forbidden, retry } = useAdminLoad<MemberReport[]>('/api/admin/member-reports')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const report = data?.find((r) => r.id === reportId)

  async function send(status?: ReportStatus) {
    setBusy(true)
    setFailure(null)
    try {
      await apiClient.patch(`/api/admin/member-reports/${reportId}`, {
        ...(status ? { status } : {}),
        note_to_reporter: (note ?? report?.note_to_reporter ?? '').trim(),
      })
      router.back()
    } catch (err) {
      setFailure(adminError(err))
    } finally {
      setBusy(false)
    }
  }

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

  const pill = STATUS_PILL[report.status]
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.pills}>
          <Pill {...pill} variant="large" />
          <Pill label={CATEGORY_LABEL[report.category]} bg={theme.colors.tone.sunken.bg} variant="large" />
        </View>
        <Text style={styles.title}>{report.subject_label}</Text>
        <Text style={styles.meta}>
          {`Reported by ${report.reporter_name ?? 'a member'} · ${shortDate(report.created_at)}${report.ok_to_contact ? ' · OK to contact' : ''}`}
        </Text>

        <ListSection style={styles.section}>What was reported</ListSection>
        <Card style={styles.quote}>
          <Text style={styles.quoteText}>{report.body}</Text>
        </Card>

        <ListSection style={styles.section}>Your reply</ListSection>
        <TextField
          label="Note to the reporter"
          accessibilityLabel="Note to the reporter"
          hint="They see this in their notifications when you close the report."
          multiline
          numberOfLines={4}
          maxLength={2000}
          style={styles.paragraph}
          value={note ?? report.note_to_reporter ?? ''}
          onChangeText={setNote}
        />
        <ErrorRow message={failure} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: bottom }]}>
        {report.status === 'new' ? (
          <Button label="Looking into it" variant="secondary" disabled={busy} onPress={() => void send('looking')} style={styles.flex} />
        ) : null}
        {report.status === 'resolved' ? (
          <Button label="Save note" variant="secondary" disabled={busy} onPress={() => void send()} style={styles.flex} />
        ) : (
          <Button label="Resolve" disabled={busy} onPress={() => void send('resolved')} style={styles.flex} />
        )}
      </View>
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
