// packages/mobile/components/admin/accounts-screen.tsx
// Every non-admin account, newest first: GET /api/admin/contributors (capped at
// 1000 by the API, with the exact total). Mobile's half of web's
// app/admin/contributors/page.tsx. Search filters the rows already loaded.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { isApiError, shortDate } from '@splat-connect/types'
import type { AdminAccountsResponse } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { confirmDestructive } from '../../lib/confirm'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'
import { ListIntro, ListRow } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, adminError, useAdminLoad } from './use-admin-load'

// Rendering a thousand rows at once is what the phone cannot afford.
const PAGE = 50

export function AccountsScreen() {
  const { data, setData, loading, error, forbidden, retry } = useAdminLoad<AdminAccountsResponse>('/api/admin/contributors')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [failure, setFailure] = useState<string | null>(null)

  if (forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }

  function remove(id: string, name: string) {
    confirmDestructive(`Delete ${name}?`, 'This deletes their account and cannot be undone.', 'Delete', async () => {
      setFailure(null)
      try {
        await apiClient.delete(`/api/admin/contributors/${id}`)
        setData((d) => (d ? { accounts: d.accounts.filter((a) => a.id !== id), total: d.total - 1 } : d))
      } catch (err) {
        setFailure(isApiError(err) && err.status === 409 ? 'Make someone else a leader first.' : adminError(err))
      }
    })
  }

  const q = query.trim().toLowerCase()
  const matches = (data?.accounts ?? []).filter((a) => !q || `${a.name} ${a.email}`.toLowerCase().includes(q))
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <ListIntro lead="Every member account, newest first." />
        {loading ? (
          <LoadingRows />
        ) : error || !data ? (
          <LoadFailed onRetry={retry} />
        ) : (
          <>
            <TextField
              icon="search"
              placeholder="Search by name or email"
              accessibilityLabel="Search accounts"
              value={query}
              onChangeText={(t) => {
                setQuery(t)
                setShown(PAGE)
              }}
              autoCapitalize="none"
              search
            />
            {data.total > data.accounts.length ? <Text style={styles.cap}>{`Showing first ${data.accounts.length} of ${data.total}. Search covers these only.`}</Text> : null}
            <ErrorRow message={failure} />
            {matches.length === 0 ? (
              <EmptyState icon="people-outline" title={q ? 'No one matches that.' : 'No accounts yet.'} hint={q ? 'Try a different name or email.' : 'Members show up here when they sign up.'} />
            ) : (
              matches.slice(0, shown).map((a) => (
                <View key={a.id} style={styles.item}>
                  <ListRow
                    title={a.name || a.email}
                    meta={`${a.email} · Joined ${shortDate(a.created_at)}`}
                    trailing={<Button label="Delete" variant="danger" accessibilityLabel={`Delete ${a.name || a.email}`} onPress={() => remove(a.id, a.name || a.email)} />}
                  />
                </View>
              ))
            )}
            {matches.length > shown ? <Button label="Show more" variant="secondary" onPress={() => setShown((n) => n + PAGE)} style={styles.more} /> : null}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  item: { marginBottom: theme.spacing(3) },
  cap: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginVertical: theme.spacing(2) },
  more: { alignSelf: 'center', paddingHorizontal: theme.spacing(8), marginTop: theme.spacing(2) },
})
