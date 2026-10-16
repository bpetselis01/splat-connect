// packages/mobile/components/my-tutorials/sections/backing-section.tsx
//
// Web's EditBackingSection on the phone, over the same routes. Read-only once
// the guide is approved: policy refuses every change then, and editing an
// approved guide re-queues it, so the two dangerous states never coexist.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { Organization, TutorialOrg } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { InfoHint } from '../../ui/InfoHint'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../ui/ErrorRow'
import { ListRow, Pill } from '../../list/list-kit'

const STATUS = {
  pending: { label: 'Deciding', bg: theme.colors.honeySoft },
  accepted: { label: 'Backing', bg: theme.colors.mintSoft },
  declined: { label: 'Declined', bg: theme.colors.apricotSoft },
} as const

export function BackingSection() {
  const { tutorial } = useDraft()
  const [backing, setBacking] = useState<TutorialOrg[] | null>(null)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [busy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = tutorial?.id

  const load = useCallback(() => {
    if (!id) return
    setLoadFailed(false)
    Promise.all([
      apiClient.get<TutorialOrg[]>(`/api/tutorials/${id}/orgs`),
      apiClient.get<Organization[]>('/api/organizations'),
    ])
      .then(([b, o]) => {
        setBacking(b)
        setOrgs(o)
      })
      .catch(() => setLoadFailed(true))
  }, [id])
  useEffect(load, [load])

  // A failed load must not read as "nobody is backing this": that would offer
  // Ask buttons over a list we could not see.
  if (loadFailed) {
    return (
      <Screen>
        <ErrorRow message="Could not load backing. Check your connection and try again." />
        <Button label="Try again" variant="secondary" onPress={load} />
      </Screen>
    )
  }
  if (!tutorial || !backing) return <Screen />

  const readOnly = tutorial.status === 'approved'
  const asked = new Set(backing.map((b) => b.org_id))
  const available = orgs.filter((o) => !asked.has(o.id) && o.status === 'active')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      load()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        {backing.length === 0 ? (
          <Text style={styles.lead}>
            No organisation is backing this project yet. SPLAT will review it — asking an organisation is optional.
          </Text>
        ) : (
          backing.map((b) => {
            const name = b.organizations?.name ?? 'An organisation'
            return (
              <View key={b.id} style={styles.row}>
                <ListRow title={name} meta="" pill={<Pill label={STATUS[b.status].label} bg={STATUS[b.status].bg} />} />
                {readOnly && tutorial.reviewed_for_org_id === b.org_id ? (
                  <Text style={styles.hint}>{name} approved this. Withdrawing means asking SPLAT to unpublish it.</Text>
                ) : null}
                {!readOnly ? (
                  <Button
                    label="Withdraw"
                    accessibilityLabel={`Withdraw from ${name}`}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => void run(() => apiClient.delete(`/api/tutorials/${tutorial.id}/orgs/${b.org_id}`))}
                  />
                ) : null}
              </View>
            )
          })
        )}

        {!readOnly ? (
          <>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Ask another organisation</Text>
              <InfoHint title="Ask another organisation">
                Their leaders can read this while they decide, including if they say no. Choose the one or two who know your work.
              </InfoHint>
            </View>
            {available.length === 0 ? (
              <Text style={styles.hint}>
                {orgs.length === 0 ? 'There are no organisations on the platform yet.' : 'You have already asked every organisation.'}
              </Text>
            ) : (
              available.map((o) => (
                <Button
                  key={o.id}
                  label={o.name}
                  accessibilityLabel={`Ask ${o.name}`}
                  variant="secondary"
                  disabled={busy}
                  style={styles.ask}
                  onPress={() => void run(() => apiClient.post(`/api/tutorials/${tutorial.id}/orgs`, { org_id: o.id }))}
                />
              ))
            )}
          </>
        ) : null}
        <ErrorRow message={error} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20, marginBottom: theme.spacing(3) },
  row: { marginBottom: theme.spacing(3) },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginTop: theme.spacing(4) },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18, marginVertical: theme.spacing(1) },
  ask: { marginTop: theme.spacing(2) },
})
