// packages/mobile/components/my-tutorials/sections/stl-section.tsx
//
// Only ever reached by an assistive-tech guide — sectionsFor omits the row
// entirely for a toy adaptation, because a printed part is what an
// assistive-tech tutorial IS and a toy adaptation has no use for one.
import { logFailure } from '../../../lib/log'
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import { apiMessage } from '@splat-connect/types'
import type { StlFile } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { uploadFile } from '../../../lib/upload'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/TextField'
import { ErrorRow } from '../../ui/ErrorRow'
import { SectionFooter } from '../section-footer'
import { PickerNote } from './picker-note'
import { DraftGate } from './draft-gate'

// The editor mounts once the draft has arrived (see DraftGate).
export function StlSection() {
  return <DraftGate>{() => <StlEditor />}</DraftGate>
}

function StlEditor() {
  const { tutorial, save, saveError } = useDraft()
  const [uploading, setUploading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [files, setFiles] = useState<StlFile[]>(() => tutorial?.stl_files ?? [])
  const [sizes, setSizes] = useState<Record<string, { x: string; y: string; z: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  if (!tutorial) return null

  const id = tutorial.id

  const sizeOf = (f: StlFile) =>
    sizes[f.id] ?? { x: String(f.size_x_mm ?? ''), y: String(f.size_y_mm ?? ''), z: String(f.size_z_mm ?? '') }
  const mm = (v: string) => (v.trim() === '' ? null : Number(v))

  // One PATCH per file with every setting it has: the route writes what it is
  // sent, and the replace-set POST is refused once a job names the file.
  async function saveSizes(f: StlFile) {
    const s = sizeOf(f)
    setLocalError(null)
    if ([s.x, s.y, s.z].some((v) => Number.isNaN(mm(v)))) {
      setLocalError('Sizes must be numbers, in millimetres.')
      return
    }
    setSavingId(f.id)
    try {
      const updated = await apiClient.patch<StlFile>(`/api/tutorials/${id}/stl-files/${f.id}`, {
        size_x_mm: mm(s.x),
        size_y_mm: mm(s.y),
        size_z_mm: mm(s.z),
      })
      setFiles((cur) => cur.map((x) => (x.id === f.id ? { ...x, ...updated } : x)))
    } catch (err) {
      setLocalError(apiMessage(err, 'Could not save the sizes. Please try again.'))
    } finally {
      setSavingId(null)
    }
  }

  async function pickStl() {
    setLocalError(null)
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*' })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      if (!asset.name.toLowerCase().endsWith('.stl')) {
        setLocalError('Please choose a .stl file.')
        return
      }
      setUploading(true)
      const { url, filename } = await uploadFile('/api/upload/stl', id, {
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
      })
      // /api/upload/stl only writes the storage object — it does not insert a
      // stl_files row. Web's AddStlForm (components/add-stl-form.tsx) covers
      // that gap by POSTing the replace-set sub-resource with the existing rows
      // plus the new one; this mirrors that exactly rather than any server-side
      // insert, which does not exist for this route.
      // The settings ride along (068): the replace-set would otherwise wipe
      // what the author typed on the web editor.
      const next = [
        ...files.map((f) => ({
          filename: f.filename,
          file_url: f.file_url,
          print_minutes: f.print_minutes,
          filament_grams: f.filament_grams,
          material: f.material,
          size_x_mm: f.size_x_mm,
          size_y_mm: f.size_y_mm,
          size_z_mm: f.size_z_mm,
        })),
        { filename: filename ?? asset.name, file_url: url },
      ]
      const inserted = await apiClient.post<StlFile[]>(`/api/tutorials/${id}/stl-files`, {
        stl_files: next,
      })
      setFiles(inserted)
    } catch (err) {
      logFailure('[StlSection] stl upload failed:', err)
      setLocalError('Could not upload the STL file. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Screen>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {files.length ? (
          files.map((f) => (
            <View key={f.id} style={styles.fileBlock}>
              <View style={styles.row}>
                <Ionicons name="cube-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.filename}>{f.filename}</Text>
              </View>
              <View style={styles.sizes}>
                {(
                  [
                    ['x', 'Width (mm)'],
                    ['y', 'Depth (mm)'],
                    ['z', 'Height (mm)'],
                  ] as const
                ).map(([axis, label]) => (
                  <View key={axis} style={styles.size}>
                    <TextField
                      label={label}
                      accessibilityLabel={`${label} for ${f.filename}`}
                      inputMode="numeric"
                      value={sizeOf(f)[axis]}
                      onChangeText={(v) => setSizes((cur) => ({ ...cur, [f.id]: { ...sizeOf(f), [axis]: v } }))}
                    />
                  </View>
                ))}
              </View>
              <Button
                label="Save sizes"
                variant="secondary"
                loading={savingId === f.id}
                onPress={() => void saveSizes(f)}
              />
            </View>
          ))
        ) : (
          <Text style={styles.empty}>No 3D-print files yet.</Text>
        )}
        <Button
          label="Choose STL from Files"
          variant="secondary"
          onPress={pickStl}
          loading={uploading}
        />
        <PickerNote noun="STL" />
        <Text style={styles.label}>Print settings</Text>
        {([
          ['layer_height_mm', 'Layer height (mm)', 'decimal-pad'],
          ['infill_percent', 'Infill (%)', 'number-pad'],
          ['print_minutes', 'Print time (minutes)', 'number-pad'],
        ] as const).map(([field, label, keyboardType]) => (
          // defaultValue, not value: a controlled number field would eat the "." in "0.2".
          <TextField
            key={field}
            label={label}
            accessibilityLabel={label}
            keyboardType={keyboardType}
            defaultValue={tutorial[field] == null ? '' : String(tutorial[field])}
            onChangeText={(text) => {
              // Half-typed or pasted text ("." or "1,5") is not a number: keep
              // what was saved rather than send NaN, which the wire turns into null.
              const n = text.trim() === '' ? null : Number(text)
              if (n === null || !Number.isNaN(n)) save({ [field]: n })
            }}
          />
        ))}
        <TextField
          label="Material"
          accessibilityLabel="Material"
          placeholder="PETG"
          maxLength={40}
          defaultValue={tutorial.material ?? ''}
          onChangeText={(text) => save({ material: text.trim() ? text : null })}
        />
        <ErrorRow message={localError ?? saveError} />
      </ScrollView>
      <SectionFooter section="stl" />
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1 },
  fileBlock: { marginBottom: theme.spacing(4), gap: theme.spacing(2) },
  sizes: { flexDirection: 'row', gap: theme.spacing(2) },
  size: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
  },
  filename: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
  },
  label: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.label,
    color: theme.colors.text,
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
  },
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(4),
  },
})
