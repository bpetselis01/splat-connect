// packages/mobile/components/my-tutorials/sections/customization-fields.tsx
//
// What a family is asked when they request a print of this guide (134): the
// contributor decides, because each assistive device needs its own
// measurements. No fields means the request screen says so.
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { fieldKey, customizationFieldsProblem, MAX_CUSTOMIZATION_FIELDS } from '@splat-connect/types'
import type { CustomizationField } from '@splat-connect/types'
import { theme } from '../../../lib/theme'
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { TextField } from '../../ui/TextField'
import { ErrorRow } from '../../ui/ErrorRow'

type Row = { label: string; kind: 'choice' | 'number'; options: string; unit: string; min: string; max: string }

const blank = (): Row => ({ label: '', kind: 'choice', options: '', unit: 'mm', min: '', max: '' })

const toRow = (f: CustomizationField): Row =>
  f.kind === 'choice'
    ? { ...blank(), label: f.label, options: f.options.join('\n') }
    : { ...blank(), label: f.label, kind: 'number', unit: f.unit, min: String(f.min), max: String(f.max) }

function toField(r: Row): CustomizationField {
  const label = r.label.trim()
  const key = fieldKey(label)
  if (r.kind === 'choice') {
    return { key, label, kind: 'choice', options: r.options.split('\n').map((o) => o.trim()).filter(Boolean) }
  }
  return { key, label, kind: 'number', unit: r.unit.trim(), min: Number(r.min), max: Number(r.max) }
}

export function CustomizationFields({
  initial,
  onSave,
}: {
  initial: CustomizationField[]
  onSave: (fields: CustomizationField[]) => Promise<void>
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow))
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const edit = (i: number, patch: Partial<Row>) => {
    setSaved(false)
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  async function save() {
    const fields = rows.map(toField)
    const bad = customizationFieldsProblem(fields)
    setProblem(bad)
    if (bad) return
    setSaving(true)
    try {
      await onSave(fields)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      <Text style={styles.title}>Customization fields</Text>
      <Text style={styles.hint}>
        What a family tells the printer when they request this guide’s parts, like “Tray thickness” with the options 10 mm and
        15 mm. Leave empty if one size fits all.
      </Text>
      {rows.map((r, i) => (
        <View key={i} style={styles.block}>
          <TextField
            label="Question"
            accessibilityLabel={`Field ${i + 1} name`}
            placeholder="e.g. Tray thickness"
            maxLength={40}
            value={r.label}
            onChangeText={(label) => edit(i, { label })}
          />
          <View style={styles.row}>
            <Chip label="Choose one" role="radio" variant="filter" active={r.kind === 'choice'} onPress={() => edit(i, { kind: 'choice' })} />
            <Chip label="A number" role="radio" variant="filter" active={r.kind === 'number'} onPress={() => edit(i, { kind: 'number' })} />
          </View>
          {r.kind === 'choice' ? (
            <TextField
              label="Options, one per line"
              accessibilityLabel={`Field ${i + 1} options`}
              placeholder={'Small\nMedium\nLarge'}
              multiline
              value={r.options}
              onChangeText={(options) => edit(i, { options })}
            />
          ) : (
            <View style={styles.row}>
              <TextField accessibilityLabel={`Field ${i + 1} unit`} placeholder="Unit" maxLength={10} value={r.unit} onChangeText={(unit) => edit(i, { unit })} boxStyle={styles.cell} />
              <TextField accessibilityLabel={`Field ${i + 1} smallest`} placeholder="Smallest" keyboardType="decimal-pad" value={r.min} onChangeText={(min) => edit(i, { min })} boxStyle={styles.cell} />
              <TextField accessibilityLabel={`Field ${i + 1} largest`} placeholder="Largest" keyboardType="decimal-pad" value={r.max} onChangeText={(max) => edit(i, { max })} boxStyle={styles.cell} />
            </View>
          )}
          <Button
            label="Remove this question"
            variant="secondary"
            onPress={() => {
              setSaved(false)
              setRows((cur) => cur.filter((_, j) => j !== i))
            }}
          />
        </View>
      ))}
      {rows.length < MAX_CUSTOMIZATION_FIELDS ? (
        <Button
          label="Add a question"
          variant="secondary"
          onPress={() => {
            setSaved(false)
            setRows((cur) => [...cur, blank()])
          }}
        />
      ) : null}
      <ErrorRow message={problem} />
      <Button label={saved ? 'Saved' : 'Save customization fields'} onPress={() => void save()} loading={saving} />
    </View>
  )
}

const styles = StyleSheet.create({
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, marginTop: theme.spacing(4), marginBottom: theme.spacing(2) },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20, marginBottom: theme.spacing(3) },
  block: { marginBottom: theme.spacing(4), gap: theme.spacing(2) },
  row: { flexDirection: 'row', gap: theme.spacing(2) },
  cell: { flex: 1 },
})
