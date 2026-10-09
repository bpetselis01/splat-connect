// packages/mobile/components/my-tutorials/sections/collaborators-section.tsx
//
// Web's team panel on the phone: who is on the guide, the owner inviting by
// email, and remove (owner) or leave (member). Every change goes through the
// API and then reloads the draft, which carries the team.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { apiMessage } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { useCapabilities } from '../../../lib/capabilities'
import { logFailure } from '../../../lib/log'
import { teamRows, TEAM_WORD, type TeamState } from '../../../lib/team-state'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/TextField'
import { ErrorRow } from '../../ui/ErrorRow'
import { Pill } from '../../list/list-kit'
import { SectionFooter } from '../section-footer'
import { DraftGate } from './draft-gate'

const TONE: Record<TeamState, string> = {
  primary: theme.colors.tone.mint.bg,
  collaborator: theme.colors.tone.mint.bg,
  pending: theme.colors.tone.honey.bg,
  declined: theme.colors.tone.apricot.bg,
}

export function CollaboratorsSection() {
  return <DraftGate>{() => <CollaboratorsEditor />}</DraftGate>
}

function CollaboratorsEditor() {
  const { tutorial, reload } = useDraft()
  const { caps } = useCapabilities()
  const router = useRouter()
  const viewerId = caps?.profile.id ?? null
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!tutorial) return null

  const rows = teamRows(tutorial.tutorial_contributors, tutorial.tutorial_collaborator_invites ?? [])
  const isOwner = rows.some((r) => r.state === 'primary' && r.profileId === viewerId)

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key)
    setError(null)
    try {
      await fn()
      // After leaving, the draft is no longer readable (RLS 404s the refetch),
      // so a reload would keep showing the old team. Leave the editor instead.
      if (key === viewerId) router.replace('/tutorials')
      else reload()
    } catch (err) {
      logFailure('[CollaboratorsSection]', err)
      setError(apiMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text style={styles.lead}>Who can edit this guide with you.</Text>
        {rows.map((r) => {
          const mine = r.profileId === viewerId
          const canRemove = r.isContributor && r.state === 'collaborator' && (isOwner || mine)
          return (
            <View key={r.profileId} style={styles.row}>
              <Pill label={TEAM_WORD[r.state]} bg={TONE[r.state]} />
              <Text style={styles.name}>{r.name}</Text>
              {canRemove ? (
                <Button
                  label={mine ? 'Leave' : 'Remove'}
                  accessibilityLabel={mine ? 'Leave' : `Remove ${r.name}`}
                  variant="ghost"
                  disabled={busy !== null}
                  onPress={() => void run(r.profileId, () => apiClient.delete(`/api/tutorials/${tutorial.id}/collaborators/${r.profileId}`))}
                />
              ) : null}
            </View>
          )
        })}

        {isOwner ? (
          <>
            <Text style={styles.heading}>Invite a collaborator</Text>
            <TextField
              label="Their email"
              accessibilityLabel="Their email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              label="Invite"
              variant="secondary"
              disabled={busy !== null || !email.trim()}
              onPress={() =>
                void run('invite', async () => {
                  await apiClient.post(`/api/tutorials/${tutorial.id}/collaborators/invite`, { email: email.trim() })
                  setEmail('')
                })
              }
            />
          </>
        ) : null}
        <ErrorRow message={error} />
      </ScrollView>
      <SectionFooter section="collaborators" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20, marginBottom: theme.spacing(3) },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(2) },
  name: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  heading: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink, marginTop: theme.spacing(4), marginBottom: theme.spacing(2) },
})
