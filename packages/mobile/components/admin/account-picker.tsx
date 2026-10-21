// packages/mobile/components/admin/account-picker.tsx
// Pick one account from the admin accounts list by searching its name or email.
// Only contributors can lead an organisation, so only they are offered.
import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import type { Profile } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { TextField } from '../ui/TextField'
import { ListRow } from '../list/list-kit'

const MAX = 6

export function AccountPicker({ accounts, exclude, onPick }: { accounts: Profile[]; exclude?: Set<string>; onPick: (a: Profile) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const matches = q
    ? accounts.filter((a) => a.role === 'contributor' && !exclude?.has(a.id) && `${a.name} ${a.email}`.toLowerCase().includes(q)).slice(0, MAX)
    : []
  return (
    <View>
      <TextField icon="search" placeholder="Search by name or email" accessibilityLabel="Search accounts" value={query} onChangeText={setQuery} autoCapitalize="none" search />
      {matches.map((a) => (
        <View key={a.id} style={styles.item}>
          <ListRow
            title={a.name || a.email}
            meta={a.email}
            onPress={() => {
              setQuery('')
              onPick(a)
            }}
            accessibilityLabel={`Pick ${a.name || a.email}`}
          />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({ item: { marginTop: theme.spacing(2) } })
