// packages/mobile/components/admin/organisations-screen.tsx
// Every organisation with its state and leaders: GET /api/organizations (which
// embeds org_leaders) plus the admin accounts list for the leaders' names.
// Mobile's half of web's app/admin/organizations/page.tsx; creating and managing
// one are organisation-manage-screen.
import { View, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import type { Organization, OrgLeader, AdminAccountsResponse } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { EmptyState } from '../ui/EmptyState'
import { ListIntro, ListRow, Pill, RowThumb } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, useAdminLoad } from './use-admin-load'

export type OrgWithLeaders = Organization & { org_leaders?: Pick<OrgLeader, 'user_id'>[] }

/** Leaders outside the accounts list (an admin, or past its cap) are never shown as a raw id. */
export const leaderName = (accounts: AdminAccountsResponse | null, id: string) => {
  const a = accounts?.accounts.find((x) => x.id === id)
  return a?.name || a?.email || 'Unlisted account'
}

export function orgState(org: OrgWithLeaders) {
  if (org.status === 'suspended') return { label: 'Suspended', bg: theme.colors.apricotSoft }
  if (!org.org_leaders?.length) return { label: 'No leader', bg: theme.colors.honeySoft }
  return { label: 'Active', bg: theme.colors.successSoft }
}

export function OrganisationsScreen() {
  const router = useRouter()
  const orgs = useAdminLoad<OrgWithLeaders[]>('/api/organizations')
  const accounts = useAdminLoad<AdminAccountsResponse>('/api/admin/contributors')

  if (accounts.forbidden || orgs.forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }

  const loading = orgs.loading || accounts.loading
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead="Create organisations, appoint leaders, suspend." cta="New organisation" onCta={() => router.push('/admin/organisations/new')} />
        {loading ? (
          <LoadingRows />
        ) : orgs.error || accounts.error || !orgs.data ? (
          <LoadFailed
            onRetry={() => {
              orgs.retry()
              accounts.retry()
            }}
          />
        ) : orgs.data.length === 0 ? (
          <EmptyState icon="business-outline" title="No organisations yet." hint="Create one to start delegating guide review." />
        ) : (
          orgs.data.map((o) => {
            const names = (o.org_leaders ?? []).map((l) => leaderName(accounts.data, l.user_id))
            const state = orgState(o)
            return (
              <View key={o.id} style={styles.item}>
                <ListRow
                  thumb={<RowThumb glyph="business-outline" tint={theme.colors.apricotSoft} />}
                  title={o.name}
                  meta={names.length ? names.join(', ') : 'No leaders yet'}
                  pill={
                    <>
                      <Pill label={state.label} bg={state.bg} />
                      {o.verified_at ? <Pill label="Verified" bg={theme.colors.accentLight} icon="checkmark-circle-outline" /> : null}
                    </>
                  }
                  onPress={() => router.push(`/admin/organisations/${o.id}`)}
                  accessibilityHint="Opens the organisation."
                />
              </View>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  item: { marginBottom: theme.spacing(3) },
})
