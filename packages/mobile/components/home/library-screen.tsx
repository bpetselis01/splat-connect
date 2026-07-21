// packages/mobile/components/home/library-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { DifficultyBadge } from '../difficulty-badge'

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
      <TextInput
        style={styles.search}
        placeholder="Search tutorials"
        value={search}
        onChangeText={setSearch}
      />
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.label}
            onPress={() => setDifficulty(f.value)}
            style={[styles.chip, difficulty === f.value && styles.chipActive]}
          >
            <Text style={[styles.chipText, difficulty === f.value && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/home/[id]', params: { id: item.id } })}
            >
              <Text style={styles.cardTitle}>{item.title}</Text>
              <DifficultyBadge difficulty={item.difficulty} />
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
    borderRadius: 8,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontFamily: theme.fonts.regular,
  },
  filterRow: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  chip: {
    paddingVertical: theme.spacing(1),
    paddingHorizontal: theme.spacing(3),
    borderRadius: 16,
    backgroundColor: theme.colors.accentLight,
  },
  chipActive: { backgroundColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontFamily: theme.fonts.semiBold },
  chipTextActive: { color: '#ffffff' },
  card: {
    backgroundColor: theme.colors.accentLighter,
    borderRadius: 12,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: 16 },
  error: { color: theme.colors.text, padding: theme.spacing(4) },
})
