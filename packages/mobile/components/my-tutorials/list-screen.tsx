// packages/mobile/components/my-tutorials/list-screen.tsx
import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, Image } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tutorial } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { AnimatedPressable } from '../ui/AnimatedPressable'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

function TutorialRow({ item, onPress }: { item: Tutorial; onPress: () => void }) {
  return (
    <View style={styles.rowWrap}>
      <AnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        accessibilityHint={`${item.difficulty} difficulty. ${KIND_LABEL[item.kind]}. Status ${item.status}. Opens the editor.`}
        pressScale={0.985}
      >
        <Card style={styles.card}>
          {item.toy_photo_url ? (
            <Image source={{ uri: item.toy_photo_url }} style={styles.thumbnail} />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="color-wand-outline" size={18} color={theme.colors.primary} />
            </View>
          )}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.metaLine}>
              {KIND_LABEL[item.kind]} · {item.difficulty}
            </Text>
          </View>
          <Badge status={item.status} />
        </Card>
      </AnimatedPressable>
      {/* Rejected rows show why right under the row — a contributor should
          not have to open the editor to learn what needs fixing. */}
      {item.status === 'rejected' && item.rejection_note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>{item.rejection_note}</Text>
        </View>
      ) : null}
    </View>
  )
}

export function MyTutorialsListScreen() {
  const router = useRouter()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Bumping this re-runs the fetch — the retry button's handle, same as
  // library-screen's reloadKey.
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError(null)
    apiClient
      .get<Tutorial[]>('/api/tutorials/mine')
      .then((data) => {
        if (!ignore) setTutorials(data)
      })
      .catch((err) => {
        console.error('[MyTutorialsListScreen] tutorial fetch failed:', err)
        if (!ignore) setError("Couldn't load your tutorials.")
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  return (
    <Screen>
      {/*
        No ScreenHeader here — the native stack header already carries "My
        tutorials" (app/(my)/_layout.tsx) and is also the only way back to
        the My SPLAT hub. Repeating the title in-screen would just be a
        second "My tutorials" stacked over the first.
      */}
      <View style={styles.headerRow}>
        <Text style={styles.subtitle}>
          Guides you wrote or collaborate on, and where each one is in review.
        </Text>
        <Button
          label="+ Add a guide"
          variant="accent"
          onPress={() => router.push('/guides/new')}
          style={styles.addGuide}
        />
      </View>

      {loading ? (
        <View>
          <SkeletonRow />
          <SkeletonRow />
        </View>
      ) : error ? (
        <EmptyState icon="cloud-offline-outline" title="Couldn't load your tutorials." hint="Check your connection and try again.">
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => setReloadKey((k) => k + 1)}
            style={styles.retry}
          />
        </EmptyState>
      ) : tutorials.length === 0 ? (
        <EmptyState
          icon="color-wand-outline"
          title="No guides yet"
          hint="Start your first one — a title is all it takes to begin a draft."
        >
          <Button
            label="+ Add a guide"
            variant="accent"
            onPress={() => router.push('/guides/new')}
            style={styles.retry}
          />
        </EmptyState>
      ) : (
        <FlatList
          data={tutorials}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TutorialRow
              item={item}
              onPress={() => router.push({ pathname: '/tutorials/[id]', params: { id: item.id } })}
            />
          )}
          ListFooterComponent={
            <Text style={styles.footnote}>Collaborators and recommendations are edited on the web for now.</Text>
          }
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  subtitle: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: theme.type.label,
    color: theme.colors.muted,
    lineHeight: 20,
  },
  addGuide: { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(3) },
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  rowWrap: { marginBottom: theme.spacing(3) },
  card: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(3) },
  thumbnail: { width: 44, height: 44, borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceSunken },
  thumbnailPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: theme.spacing(1) },
  cardTitle: { fontFamily: theme.fonts.bold, color: theme.colors.text, fontSize: theme.type.label },
  metaLine: { fontFamily: theme.fonts.regular, color: theme.colors.muted, fontSize: theme.type.caption },
  noteBox: {
    marginTop: theme.spacing(2),
    borderWidth: theme.border.thin,
    borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.apricotSoft,
    padding: theme.spacing(3),
  },
  noteText: { fontFamily: theme.fonts.regular, color: theme.colors.apricotDeep, fontSize: theme.type.caption, lineHeight: 18 },
  footnote: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: theme.type.caption,
    textAlign: 'center',
    marginTop: theme.spacing(4),
  },
})
