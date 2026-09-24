// packages/mobile/app/(my)/toys/new.tsx
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { apiClient } from '../../../lib/api-client'
import { useCapabilities } from '../../../lib/capabilities'
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
  // Inventory's "Add to inventory" arrives with ?org=<id>, so stock lands on
  // the organisation rather than the leader. Otherwise "mine" stays the
  // default, as on web's new-toy-form.tsx.
  const { org } = useLocalSearchParams<{ org?: string }>()
  const ledOrgs = useCapabilities().caps?.ledOrgs ?? []
  const [picked, setPicked] = useState<string | null>(null)
  const orgId = picked ?? (ledOrgs.some((o) => o.id === org) ? org! : '')
  const [quantity, setQuantity] = useState('1')
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
      const data = await apiClient.post<{ id: string }>('/api/toys', {
        name,
        condition,
        ...(orgId ? { owner_org_id: orgId, quantity: Number(quantity) } : {}),
      })
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

      {/* Only a leader ever sees this: with one possible owner there is no question to ask. */}
      {ledOrgs.length > 0 ? (
        <>
          <Text style={styles.label}>Who holds this toy</Text>
          <View accessibilityRole="radiogroup" style={[styles.chipRow, styles.gap]}>
            {[{ id: '', name: 'Me' }, ...ledOrgs].map((o) => (
              <Chip key={o.id} role="radio" label={o.name} active={orgId === o.id} onPress={() => setPicked(o.id)} />
            ))}
          </View>
        </>
      ) : null}

      {/* Stock only means something for an organisation; the API rejects it on a person's toy. */}
      {orgId ? (
        <TextField
          label="How many do you hold"
          accessibilityLabel="How many do you hold"
          keyboardType="number-pad"
          value={quantity}
          onChangeText={(t) => setQuantity(t.replace(/\D/g, ''))}
        />
      ) : null}

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
      <Button label="Create" variant="accent" onPress={handleCreate} disabled={!name.trim() || (Boolean(orgId) && !(Number(quantity) >= 1))} loading={submitting} />
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
  gap: { marginBottom: theme.spacing(4) },
  conditionEnds: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing(4) },
  conditionCaption: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
