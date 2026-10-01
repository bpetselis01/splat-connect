// packages/mobile/components/my-tutorials/sections/stl-section.tsx
//
// Only ever reached by an assistive-tech guide — sectionsFor omits the row
// entirely for a toy adaptation, because a printed part is what an
// assistive-tech tutorial IS and a toy adaptation has no use for one.
import { useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
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

  if (!tutorial) return null

  const id = tutorial.id

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
        })),
        { filename: filename ?? asset.name, file_url: url },
      ]
      const inserted = await apiClient.post<StlFile[]>(`/api/tutorials/${id}/stl-files`, {
        stl_files: next,
      })
      setFiles(inserted)
    } catch (err) {
      console.error('[StlSection] stl upload failed:', err)
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
            <View key={f.id} style={styles.row}>
              <Ionicons name="cube-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.filename}>{f.filename}</Text>
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
            onChangeText={(text) => save({ [field]: text.trim() === '' ? null : Number(text) })}
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
