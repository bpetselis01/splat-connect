// packages/mobile/components/my-tutorials/sections/stl-section.tsx
//
// Only ever reached by an assistive-tech guide — sectionsFor omits the row
// entirely for a toy adaptation, because a printed part is what an
// assistive-tech tutorial IS and a toy adaptation has no use for one.
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import type { StlFile } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { uploadFile } from '../../../lib/upload'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../auth-screen'
import { SaveChip } from './save-chip'

export function StlSection() {
  const { tutorial, saveState, saveError } = useDraft()
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
      const next = [
        ...files.map((f) => ({ filename: f.filename, file_url: f.file_url })),
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
      <SaveChip state={saveState} />
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
      <ErrorRow message={localError ?? saveError} />
    </Screen>
  )
}

const styles = StyleSheet.create({
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
  empty: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    marginBottom: theme.spacing(4),
  },
})
