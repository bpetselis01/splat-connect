// packages/mobile/components/me/thanks-notes-screen.tsx
// The notes people left when they thanked you (117), to read and hide. Private
// to you, so Hide only tidies this list. Mobile's half of web's
// app/dashboard/thanks/page.tsx; the org version lives in org-profile-edit-screen.
//
// Title comes from the native header (app/(my)/_layout.tsx).
import { logFailure } from '../../lib/log'
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { apiMessage, shortDate, type PersonThanks } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'
import { EmptyState } from '../ui/EmptyState'
import { SkeletonRow } from '../ui/Skeleton'
import { ListIntro } from '../list/list-kit'

export function ThanksNotesScreen() {
  const [thanks, setThanks] = useState<PersonThanks[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useFocusEffect(
    useCallback(() => {
      let ignore = false
      setLoadFailed(false)
      apiClient
        .get<PersonThanks[]>('/api/contributors/me/thanks')
        .then((rows) => {
          if (!ignore) setThanks(rows)
        })
        .catch((err) => {
          logFailure('[ThanksNotesScreen] fetch failed:', err)
          if (!ignore) setLoadFailed(true)
        })
      return () => {
        ignore = true
      }
    }, [reloadKey]),
  )

  async function setHidden(t: PersonThanks, hidden: boolean) {
    setError(null)
    try {
      const row = await apiClient.patch<PersonThanks>(`/api/contributors/me/thanks/${t.thanker_id}`, { hidden })
      setThanks((all) => (all ?? []).map((x) => (x.thanker_id === t.thanker_id ? row : x)))
    } catch (err) {
      setError(apiMessage(err, 'That did not save. Check your connection and try again.'))
    }
  }

  if (loadFailed && !thanks) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your notes." hint="Check your connection and try again.">
          <Button label="Try again" variant="secondary" onPress={() => setReloadKey((k) => k + 1)} style={styles.retry} />
        </EmptyState>
      </Screen>
    )
  }
  if (!thanks) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  const notes = thanks.filter((t) => t.note)
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <ListIntro lead="Notes people left when they thanked you. Only you can see them." />
        <ErrorRow message={error} />
        {notes.length === 0 ? (
          <EmptyState icon="heart-outline" title="No notes yet" hint="When someone thanks you with a note, it shows up here." />
        ) : (
          notes.map((t) => {
            const hidden = !!t.hidden_at
            const who = t.byline ?? 'a family'
            return (
              <Card key={t.thanker_id} style={styles.thanks}>
                <Text style={styles.quote}>“{t.note}”</Text>
                <Text style={styles.meta}>
                  {t.byline ?? 'A family'} · {shortDate(t.created_at)}
                  {hidden ? ' · Hidden' : ''}
                </Text>
                <Button
                  label={hidden ? 'Show' : 'Hide'}
                  variant="ghost"
                  accessibilityLabel={`${hidden ? 'Show' : 'Hide'} the note from ${who}`}
                  onPress={() => void setHidden(t, !hidden)}
                />
              </Card>
            )
          })
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing(3), paddingBottom: theme.spacing(10) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  thanks: { padding: 15, gap: theme.spacing(1), borderRadius: theme.radii.panel, ...theme.shadow(1) },
  quote: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  meta: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
})
