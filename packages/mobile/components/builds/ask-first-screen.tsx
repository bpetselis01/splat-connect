// packages/mobile/components/builds/ask-first-screen.tsx
/**
 * Ask first (makers-ask-first): a maker's private questions to the family
 * before claiming, laid out as the board's build thread at its "asking" stage.
 * The family sees one thread per maker who asked and picks which to answer.
 * Claiming is the same one tap as on the board, and the thread moves into the
 * build thread (POST /:id/claim copies it).
 */
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { apiMessage, type BuildQuestions } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { useBottomClearance } from '../../lib/bottom-clearance'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { MessageBubble } from '../ui/MessageBubble'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'

export function AskFirstScreen({ id }: { id: string }) {
  const bottom = useBottomClearance()
  const router = useRouter()
  const { caps } = useCapabilities()
  const viewerId = caps?.profile.id ?? null
  const [data, setData] = useState<BuildQuestions | null>(null)
  const [failed, setFailed] = useState(false)
  const [makerId, setMakerId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiClient.get<BuildQuestions>(`/api/toy-transactions/${id}/questions`))
      setFailed(false)
    } catch (err) {
      logFailure('[AskFirstScreen] questions fetch failed:', err)
      setFailed(true)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  if (!data) {
    return failed ? (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load the board." hint="Check your connection and try again." />
      </Screen>
    ) : (
      <Screen>
        <SkeletonRow />
      </Screen>
    )
  }

  const thread = data.family
    ? data.threads.find((t) => t.maker_id === (makerId ?? data.threads[0]?.maker_id))
    : data.threads[0]
  // Whoever is not the viewer: the maker to the family, "Family in …" to a maker.
  const otherName = data.family ? thread?.maker_name ?? 'A maker' : `Family in ${data.requester_suburb ?? 'your area'}`
  const canWrite = data.open && (!data.family || thread !== undefined)

  async function send() {
    const body = draft.trim()
    if (!body || !data) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/toy-transactions/${id}/questions`, data.family ? { body, maker_id: thread!.maker_id } : { body })
      setDraft('')
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Could not send that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/toy-transactions/${id}/claim`, {})
      router.replace(`/exchanges/build/${id}`)
    } catch (err) {
      setError(apiMessage(err, 'That did not go through. Try once more.'))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]} keyboardShouldPersistTaps="handled">
        <Card style={styles.stage}>
          <Text style={styles.kicker}>Asking first</Text>
          <Text style={styles.title}>Not claimed yet</Text>
          <Text style={styles.body}>Ask about the parts or the switch. Claiming is one tap when you are ready.</Text>
        </Card>
        <Text style={styles.guide}>{data.tutorial_title}</Text>

        {data.family && data.threads.length > 1 ? (
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {data.threads.map((t) => (
              <Chip
                key={t.maker_id}
                role="radio"
                label={t.maker_name}
                active={t.maker_id === thread?.maker_id}
                onPress={() => setMakerId(t.maker_id)}
              />
            ))}
          </View>
        ) : null}

        <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
          {(thread?.messages ?? []).map((m) => (
            <MessageBubble
              key={m.id}
              message={{ ...m, kind: 'user' }}
              mine={m.sender_id === viewerId}
              senderName={otherName}
            />
          ))}
        </View>

        <ErrorRow message={error} />

        {canWrite ? (
          <View style={styles.composer}>
            <View style={styles.composerField}>
              <TextField accessibilityLabel="Message" placeholder="Message" value={draft} onChangeText={setDraft} multiline maxLength={1000} />
            </View>
            <Button label="Send" disabled={busy || !draft.trim()} onPress={() => void send()} />
          </View>
        ) : null}

        {data.open && !data.family ? (
          <Button label="I'll build this" loading={busy} onPress={() => void claim()} />
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(3) },
  stage: { gap: theme.spacing(1), padding: theme.spacing(4), backgroundColor: theme.colors.mintSoft },
  kicker: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.colors.ink },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.ink },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  guide: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5) },
  log: { gap: theme.spacing(2) },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  composerField: { flex: 1 },
})
