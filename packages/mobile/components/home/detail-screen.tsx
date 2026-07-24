import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Image } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Part, Tool, StlFile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

type TutorialDetail = Tutorial & { parts: Part[]; tools: Tool[]; stl_files: StlFile[] }

export function DetailScreen({ id }: { id: string }) {
  const router = useRouter()
  const [tutorial, setTutorial] = useState<TutorialDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    apiClient
      .get<TutorialDetail>(`/api/public/tutorials/${id}`)
      .then(setTutorial)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
  if (error) return <Text style={styles.error}>Couldn't load tutorial. Please try again.</Text>
  if (!tutorial) return <Text style={styles.error}>Tutorial not found.</Text>

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {tutorial.toy_photo_url ? (
        <Image source={{ uri: tutorial.toy_photo_url }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderEmoji}>🧸</Text>
        </View>
      )}
      <Text style={styles.title}>{tutorial.title}</Text>
      <DifficultyBadge difficulty={tutorial.difficulty} />
      {tutorial.description ? <Text style={styles.description}>{tutorial.description}</Text> : null}

      <Text style={styles.sectionHeading}>Parts</Text>
      <Card style={styles.section}>
        {tutorial.parts.length ? (
          tutorial.parts.map((item) => (
            <Text key={item.id} style={styles.listItem}>
              {item.name} × {item.quantity}
              {item.is_optional ? ' (optional)' : ''}
            </Text>
          ))
        ) : (
          <Text style={styles.listItem}>No parts listed.</Text>
        )}
      </Card>

      <Text style={styles.sectionHeading}>Tools</Text>
      <Card style={styles.section}>
        {tutorial.tools.length ? (
          tutorial.tools.map((item) => (
            <Text key={item.id} style={styles.listItem}>
              {item.name}
              {item.is_optional ? ' (optional)' : ''}
            </Text>
          ))
        ) : (
          <Text style={styles.listItem}>No tools listed.</Text>
        )}
      </Card>

      <Button
        label="Preview Tutorial"
        onPress={() =>
          router.push({
            pathname: '/home/[id]/preview',
            params: { id: tutorial.id, pdfUrl: tutorial.tutorial_pdf_url ?? '' },
          })
        }
        style={styles.previewButton}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4) },
  loader: { flex: 1, justifyContent: 'center' },
  error: { padding: theme.spacing(4), color: theme.colors.text },
  photo: { width: '100%', height: 200, borderRadius: theme.radii.md, marginBottom: theme.spacing(3) },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(3),
  },
  photoPlaceholderEmoji: { fontSize: 48 },
  title: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.text, marginBottom: theme.spacing(2) },
  description: { fontFamily: theme.fonts.regular, color: theme.colors.text, marginVertical: theme.spacing(2) },
  sectionHeading: { fontFamily: theme.fonts.semiBold, fontSize: 16, color: theme.colors.text, marginTop: theme.spacing(3) },
  section: { marginTop: theme.spacing(2) },
  listItem: { fontFamily: theme.fonts.regular, color: theme.colors.text, paddingVertical: theme.spacing(1) },
  previewButton: { marginTop: theme.spacing(4) },
})
