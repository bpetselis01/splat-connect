// packages/mobile/components/my-toys/picks-editor.tsx
/**
 * "Also worth a look" for one of your toys (102): automatic — your other
 * listed toys, newest first — or up to three you pick from your own listed
 * toys and published guides.
 */
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { PicksMode, Toy, ToyPickInput } from '@splat-connect/types'
import { apiMessage, initialPicks, MAX_PICKS, pickOptions, samePick } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'

export function PicksEditor({
  toy,
  ownToys,
  guides,
  onSaved,
}: {
  toy: Toy
  /** The holder's shelf; only their other listed toys can be picked. */
  ownToys: Toy[]
  guides: { id: string; title: string }[]
  onSaved: (toy: Toy) => void
}) {
  const [picks, setPicks] = useState<ToyPickInput[]>(() => initialPicks(toy))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode: PicksMode = toy.picks_mode ?? 'auto'

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(apiMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  const setMode = (next: PicksMode) =>
    run(
      async () => onSaved(await apiClient.patch<Toy>(`/api/toys/${toy.id}`, { picks_mode: next })),
      'Could not save that. Please try again.'
    )

  const save = () =>
    run(async () => {
      await apiClient.put(`/api/toys/${toy.id}/picks`, { picks })
      onSaved({ ...toy, toy_picks: picks.map((p, i) => ({ position: i + 1, ...p })) })
    }, 'Could not save your picks. Please try again.')

  const toggle = (p: ToyPickInput) =>
    setPicks((cur) =>
      cur.some((q) => samePick(q, p)) ? cur.filter((q) => !samePick(q, p)) : cur.length >= MAX_PICKS ? cur : [...cur, p]
    )

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Also worth a look</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        <Chip role="radio" label="Automatic" active={mode === 'auto'} onPress={() => void setMode('auto')} />
        <Chip role="radio" label="Hand-picked" active={mode === 'picked'} onPress={() => void setMode('picked')} />
      </View>
      {mode === 'picked' ? (
        <>
          <View style={styles.row}>
            {pickOptions(toy, ownToys, guides).map((o) => (
              <Chip
                key={`${o.pick.entity_type}:${o.pick.entity_id}`}
                variant="filter"
                label={o.label}
                active={picks.some((p) => samePick(p, o.pick))}
                onPress={() => toggle(o.pick)}
              />
            ))}
          </View>
          <Button label="Save picks" disabled={busy} onPress={() => void save()} />
        </>
      ) : null}
      <ErrorRow message={error} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: theme.spacing(3), marginTop: theme.spacing(5) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
