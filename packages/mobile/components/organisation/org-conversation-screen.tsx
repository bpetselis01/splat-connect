// packages/mobile/components/organisation/org-conversation-screen.tsx
/**
 * A conversation between one person and an organisation (077), from either
 * side. Opened two ways: by the organisation (`orgId`, the Message button on
 * its profile — the caller's own conversation, or an empty composer before the
 * first message), or by the conversation's id (`cid`, a notification or the
 * leaders' list).
 *
 * On the family's side a leader's message is signed "Rachel · Northbank": the
 * family wrote to the organisation and should see that it answered. On a
 * leader's side colleagues keep their own names.
 */
import { useCallback, useRef, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { OrgThread } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { MessageBubble } from '../ui/MessageBubble'
import { ErrorRow } from '../auth-screen'
import { apiMessage } from '@splat-connect/types'

export function OrgConversationScreen(props: { orgId: string; orgName?: string } | { cid: string }) {
  const { caps } = useCapabilities()
  const [thread, setThread] = useState<OrgThread | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logRef = useRef<ScrollView>(null)

  const readPath =
    'cid' in props ? `/api/organizations/conversations/${props.cid}` : `/api/organizations/${props.orgId}/conversations/mine`
  // Until the first message exists the 'mine' route creates the conversation.
  const sendPath = thread
    ? `/api/organizations/conversations/${thread.conversation.id}/messages`
    : `/api/organizations/${'orgId' in props ? props.orgId : ''}/conversations/mine/messages`

  const load = useCallback(async () => {
    try {
      setThread(await apiClient.get<OrgThread | null>(readPath))
      setFailed(false)
    } catch (err) {
      console.error('[OrgConversationScreen] load failed:', err)
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [readPath])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  async function send() {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(sendPath, { body })
      setDraft('')
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Could not send that message. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (failed) {
    return (
      <Screen>
        <EmptyState icon="chatbubbles-outline" title="Couldn't load this conversation." hint="It may not be yours to read, or you are offline." />
      </Screen>
    )
  }

  const viewerId = caps?.profile.id ?? ''
  const side = !thread || thread.conversation.profile_id === viewerId ? 'family' : 'org'
  const orgName = thread?.org_name ?? ('orgName' in props && props.orgName ? props.orgName : 'the organisation')
  const other = side === 'family' ? orgName : (thread?.person_name ?? 'this family')

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <ScrollView
          ref={logRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          onContentSizeChange={() => logRef.current?.scrollToEnd({ animated: false })}
        >
          <Card variant="feature" style={styles.head}>
            <Text style={styles.title}>{side === 'family' ? orgName : `${other}, writing to ${orgName}`}</Text>
            <Text style={styles.meta}>
              {side === 'family'
                ? 'This goes to the organisation: every leader there reads it, and any of them can answer.'
                : 'Every leader of your organisation sees this conversation.'}
            </Text>
          </Card>
          <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
            {(thread?.messages ?? []).map((m) => (
              <MessageBubble
                key={m.id}
                message={{ id: m.id, sender_id: m.sender_id, kind: 'user', body: m.body, created_at: m.created_at }}
                mine={m.sender_id === viewerId}
                senderName={side === 'family' && m.from_org ? `${m.sender_name} · ${orgName}` : m.sender_name}
              />
            ))}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <ErrorRow message={error} />
          <View style={styles.composer}>
            <View style={styles.flex}>
              <TextField
                accessibilityLabel={`Message ${other}`}
                placeholder={`Message ${other}…`}
                value={draft}
                onChangeText={setDraft}
                maxLength={2000}
                multiline
                style={styles.input}
              />
            </View>
            <Button label="Send" disabled={busy || !draft.trim()} onPress={() => void send()} style={styles.send} />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: theme.spacing(4) },
  head: { gap: theme.spacing(1), marginBottom: theme.spacing(3) },
  title: { fontFamily: theme.fonts.black, fontSize: theme.type.heading, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19 },
  log: { gap: theme.spacing(2) },
  footer: { borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, paddingTop: theme.spacing(3) },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  input: { maxHeight: 96 },
  send: { paddingHorizontal: theme.spacing(4) },
})
