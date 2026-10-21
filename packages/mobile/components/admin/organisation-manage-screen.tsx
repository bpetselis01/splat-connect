// packages/mobile/components/admin/organisation-manage-screen.tsx
// Create an organisation (no orgId) or manage one: rename, suspend, verify, and
// add or remove leaders. Mobile's half of web's admin organisations drawers.
// Creating grants review authority at once, so the button says so.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import type { AdminAccountsResponse, Profile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { ListRow, ListSection } from '../list/list-kit'
import { AccountPicker } from './account-picker'
import { AdminsOnly, LoadFailed, LoadingRows, adminError, useAdminLoad } from './use-admin-load'
import { leaderName, type OrgWithLeaders } from './organisations-screen'

export function OrganisationManageScreen({ orgId }: { orgId?: string }) {
  const router = useRouter()
  const orgs = useAdminLoad<OrgWithLeaders[]>('/api/organizations')
  const accounts = useAdminLoad<AdminAccountsResponse>('/api/admin/contributors')
  const [name, setName] = useState<string | null>(null)
  const [description, setDescription] = useState<string | null>(null)
  const [firstLeader, setFirstLeader] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const org = orgId ? orgs.data?.find((o) => o.id === orgId) : undefined

  async function run(call: () => Promise<void>) {
    setBusy(true)
    setFailure(null)
    try {
      await call()
    } catch (err) {
      setFailure(adminError(err))
    } finally {
      setBusy(false)
    }
  }

  // Keeps the loaded list in step with a write, so the change shows without a reload.
  const patchLocal = (change: (o: OrgWithLeaders) => OrgWithLeaders) =>
    orgs.setData((list) => (list ?? []).map((o) => (o.id === orgId ? change(o) : o)))

  if (accounts.forbidden || orgs.forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }
  if (orgs.loading || accounts.loading) {
    return (
      <Screen>
        <LoadingRows />
      </Screen>
    )
  }
  if (orgs.error || accounts.error || !accounts.data) {
    return (
      <Screen>
        <LoadFailed
          onRetry={() => {
            orgs.retry()
            accounts.retry()
          }}
        />
      </Screen>
    )
  }
  if (orgId && !org) {
    return (
      <Screen>
        <EmptyState icon="business-outline" title="That organisation isn't here any more." hint="Go back to the list to see what is there." />
      </Screen>
    )
  }

  const people = accounts.data.accounts
  const nameValue = name ?? org?.name ?? ''
  const descriptionValue = description ?? org?.description ?? ''

  const fields = (
    <>
      <TextField label="Name" accessibilityLabel="Name" value={nameValue} onChangeText={setName} />
      <TextField label="Description" accessibilityLabel="Description" value={descriptionValue} onChangeText={setDescription} multiline style={styles.paragraph} />
    </>
  )

  if (!org) {
    return (
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {fields}
          <ListSection style={styles.section}>First leader</ListSection>
          {firstLeader ? (
            <ListRow title={firstLeader.name || firstLeader.email} meta={`${firstLeader.email} · Tap to change`} onPress={() => setFirstLeader(null)} accessibilityLabel="Change the first leader" />
          ) : (
            <AccountPicker accounts={people} onPick={setFirstLeader} />
          )}
          <Text style={styles.hint}>
            Required. An organisation with no leader cannot answer any request. Creating it grants review authority straight away, with no second approval step.
          </Text>
          <ErrorRow message={failure} />
          <Button
            label="Create organisation"
            disabled={busy}
            onPress={() => {
              if (!nameValue.trim() || !firstLeader) {
                setFailure('Give it a name and pick a first leader.')
                return
              }
              void run(async () => {
                await apiClient.post('/api/admin/organizations', {
                  name: nameValue.trim(),
                  description: descriptionValue.trim() || null,
                  leader_user_id: firstLeader.id,
                })
                router.back()
              })
            }}
          />
        </ScrollView>
      </Screen>
    )
  }

  const leaders = org.org_leaders ?? []
  const suspended = org.status === 'suspended'
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {fields}
        <Button
          label="Save details"
          variant="secondary"
          disabled={busy || !nameValue.trim()}
          onPress={() =>
            void run(async () => {
              await apiClient.patch(`/api/admin/organizations/${org.id}`, { name: nameValue.trim(), description: descriptionValue.trim() })
              patchLocal((o) => ({ ...o, name: nameValue.trim(), description: descriptionValue.trim() }))
            })
          }
        />

        <ListSection style={styles.section}>{`Leaders (${leaders.length})`}</ListSection>
        {leaders.length === 0 ? <Text style={styles.hint}>None. This organisation cannot answer any request until it has one.</Text> : null}
        {leaders.map((l) => {
          const who = leaderName(accounts.data, l.user_id)
          return (
            <View key={l.user_id} style={styles.item}>
              <ListRow
                title={who}
                trailing={
                  <Button
                    label="Remove"
                    variant="danger"
                    accessibilityLabel={`Remove ${who}`}
                    disabled={busy}
                    onPress={() =>
                      void run(async () => {
                        await apiClient.delete(`/api/admin/organizations/${org.id}/leaders/${l.user_id}`)
                        patchLocal((o) => ({ ...o, org_leaders: (o.org_leaders ?? []).filter((x) => x.user_id !== l.user_id) }))
                      })
                    }
                  />
                }
              />
            </View>
          )
        })}
        <Text style={styles.label}>Add a leader</Text>
        <AccountPicker
          accounts={people}
          exclude={new Set(leaders.map((l) => l.user_id))}
          onPick={(a) =>
            void run(async () => {
              await apiClient.post(`/api/admin/organizations/${org.id}/leaders`, { user_id: a.id })
              patchLocal((o) => ({ ...o, org_leaders: [...(o.org_leaders ?? []), { user_id: a.id }] }))
            })
          }
        />

        <ListSection style={styles.section}>Standing</ListSection>
        <ErrorRow message={failure} />
        <View style={styles.row}>
          <Button
            label={suspended ? 'Reactivate' : 'Suspend'}
            variant={suspended ? 'primary' : 'secondary'}
            disabled={busy}
            style={styles.flex}
            onPress={() =>
              void run(async () => {
                const status = suspended ? 'active' : 'suspended'
                await apiClient.patch(`/api/admin/organizations/${org.id}`, { status })
                patchLocal((o) => ({ ...o, status }))
              })
            }
          />
          <Button
            label={org.verified_at ? 'Remove verified' : 'Mark verified'}
            variant="secondary"
            disabled={busy}
            style={styles.flex}
            onPress={() =>
              void run(async () => {
                const verified = !org.verified_at
                await apiClient.patch(`/api/admin/organizations/${org.id}`, { verified })
                patchLocal((o) => ({ ...o, verified_at: verified ? new Date().toISOString() : null }))
              })
            }
          />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(8) },
  paragraph: { minHeight: 72, textAlignVertical: 'top' },
  section: { marginTop: theme.spacing(5) },
  item: { marginBottom: theme.spacing(2) },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, lineHeight: 19, color: theme.colors.muted, marginVertical: theme.spacing(3) },
  label: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink, marginTop: theme.spacing(3), marginBottom: theme.spacing(1) },
  row: { flexDirection: 'row', gap: theme.spacing(3), marginTop: theme.spacing(2) },
  flex: { flex: 1 },
})
