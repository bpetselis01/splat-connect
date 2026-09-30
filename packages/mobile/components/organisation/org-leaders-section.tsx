// packages/mobile/components/organisation/org-leaders-section.tsx
//
// Who leads the organisation, adding a co-leader by the email their SPLAT
// account uses, and stepping down. The API refuses the last leader stepping
// down, so the button only shows once someone else leads too. This is where
// the account-deletion blocker ("you're the only leader") sends people.
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../lib/api-client'
import { apiMessage } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { ListSection } from '../list/list-kit'

export type OrgLeader = { user_id: string; name: string; email: string; you: boolean }

export function OrgLeadersSection({ orgId, onSteppedDown }: { orgId: string; onSteppedDown?: () => void }) {
  const [leaders, setLeaders] = useState<OrgLeader[]>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiClient.get<OrgLeader[]>(`/api/organizations/${orgId}/leaders`).then(setLeaders).catch(() => setLeaders([]))
  }, [orgId])
  useEffect(load, [load])

  async function add() {
    setNote(null)
    setBusy(true)
    try {
      await apiClient.post(`/api/organizations/${orgId}/leaders`, { email })
      setEmail('')
      setNote({ ok: true, text: 'Added. They lead the organisation now.' })
      load()
    } catch (e) {
      setNote({ ok: false, text: apiMessage(e, 'Could not add them. Try again.') })
    } finally {
      setBusy(false)
    }
  }

  async function stepDown() {
    setNote(null)
    try {
      await apiClient.delete(`/api/organizations/${orgId}/leaders/me`)
      onSteppedDown?.()
    } catch (e) {
      setNote({ ok: false, text: apiMessage(e, 'Could not step down. Try again.') })
    }
  }

  return (
    <View style={styles.wrap}>
      <ListSection style={styles.group}>Leaders</ListSection>
      {leaders.map((l) => (
        <View key={l.user_id} style={styles.row}>
          <Text style={styles.name}>{l.name || l.email}{l.you ? ' (you)' : ''}</Text>
          <Text style={styles.meta}>{l.email}</Text>
        </View>
      ))}
      <TextField
        testID="leader-email"
        label="Add a leader"
        accessibilityLabel="Add a leader"
        hint="The email their SPLAT account uses."
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {note ? <Text style={[styles.note, { color: note.ok ? theme.colors.successDeep : theme.colors.danger }]}>{note.text}</Text> : null}
      <Button label="Add leader" variant="secondary" onPress={() => void add()} loading={busy} disabled={!email.trim()} />
      {leaders.length > 1 ? <Button label="Step down as leader" variant="danger" onPress={() => void stepDown()} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing(2) },
  group: { marginTop: theme.spacing(3), marginBottom: 0 },
  row: { paddingVertical: theme.spacing(1.5) },
  name: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  note: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption },
})
