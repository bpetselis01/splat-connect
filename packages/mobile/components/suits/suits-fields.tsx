// packages/mobile/components/suits/suits-fields.tsx
//
// "Who it suits" (127): the board's child questions, answered by whoever made
// a guide or toy so families can find it with the library filters. One form
// for both editors; none of it is required.
import { View, Text, StyleSheet } from 'react-native'
import {
  CHILD_MEASURES,
  ENJOYS,
  HANDS,
  MOVEMENTS,
  type ChildMeasureField,
  type Fit,
  type Suits,
} from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { ManyChips } from '../profile/fields'
import { TextField } from '../ui/TextField'

type Pair = { min: string; max: string }

/** The form as typed: ranges stay strings so a half-typed pair is not lost. */
export interface SuitsForm {
  movement: NonNullable<Suits['movement']>
  hands: NonNullable<Suits['hands']>
  play: NonNullable<Suits['play']>
  fit: Partial<Record<ChildMeasureField, Pair>>
}

export function suitsForm(row: Suits): SuitsForm {
  const fit: SuitsForm['fit'] = {}
  for (const m of CHILD_MEASURES) {
    const r = row.fit?.[m.field]
    if (r) fit[m.field] = { min: String(r[0]), max: String(r[1]) }
  }
  return { movement: row.movement ?? [], hands: row.hands ?? [], play: row.play ?? [], fit }
}

/**
 * The four columns to send, or the sentence that says why not. Same bounds as
 * the API's readSuits: whole numbers inside the measure's range, smallest first.
 * An emptied list is null; fit carries only the filled pairs (null for none).
 */
export function suitsPayload(form: SuitsForm): Required<Suits> | { error: string } {
  const fit: Fit = {}
  for (const m of CHILD_MEASURES) {
    const { min = '', max = '' } = form.fit[m.field] ?? {}
    if (!min.trim() && !max.trim()) continue
    const lo = Number(min)
    const hi = Number(max)
    if (!min.trim() || !max.trim()) return { error: `${m.label}: fill in both ends, or leave both empty.` }
    const ok = [lo, hi].every((n) => Number.isInteger(n) && n >= m.min && n <= m.max) && lo <= hi
    if (!ok) return { error: `${m.label}: a range from ${m.min} to ${m.max}, smallest first.` }
    fit[m.field] = [lo, hi]
  }
  return {
    movement: form.movement.length ? form.movement : null,
    hands: form.hands.length ? form.hands : null,
    play: form.play.length ? form.play : null,
    fit: Object.keys(fit).length ? fit : null,
  }
}

export function SuitsFields({ value, onChange }: { value: SuitsForm; onChange: (next: SuitsForm) => void }) {
  const setPair = (field: ChildMeasureField, end: keyof Pair, text: string) => {
    const cur = value.fit[field] ?? { min: '', max: '' }
    onChange({ ...value, fit: { ...value.fit, [field]: { ...cur, [end]: text.replace(/\D/g, '') } } })
  }
  return (
    <View>
      <Text style={styles.help}>
        None of this is required. Filling it in helps families find it with the library filters.
      </Text>
      <Text style={styles.label}>Movement</Text>
      <ManyChips options={MOVEMENTS} value={value.movement} onChange={(movement) => onChange({ ...value, movement })} />
      <Text style={styles.label}>Hands</Text>
      <ManyChips options={HANDS} value={value.hands} onChange={(hands) => onChange({ ...value, hands })} />
      <Text style={styles.label}>Play</Text>
      <ManyChips options={ENJOYS} value={value.play} onChange={(play) => onChange({ ...value, play })} />
      {CHILD_MEASURES.map((m) => (
        <View key={m.field}>
          <Text style={styles.label}>{m.label}</Text>
          <View style={styles.pairRow}>
            <View style={styles.cell}>
              <TextField
                placeholder="From"
                accessibilityLabel={`${m.label} from`}
                keyboardType="number-pad"
                maxLength={4}
                value={value.fit[m.field]?.min ?? ''}
                onChangeText={(t) => setPair(m.field, 'min', t)}
              />
            </View>
            <View style={styles.cell}>
              <TextField
                placeholder="To"
                accessibilityLabel={`${m.label} to`}
                keyboardType="number-pad"
                maxLength={4}
                value={value.fit[m.field]?.max ?? ''}
                onChangeText={(t) => setPair(m.field, 'max', t)}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  help: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
    marginBottom: theme.spacing(3),
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.ink,
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
  },
  pairRow: { flexDirection: 'row', gap: theme.spacing(2) },
  cell: { flex: 1 },
})
