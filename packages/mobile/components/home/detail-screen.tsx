import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial, Part, Tool, StlFile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { Button } from '../ui/Button'
import { Section } from '../ui/Section'
import { Skeleton } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

type TutorialDetail = Tutorial & { parts: Part[]; tools: Tool[]; stl_files: StlFile[] }

/**
 * One line of the parts or tools list.
 *
 * `label` is deliberately a single Text node: the suite matches the whole
 * string ("Micro switch × 2"), which splitting the quantity into its own
 * element would break.
 */
function ListRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.listRow}>
      <Ionicons name={icon} size={17} color={theme.colors.primary} />
      <Text style={styles.listItem}>{label}</Text>
    </View>
  )
}

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

  if (loading) {
    return (
      <View style={styles.loading}>
        <Skeleton width="100%" height={200} style={styles.loadingPhoto} />
        <Skeleton width="70%" height={22} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="50%" height={14} />
      </View>
    )
  }
  if (error) {
    return (
      <View style={styles.container}>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load tutorial. Please try again." />
      </View>
    )
  }
  if (!tutorial) {
    return (
      <View style={styles.container}>
        <EmptyState icon="help-circle-outline" title="Tutorial not found." />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {tutorial.toy_photo_url ? (
        <Image source={{ uri: tutorial.toy_photo_url }} style={styles.photo} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="color-wand-outline" size={48} color={theme.colors.primary} />
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={styles.title}>{tutorial.title}</Text>
        <DifficultyBadge difficulty={tutorial.difficulty} />
      </View>
      {tutorial.description ? <Text style={styles.description}>{tutorial.description}</Text> : null}

      <Section title="Parts" hint="What you'll need to buy or salvage.">
        {tutorial.parts.length ? (
          tutorial.parts.map((item) => (
            <ListRow
              key={item.id}
              icon="cube-outline"
              label={`${item.name} × ${item.quantity}${item.is_optional ? ' (optional)' : ''}`}
            />
          ))
        ) : (
          <Text style={styles.listItem}>No parts listed.</Text>
        )}
      </Section>

      <Section title="Tools" hint="What you'll need on the bench.">
        {tutorial.tools.length ? (
          tutorial.tools.map((item) => (
            <ListRow
              key={item.id}
              icon="build-outline"
              label={`${item.name}${item.is_optional ? ' (optional)' : ''}`}
            />
          ))
        ) : (
          <Text style={styles.listItem}>No tools listed.</Text>
        )}
      </Section>

      <Button
        label="Preview Tutorial"
        onPress={() =>
          router.push({
            pathname: '/home/[id]/preview',
            params: { id: tutorial.id, pdfUrl: tutorial.tutorial_pdf_url ?? '' },
          })
        }
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(4), paddingBottom: theme.spacing(10) },
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing(4),
    gap: theme.spacing(3),
  },
  loadingPhoto: { borderRadius: theme.radii.lg, marginBottom: theme.spacing(2) },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.lg,
    marginBottom: theme.spacing(4),
    backgroundColor: theme.colors.surfaceSunken,
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(4),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(3),
  },
  title: {
    flex: 1,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.title,
    color: theme.colors.text,
    lineHeight: 30,
  },
  description: {
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.body,
    color: theme.colors.muted,
    lineHeight: 23,
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(6),
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  listItem: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.text,
    paddingVertical: theme.spacing(2),
  },
})
