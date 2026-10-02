// The child profile's kinds of question — one choice, many choices, a
// measurement — shared by the one-page form (child-editor-home.tsx) and the
// onboarding wizard (child-wizard.tsx).
// Selectable pills use the shared ui/Chip, not a local copy — a hand-rolled
// pill here is how the profile screens drifted from the library filter's styling.
import { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { EVERYDAY_NEEDS, readMeasure, type ChildMeasure, type EverydayNeed } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'

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

/** Any number of a list's options — the room's needs, what a child enjoys. */
export function ManyChips<T extends string>({ options, value, onChange }: {
  options: readonly { value: T; label: string }[]
  value: T[]
  onChange: (v: T[]) => void
}) {
  return (
    <View style={[styles.field, styles.pillRow]}>
      {options.map((o) => {
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

/** The everyday needs, any number of them. */
export function NeedsChips({ value, onChange }: { value: EverydayNeed[]; onChange: (v: EverydayNeed[]) => void }) {
  return <ManyChips options={EVERYDAY_NEEDS} value={value} onChange={onChange} />
}

/**
 * One optional measurement. Keeps what the parent typed, so "400" stays on
 * screen with its range under it; `onChange` gets readMeasure's verdict — the
 * number, null for blank, undefined for not an answer — and the caller decides
 * what an out-of-range number means (the wizard: no answer; the editor: no save).
 */
export function MeasureField({ measure, value, onChange }: {
  measure: ChildMeasure
  value: number | null
  onChange: (v: number | null | undefined) => void
}) {
  const [text, setText] = useState(value != null ? String(value) : '')
  // Follow the stored value when it changes from outside (a profile that
  // loads late, another save) — but never under the parent's thumb.
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setText(value != null ? String(value) : '')
  }, [value])
  return (
    <TextField
      label={measure.label}
      placeholder={measure.placeholder}
      keyboardType="numeric"
      value={text}
      hint={readMeasure(measure, text) === undefined ? `Between ${measure.min} and ${measure.max}.` : undefined}
      onFocus={() => { editing.current = true }}
      onBlur={() => { editing.current = false }}
      onChangeText={(v) => {
        setText(v)
        onChange(readMeasure(measure, v))
      }}
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
