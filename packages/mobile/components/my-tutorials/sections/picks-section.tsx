// packages/mobile/components/my-tutorials/sections/picks-section.tsx
//
// "Worth a look": up to three other guides the author points readers at. Web's
// Recommended step (edit-recommendations-section.tsx), same rules: the list
// writes straight away through the replace-all route, the picker offers only
// approved guides from the public list, and 048 caps it at three.
//
// Optional (like suits): no gap ever names it, so it never blocks submit.
import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { apiMessage, KIND_LABEL } from '@splat-connect/types'
import type { Recommendation, Tutorial } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'
import { DraftGate } from './draft-gate'

/** Mirrors 048's `position between 1 and 3`. */
const MAX_PICKS = 3

// `required` is 129's "Required first": make that guide before this one.
type PickRow = Recommendation['tutorials'] & { required: boolean }
type Candidate = Pick<Tutorial, 'id' | 'title' | 'kind'>

export function PicksSection() {
  return <DraftGate>{() => <PicksEditor />}</DraftGate>
}

function PicksEditor() {
  const { tutorial } = useDraft()
  const [picks, setPicks] = useState<PickRow[]>(() => (tutorial?.tutorial_recommendations ?? []).map((r) => ({ ...r.tutorials, required: !!r.required })))
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    apiClient
      .get<Candidate[]>('/api/public/tutorials')
      .then((data) => !ignore && setCandidates(data))
      .catch((err) => !ignore && setError(apiMessage(err, 'Could not load the guides to choose from.')))
    return () => {
      ignore = true
    }
  }, [])

  if (!tutorial) return null

  // The route replaces rather than appends, so every change sends the whole list.
  async function write(next: PickRow[]) {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/tutorials/${tutorial!.id}/recommendations`, {
        recommendations: next.map((p) => ({ recommended_id: p.id, required: p.required })),
      })
      setPicks(next)
    } catch (err) {
      setError(apiMessage(err, 'That did not work. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  const options = candidates.filter((c) => c.id !== tutorial.id && !picks.some((p) => p.id === c.id))

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        <Text style={styles.lead}>
          Up to three guides worth looking at alongside this one. Parents only see the ones that have been approved.
        </Text>

        {picks.map((p) => (
          <View key={p.id} style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.title}>{p.title}</Text>
              <Text style={styles.meta}>
                {KIND_LABEL[p.kind]}
                {p.status && p.status !== 'approved' ? ' - not yet approved, hidden from the public page' : ''}
              </Text>
            </View>
            <Chip
              label="Required first"
              active={p.required}
              onPress={() => void write(picks.map((x) => (x.id === p.id ? { ...x, required: !x.required } : x)))}
            />
            <Button
              label="Remove"
              variant="secondary"
              accessibilityLabel={`Remove ${p.title}`}
              disabled={busy}
              onPress={() => void write(picks.filter((x) => x.id !== p.id))}
            />
          </View>
        ))}

        {picks.length < MAX_PICKS && (
          <>
            <Text style={styles.label}>Add a guide</Text>
            {options.length === 0 ? (
              <Text style={styles.meta}>No other approved guides yet.</Text>
            ) : (
              options.map((c) => (
                <View key={c.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.title}>{c.title}</Text>
                    <Text style={styles.meta}>{KIND_LABEL[c.kind]}</Text>
                  </View>
                  <Button
                    label="Add"
                    accessibilityLabel={`Add ${c.title}`}
                    disabled={busy}
                    onPress={() => void write([...picks, { ...c, required: false } as PickRow])}
                  />
                </View>
              ))
            )}
          </>
        )}
        <ErrorRow message={error} />
      </ScrollView>
      <SectionFooter section="picks" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  lead: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  rowText: { flex: 1 },
  title: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
  meta: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.caption,
    color: theme.colors.muted,
  },
})
