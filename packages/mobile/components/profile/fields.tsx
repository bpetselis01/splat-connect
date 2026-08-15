// Selectable pills use the shared ui/Chip, not a local copy — a hand-rolled
// pill here is how the profile screens drifted from the library filter's styling.
import { View, Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'

type Option = { label: string; value: string }

export function Dropdown({ label, value, options, onChange }: {
  label: string
  value: string | null
  options: Option[]
  onChange: (v: string) => void
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  )
}

export function ChipGroup({ label, values, options, max, onChange }: {
  label: string
  values: string[]
  options: Option[]
  max?: number
  onChange: (v: string[]) => void
}) {
  function toggle(v: string) {
    if (values.includes(v)) {
      onChange(values.filter((x) => x !== v))
      return
    }
    if (max != null && values.length >= max) return // enforce the cap
    onChange([...values, v])
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{max != null ? ` (max ${max})` : ''}</Text>
      <View style={styles.pillRow}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} active={values.includes(o.value)} onPress={() => toggle(o.value)} />
        ))}
      </View>
    </View>
  )
}

export function NumberField({ label, value, unit, guidance, onChange }: {
  label: string
  value: number | null
  unit?: string
  guidance?: string
  onChange: (v: number | null) => void
}) {
  function handle(text: string) {
    if (text.trim() === '') {
      onChange(null)
      return
    }
    const n = Number(text)
    if (Number.isNaN(n)) return // ignore non-numeric keystrokes
    onChange(n)
  }
  return (
    <TextField
      label={`${label}${unit ? ` (${unit})` : ''}`}
      hint={guidance}
      // The placeholder stays the bare label: the test suite locates these
      // inputs by placeholder, and the unit belongs in the visible label.
      placeholder={label}
      keyboardType="numeric"
      defaultValue={value != null ? String(value) : ''}
      onChangeText={handle}
    />
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: theme.spacing(5) },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
