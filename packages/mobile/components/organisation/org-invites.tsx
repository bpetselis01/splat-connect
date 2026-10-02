// packages/mobile/components/organisation/org-invites.tsx
//
// Invitations to lead an organisation, on the invitee's Account screen. 084
// makes leadership an invitation because leaders are public on the
// organisation's page; this is where the invitee says yes or no.
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type Invite = { id: string; org_id: string; org_name: string }

export function OrgInvites() {
  const { refresh } = useCapabilities()
  const [invites, setInvites] = useState<Invite[]>([])
  const load = useCallback(() => {
    apiClient.get<Invite[]>('/api/organizations/invites/mine').then(setInvites).catch(() => setInvites([]))
  }, [])
  useEffect(load, [load])

  async function answer(invite: Invite, accept: boolean) {
    try {
      if (accept) await apiClient.post(`/api/organizations/invites/${invite.id}/accept`, {})
      else await apiClient.delete(`/api/organizations/invites/${invite.id}`)
    } finally {
      load()
      if (accept) void refresh()
    }
  }

  if (!invites.length) return null
  return (
    <View style={styles.wrap}>
      {invites.map((i) => (
        <Card key={i.id} style={styles.card}>
          <Text style={styles.text}>
            <Text style={styles.strong}>{i.org_name}</Text> invited you to be one of its leaders. Leaders are shown on
            the organisation&apos;s public page.
          </Text>
          <View style={styles.actions}>
            <Button label="Accept" onPress={() => void answer(i, true)} />
            <Button label="Decline" variant="ghost" onPress={() => void answer(i, false)} />
          </View>
        </Card>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing(3), marginBottom: theme.spacing(3) },
  card: { padding: theme.spacing(4), gap: theme.spacing(3) },
  text: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.ink },
  strong: { fontFamily: theme.fonts.black },
  actions: { flexDirection: 'row', gap: theme.spacing(2) },
})
