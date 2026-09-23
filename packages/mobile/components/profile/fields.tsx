// The child profile's two kinds of question, shared by the one-page form
// (child-editor-home.tsx) and the onboarding wizard (child-wizard.tsx).
// Selectable pills use the shared ui/Chip, not a local copy — a hand-rolled
// pill here is how the profile screens drifted from the library filter's styling.
import { View, Text, StyleSheet } from 'react-native'
import { EVERYDAY_NEEDS, type EverydayNeed } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'

/** One single-choice question. Pressing the chosen chip again clears it. */
export function ChoiceChips({ label, options, value, onChange }: {
  /** Omit when the screen's heading already asks the question. */
  label?: string
  options: readonly { value: string; label: string }[]
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.pillRow}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            active={o.value === value}
            onPress={() => onChange(o.value === value ? null : o.value)}
          />
        ))}
      </View>
    </View>
  )
}

/** The everyday needs, any number of them. */
export function NeedsChips({ value, onChange }: { value: EverydayNeed[]; onChange: (v: EverydayNeed[]) => void }) {
  return (
    <View style={[styles.field, styles.pillRow]}>
      {EVERYDAY_NEEDS.map((o) => {
        const on = value.includes(o.value)
        return (
          <Chip
            key={o.value}
            label={o.label}
            active={on}
            onPress={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
          />
        )
      })}
    </View>
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
