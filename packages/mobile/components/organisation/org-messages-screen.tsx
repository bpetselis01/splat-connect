// packages/mobile/components/organisation/org-messages-screen.tsx
/**
 * The organisation's inbox (077): every family that has written, latest first,
 * across every organisation this leader leads. Shared by all the leaders — a
 * family writes to the organisation — so nothing here is "assigned".
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { OrgConversationSummary } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { AnimatedPressable } from '../ui/AnimatedPressable'

type Row = OrgConversationSummary & { org_name: string }

export function OrgMessagesScreen() {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [rows, setRows] = useState<Row[] | null>(null)
  const orgs = caps?.ledOrgs ?? []

  useFocusEffect(
    useCallback(() => {
      if (!caps) return
      let ignore = false
      Promise.all(
        caps.ledOrgs.map((org) =>
          apiClient
            .get<OrgConversationSummary[]>(`/api/organizations/${org.id}/conversations`)
            .then((list) => list.map((r) => ({ ...r, org_name: org.name })))
            .catch(() => [] as Row[])
        )
      ).then((lists) => {
        if (!ignore) setRows(lists.flat().sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)))
      })
      return () => {
        ignore = true
      }
    }, [caps])
  )

  if (!rows) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>
          Families writing to {orgs.length === 1 ? orgs[0].name : 'your organisations'}. Every leader sees these, and
          any of you can answer.
        </Text>
        {rows.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="Nobody has written yet."
            hint="The Message button on your organisation's page starts a conversation here."
          />
        ) : (
          rows.map((r) => (
            <AnimatedPressable
              key={r.id}
              onPress={() => router.push({ pathname: '/messages/[cid]', params: { cid: r.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${r.person_name}${orgs.length > 1 ? `, to ${r.org_name}` : ''}`}
            >
              <Card style={styles.row}>
                <View style={styles.top}>
                  <Text style={styles.name}>{r.person_name}</Text>
                  <Text style={styles.when}>
                    {new Date(r.updated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
                {orgs.length > 1 ? <Text style={styles.meta}>To {r.org_name}</Text> : null}
                {r.last_message ? (
                  <Text style={styles.meta} numberOfLines={1}>
                    {r.last_message.sender_id === r.profile_id ? '' : 'You: '}
                    {r.last_message.body}
                  </Text>
                ) : null}
              </Card>
            </AnimatedPressable>
          ))
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(2), paddingBottom: theme.spacing(8) },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21, marginBottom: theme.spacing(2) },
  row: { padding: theme.spacing(3), gap: theme.spacing(1) },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing(2) },
  name: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text },
  when: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  meta: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
