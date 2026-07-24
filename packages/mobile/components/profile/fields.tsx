// packages/mobile/components/profile/fields.tsx
// Shared presentational form primitives for the child-profile data screens.
// Each is stateless: value in, onChange out — the owning screen wires them to
// useChildProfile().save.
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

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
        {options.map((o) => {
          const active = o.value === value
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              aria-selected={active}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{o.label}</Text>
            </Pressable>
          )
        })}
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
        {options.map((o) => {
          const active = values.includes(o.value)
          return (
            <Pressable
              key={o.value}
              onPress={() => toggle(o.value)}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              aria-selected={active}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{o.label}</Text>
            </Pressable>
          )
        })}
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
    <View style={styles.field}>
      <Text style={styles.label}>{label}{unit ? ` (${unit})` : ''}</Text>
      {guidance ? <Text style={styles.guidance}>{guidance}</Text> : null}
      <TextInput
        style={styles.input}
        placeholder={label}
        keyboardType="numeric"
        defaultValue={value != null ? String(value) : ''}
        onChangeText={handle}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  field: { marginBottom: theme.spacing(4) },
  label: { fontFamily: theme.fonts.semiBold, color: theme.colors.text, marginBottom: theme.spacing(2) },
  guidance: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: 13, marginBottom: theme.spacing(2) },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  pill: {
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(3),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.accentLight,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: theme.colors.primary },
  pillText: { color: theme.colors.text, fontFamily: theme.fonts.semiBold },
  pillTextActive: { color: '#ffffff' },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(3),
    fontFamily: theme.fonts.regular,
  },
})
