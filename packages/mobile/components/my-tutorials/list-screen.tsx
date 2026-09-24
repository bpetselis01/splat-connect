// packages/mobile/components/my-tutorials/list-screen.tsx
import { useCallback, useEffect, useState } from 'react'
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Tutorial } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ListIntro, ListRow, RowThumb, StageFilter, StageNone, StagePill } from '../list/list-kit'
import { stageOptions, TUTORIAL_STAGE, type StageOption } from '../list/stage'

const stageOf = (t: Tutorial) => TUTORIAL_STAGE[t.status]

function TutorialRow({ item, onPress }: { item: Tutorial; onPress: () => void }) {
  return (
    <View style={styles.rowWrap}>
      <ListRow
        title={item.title}
        meta={`${KIND_LABEL[item.kind]} · ${item.difficulty}`}
        thumb={<RowThumb photo={item.toy_photo_url} glyph="color-wand-outline" />}
        // "Draft" rather than "Hidden" for a guide, as web does: the editor
        // calls it a draft, and so does everything a contributor reads.
        pill={<StagePill stage={stageOf(item)} label={item.status === 'draft' ? 'Draft' : undefined} />}
        onPress={onPress}
        accessibilityHint={`${item.difficulty} difficulty. ${KIND_LABEL[item.kind]}. Status ${item.status}. Opens the editor.`}
      />
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
  const [refreshing, setRefreshing] = useState(false)
  const [stage, setStage] = useState<StageOption['id']>('all')

  const onRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let ignore = false
    // A pull-driven reload keeps the current rows on screen; skeletons are
    // for arriving with nothing.
    if (!refreshing) setLoading(true)
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
        if (!ignore) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      ignore = true
    }
  }, [reloadKey])

  // Refetch every time this screen regains focus — otherwise a guide created
  // or edited elsewhere (guides/new, the editor) shows stale until the user
  // backgrounds and reopens the app.
  useFocusEffect(
    useCallback(() => {
      setReloadKey((k) => k + 1)
    }, [])
  )

  return (
    <Screen>
      {/*
        No ScreenHeader here — the native stack header already carries "My
        tutorials" (app/(my)/_layout.tsx) and is also the only way back to
        the My SPLAT hub. Repeating the title in-screen would just be a
        second "My tutorials" stacked over the first.
      */}
      <ListIntro
        lead="Guides you have written, at every stage from draft to published."
        cta="+ Add a tutorial"
        onCta={() => router.push('/guides/new')}
      />

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
            label="+ Add a tutorial"
            variant="accent"
            onPress={() => router.push('/guides/new')}
            style={styles.retry}
          />
        </EmptyState>
      ) : (
        <FlatList
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.ink} />
          }
          data={stage === 'all' ? tutorials : tutorials.filter((t) => stageOf(t) === stage)}
          keyExtractor={(t) => t.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <StageFilter
              label="Filter tutorials by stage"
              options={stageOptions(tutorials, stageOf, ['needsyou', 'live', 'waiting', 'hidden'], { hidden: 'Draft' })}
              current={stage}
              onPick={setStage}
            />
          }
          ListEmptyComponent={<StageNone onClear={() => setStage('all')} />}
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
  retry: { marginTop: theme.spacing(5), alignSelf: 'center', paddingHorizontal: theme.spacing(8) },
  listContent: { paddingBottom: theme.spacing(6) },
  rowWrap: { marginBottom: theme.spacing(3) },
  noteBox: {
    marginTop: theme.spacing(2),
    borderRadius: theme.radii.field,
    backgroundColor: theme.colors.apricotSoft,
    padding: theme.spacing(3),
  },
  noteText: { fontFamily: theme.fonts.regular, color: theme.colors.ink, fontSize: theme.type.caption, lineHeight: 18 },
  footnote: {
    fontFamily: theme.fonts.regular,
    color: theme.colors.muted,
    fontSize: theme.type.caption,
    textAlign: 'center',
    marginTop: theme.spacing(4),
  },
})
