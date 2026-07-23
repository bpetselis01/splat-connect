// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'
import { ScreenHeader } from '../ui/ScreenHeader'
import { Chip } from '../ui/Chip'
import { Card } from '../ui/Card'
import { StaggeredList } from '../ui/StaggeredList'

const FILTERS: { label: string; value: Difficulty | null }[] = [
  { label: 'All', value: null },
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]

export function LibraryScreen() {
  const router = useRouter()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    const path = difficulty ? `/api/public/tutorials?difficulty=${difficulty}` : '/api/public/tutorials'
    apiClient
      .get<Tutorial[]>(path)
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch(() => {
        if (!ignore) setError("Couldn't load tutorials. Pull to retry.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [difficulty])

  const visible = tutorials.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <View style={styles.container}>
      <ScreenHeader title="Tutorial Library" showLogo />
      <TextInput
        style={styles.search}
        placeholder="Search tutorials"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip key={f.label} label={f.label} active={difficulty === f.value} onPress={() => setDifficulty(f.value)} />
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <StaggeredList
          data={visible}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push({ pathname: '/home/[id]', params: { id: item.id } })}>
              <Card style={styles.card}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <DifficultyBadge difficulty={item.difficulty} />
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing(4) },
  search: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.sm,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing(2),
  },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: 16 },
  error: { color: theme.colors.text, padding: theme.spacing(4) },
})
