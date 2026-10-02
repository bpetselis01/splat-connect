// packages/mobile/components/organisation/org-leaders-section.tsx
//
// Who leads the organisation, inviting a co-leader by the email their SPLAT
// account uses (they accept on their Account screen), and stepping down. The API refuses the last leader stepping
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
type Invite = { id: string; name: string; email: string }

export function OrgLeadersSection({ orgId, onSteppedDown }: { orgId: string; onSteppedDown?: () => void }) {
  const [leaders, setLeaders] = useState<OrgLeader[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    apiClient
      .get<{ leaders: OrgLeader[]; invites: Invite[] }>(`/api/organizations/${orgId}/leaders`)
      .then((r) => {
        setLeaders(r.leaders)
        setInvites(r.invites)
      })
      .catch(() => setLeaders([]))
  }, [orgId])
  useEffect(load, [load])

  async function add() {
    setNote(null)
    setBusy(true)
    try {
      await apiClient.post(`/api/organizations/${orgId}/leaders`, { email })
      setEmail('')
      setNote({ ok: true, text: 'Invited. They become a leader once they accept on their Account screen.' })
      load()
    } catch (e) {
      setNote({ ok: false, text: apiMessage(e, 'Could not add them. Try again.') })
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: string) {
    await apiClient.delete(`/api/organizations/${orgId}/leaders/invites/${id}`).catch(() => {})
    load()
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
      {invites.map((i) => (
        <View key={i.id} style={styles.row}>
          <Text style={styles.name}>{i.name || i.email} · invited</Text>
          <Button label="Cancel invitation" variant="ghost" onPress={() => void cancel(i.id)} />
        </View>
      ))}
      <TextField
        testID="leader-email"
        label="Invite a leader"
        accessibilityLabel="Invite a leader"
        hint="The email their SPLAT account uses."
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {note ? <Text style={[styles.note, { color: note.ok ? theme.colors.successDeep : theme.colors.danger }]}>{note.text}</Text> : null}
      <Button label="Send invitation" variant="secondary" onPress={() => void add()} loading={busy} disabled={!email.trim()} />
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
