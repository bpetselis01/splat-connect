// packages/mobile/components/admin/member-reports-screen.tsx
// The admin's inbox of private problem reports: GET /api/admin/member-reports,
// already sorted safety first, then unresolved, then oldest. Mobile's half of
// web's components/admin-reports.tsx; the opened report is member-report-detail-screen.
// An "Idea reports" tab sits beside it: reports against a person in a challenge.
import { useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { EmptyState } from '../ui/EmptyState'
import { Segmented } from '../ui/Segmented'
import { ListIntro, ListRow, Pill, RowThumb, StageFilter } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, useAdminLoad } from './use-admin-load'
import { IdeaReportsList } from './idea-reports-list'

export type ReportStatus = 'new' | 'looking' | 'resolved'
export type ReportCategory = 'safety' | 'no_show' | 'arrived_broken' | 'wrong_info' | 'conduct' | 'other'
export type MemberReport = {
  id: string
  subject_kind: string
  subject_label: string
  category: ReportCategory
  body: string
  ok_to_contact: boolean
  status: ReportStatus
  note_to_reporter: string | null
  reporter_name: string | null
  created_at: string
}

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  safety: 'Safety',
  no_show: 'No-show',
  arrived_broken: 'Arrived broken',
  wrong_info: 'Wrong info',
  conduct: 'Conduct',
  other: 'Other',
}

export const STATUS_PILL: Record<ReportStatus, { label: string; bg: string; icon: React.ComponentProps<typeof Pill>['icon'] }> = {
  new: { label: 'New', bg: theme.colors.apricotSoft, icon: 'flag-outline' },
  looking: { label: 'Looking', bg: theme.colors.honeySoft, icon: 'eye-outline' },
  resolved: { label: 'Resolved', bg: theme.colors.successSoft, icon: 'checkmark-circle-outline' },
}

const STAGES: { id: ReportStatus; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'looking', label: 'Looking' },
  { id: 'resolved', label: 'Resolved' },
]

function MemberReportsList() {
  const router = useRouter()
  const { data, loading, error, forbidden, retry } = useAdminLoad<MemberReport[]>('/api/admin/member-reports')
  const [stage, setStage] = useState<ReportStatus>('new')

  if (forbidden) return <AdminsOnly />

  const all = data ?? []
  const rows = all.filter((r) => r.status === stage)
  return (
    <>
      <ListIntro lead="Safety reports first, then oldest waiting. Tell the reporter what happened when you close one." />
      {loading ? (
        <LoadingRows />
      ) : error ? (
        <LoadFailed onRetry={retry} />
      ) : (
        <>
          <StageFilter
            label="Report status"
            current={stage}
            onPick={(id) => setStage(id as ReportStatus)}
            options={STAGES.map((s) => ({ ...s, n: all.filter((r) => r.status === s.id).length })) as never}
          />
          {rows.length === 0 ? (
            <EmptyState
              icon="flag-outline"
              title={`No ${STAGES.find((s) => s.id === stage)!.label.toLowerCase()} reports.`}
              hint="When a member reports a guide, toy or message, it shows up here."
            />
          ) : (
            rows.map((r) => (
              <View key={r.id} style={styles.item}>
                <ListRow
                  thumb={<RowThumb glyph="flag-outline" tint={theme.colors.apricotSoft} />}
                  title={r.subject_label}
                  meta={`Reported by ${r.reporter_name ?? 'a member'} · ${shortDate(r.created_at)}`}
                  pill={
                    <>
                      <Pill {...STATUS_PILL[r.status]} />
                      <Pill label={CATEGORY_LABEL[r.category]} bg={theme.colors.tone.sunken.bg} />
                    </>
                  }
                  onPress={() => router.push(`/admin/reports/${r.id}`)}
                  accessibilityHint="Opens the report."
                />
              </View>
            ))
          )}
        </>
      )}
    </>
  )
}

export function MemberReportsScreen() {
  const [tab, setTab] = useState<'member' | 'ideas'>('member')
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Segmented
          label="Kind of report"
          variant="pills"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'member', label: 'Member reports' },
            { value: 'ideas', label: 'Idea reports' },
          ]}
        />
        {tab === 'member' ? <MemberReportsList /> : <IdeaReportsList />}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  item: { marginBottom: theme.spacing(3) },
})
