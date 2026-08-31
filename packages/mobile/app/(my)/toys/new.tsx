// packages/mobile/app/(my)/toys/new.tsx
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { apiClient } from '../../../lib/api-client'
import { theme } from '../../../lib/theme'
import { Screen } from '../../../components/ui/Screen'
import { ScreenHeader } from '../../../components/ui/ScreenHeader'
import { TextField } from '../../../components/ui/TextField'
import { Chip } from '../../../components/ui/Chip'
import { Button } from '../../../components/ui/Button'
import { ErrorRow } from '../../../components/auth-screen'

// The mockup drew a slider for condition; chips avoid pulling in a slider
// dependency for one field, at the cost of a wider row than a track would
// take. Same 1–10 scale, same default as web's new-toy-form.tsx.
const CONDITIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function NewToyRoute() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [condition, setCondition] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate() {
    setError(null)
    setSubmitting(true)
    try {
      // POST /api/toys carries no terms gate — unlike tutorials, a toy has no
      // contributor agreement to accept before it can be created.
      const data = await apiClient.post<{ id: string }>('/api/toys', { name, condition })
      router.replace(`/toys/${data.id}`)
    } catch {
      setError('Could not create this toy. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Add a toy" subtitle="Give it a name and a condition — everything else comes next." />

      <TextField label="Name" placeholder="Name" value={name} onChangeText={setName} />

      <Text style={styles.label}>Condition</Text>
      <View accessibilityRole="radiogroup" style={styles.chipRow}>
        {CONDITIONS.map((c) => (
          <Chip
            key={c}
            role="radio"
            label={String(c)}
            active={condition === c}
            onPress={() => setCondition(c)}
          />
        ))}
      </View>
      <View style={styles.conditionEnds}>
        <Text style={styles.conditionCaption}>needs repair</Text>
        <Text style={styles.conditionCaption}>like new</Text>
      </View>

      <ErrorRow message={error} />
      <Button label="Create" variant="accent" onPress={handleCreate} disabled={!name.trim()} loading={submitting} />
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(1) },
  conditionEnds: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing(4) },
  conditionCaption: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
