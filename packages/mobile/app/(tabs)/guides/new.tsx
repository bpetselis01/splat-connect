// packages/mobile/app/(tabs)/guides/new.tsx
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import type { Difficulty, TutorialKind } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { useAuth } from '../../../lib/auth-context'
import { theme } from '../../../lib/theme'
import { Screen } from '../../../components/ui/Screen'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { TextField } from '../../../components/ui/TextField'
import { Chip } from '../../../components/ui/Chip'
import { Button } from '../../../components/ui/Button'
import { TermsCheckbox, ErrorRow } from '../../../components/auth-screen'

const KIND_OPTIONS: { label: string; value: TutorialKind }[] = [
  { label: KIND_LABEL.toy_adaptation, value: 'toy_adaptation' },
  { label: KIND_LABEL.assistive_tech, value: 'assistive_tech' },
]

const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

export default function NewGuideRoute() {
  const router = useRouter()
  const { acceptContributorTerms } = useAuth()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TutorialKind>('toy_adaptation')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [needsTerms, setNeedsTerms] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Minted once on first submit and reused on the terms-gate retry — a second
  // randomUUID() there would leave the first draft orphaned since the API
  // only replays a create for the SAME id as a 200.
  const [draftId, setDraftId] = useState<string | null>(null)

  async function createDraft(id: string) {
    await apiClient.post('/api/tutorials', { id, title, difficulty, kind })
    router.replace(`/tutorials/${id}`)
  }

  async function handleCreate() {
    setError(null)
    setSubmitting(true)
    const id = draftId ?? randomUUID()
    setDraftId(id)
    try {
      await createDraft(id)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/403/.test(message)) {
        setNeedsTerms(true)
      } else {
        setError('Could not create this guide. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAcceptAndContinue() {
    setError(null)
    setSubmitting(true)
    const res = await acceptContributorTerms()
    if (res.error) {
      setError(res.error)
      setSubmitting(false)
      return
    }
    setNeedsTerms(false)
    try {
      await createDraft(draftId as string)
    } catch {
      setError('Could not create this guide. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Add a guide" subtitle="Give it a title to start a draft — everything else comes next." />

      <TextField label="Title" placeholder="Title" value={title} onChangeText={setTitle} />

      <Text style={styles.label}>Kind</Text>
      <View style={styles.chipRow}>
        {KIND_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} active={kind === o.value} onPress={() => setKind(o.value)} />
        ))}
      </View>

      <Text style={styles.label}>Difficulty</Text>
      <View style={styles.chipRow}>
        {DIFFICULTY_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={difficulty === o.value}
            onPress={() => setDifficulty(o.value)}
          />
        ))}
      </View>

      {needsTerms ? (
        <View style={styles.termsGate}>
          <Text style={styles.termsCopy}>
            You must accept the contributor terms before contributing.
          </Text>
          <TermsCheckbox
            testID="new-guide-accept-terms"
            checked={accepted}
            onPress={() => setAccepted((v) => !v)}
          />
          <ErrorRow message={error} />
          <Button
            label="Accept and continue"
            onPress={handleAcceptAndContinue}
            disabled={!accepted}
            loading={submitting}
          />
        </View>
      ) : (
        <>
          <ErrorRow message={error} />
          <Button
            label="Create draft"
            variant="accent"
            onPress={handleCreate}
            disabled={!title.trim()}
            loading={submitting}
          />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  chipRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  termsGate: { marginTop: theme.spacing(2) },
  termsCopy: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
})
