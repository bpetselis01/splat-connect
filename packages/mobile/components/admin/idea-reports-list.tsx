// packages/mobile/components/admin/idea-reports-list.tsx
// The "Idea reports" tab: reports against a person inside a design challenge
// (GET /api/admin/reports). Unresolved first, as the API sorts them. Rows open
// idea-report-detail-screen, where an admin removes, dismisses or reinstates.
import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { EmptyState } from '../ui/EmptyState'
import { ListIntro, ListRow, Pill, RowThumb, StageFilter } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, useAdminLoad } from './use-admin-load'

export type IdeaReport = {
  id: string
  idea_id: string
  reported_profile_id: string
  reason: string
  created_at: string
  resolved_at: string | null
  resolution_note: string | null
  removed: boolean
  toy_ideas: { title: string } | null
  reported_profile: { name: string | null } | null
  reporter: { name: string | null } | null
}

export const IDEA_REPORTS_PATH = '/api/admin/reports'

type Stage = 'open' | 'resolved'

export function IdeaReportsList() {
  const router = useRouter()
  const { data, loading, error, forbidden, retry } = useAdminLoad<IdeaReport[]>(IDEA_REPORTS_PATH)
  const [stage, setStage] = useState<Stage>('open')

  if (forbidden) return <AdminsOnly />
  const all = data ?? []
  const open = (r: IdeaReport) => r.resolved_at === null
  const rows = all.filter((r) => (stage === 'open') === open(r))
  return (
    <>
      <ListIntro lead="Someone in a challenge reported another person. They are hidden from the reporter until you decide." />
      {loading ? (
        <LoadingRows />
      ) : error ? (
        <LoadFailed onRetry={retry} />
      ) : (
        <>
          <StageFilter
            label="Idea report status"
            current={stage}
            onPick={(id) => setStage(id as Stage)}
            options={
              [
                { id: 'open', label: 'Open', n: all.filter(open).length },
                { id: 'resolved', label: 'Resolved', n: all.filter((r) => !open(r)).length },
              ] as never
            }
          />
          {rows.length === 0 ? (
            <EmptyState
              icon="flag-outline"
              title={`No ${stage} idea reports.`}
              hint="When a member reports someone in a challenge, it shows up here."
            />
          ) : (
            rows.map((r) => (
              <View key={r.id} style={styles.item}>
                <ListRow
                  thumb={<RowThumb glyph="people-outline" tint={theme.colors.apricotSoft} />}
                  title={`${r.reported_profile?.name ?? 'A member'} in ${r.toy_ideas?.title ?? 'a challenge'}`}
                  meta={`Reported by ${r.reporter?.name ?? 'a member'} · ${shortDate(r.created_at)}`}
                  pill={
                    <>
                      <Pill
                        label={open(r) ? 'Open' : 'Resolved'}
                        bg={open(r) ? theme.colors.apricotSoft : theme.colors.successSoft}
                        icon={open(r) ? 'flag-outline' : 'checkmark-circle-outline'}
                      />
                      {r.removed ? <Pill label="Removed" bg={theme.colors.tone.sunken.bg} /> : null}
                    </>
                  }
                  onPress={() => router.push(`/admin/reports/idea/${r.id}`)}
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

const styles = StyleSheet.create({ item: { marginBottom: theme.spacing(3) } })
