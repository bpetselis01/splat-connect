// packages/mobile/components/admin/ideas-review-screen.tsx
// The design-challenge queue: GET /api/admin/ideas, every idea in any status,
// newest first. Mobile's half of web's app/admin/ideas/page.tsx. Pending is the
// default stage because it is the only one still waiting on an admin.
import { useState } from 'react'
import { View, ScrollView, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { shortDate } from '@splat-connect/types'
import type { ToyIdea, ToyIdeaStatus } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { EmptyState } from '../ui/EmptyState'
import { ListIntro, ListRow, Pill, RowThumb, StageFilter } from '../list/list-kit'
import { AdminsOnly, LoadFailed, LoadingRows, useAdminLoad } from './use-admin-load'

export type QueuedIdea = ToyIdea & { profiles: { name: string } | null }

export const IDEA_PILL: Record<ToyIdeaStatus, { label: string; bg: string; icon: React.ComponentProps<typeof Pill>['icon'] }> = {
  pending: { label: 'Pending', bg: theme.colors.honeySoft, icon: 'time-outline' },
  challenge: { label: 'Published', bg: theme.colors.successSoft, icon: 'megaphone-outline' },
  graduated: { label: 'Being written up', bg: theme.colors.accentLight, icon: 'create-outline' },
  rejected: { label: 'Rejected', bg: theme.colors.apricotSoft, icon: 'close-circle-outline' },
}

const STAGES: ToyIdeaStatus[] = ['pending', 'challenge', 'graduated', 'rejected']

export function IdeasReviewScreen() {
  const router = useRouter()
  const { data, loading, error, forbidden, retry } = useAdminLoad<QueuedIdea[]>('/api/admin/ideas')
  const [stage, setStage] = useState<ToyIdeaStatus>('pending')

  if (forbidden) {
    return (
      <Screen>
        <AdminsOnly />
      </Screen>
    )
  }

  const all = data ?? []
  const rows = all.filter((i) => i.status === stage)
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead="Ideas members have submitted. Publish one as a challenge, or say why not." />
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <LoadFailed onRetry={retry} />
        ) : (
          <>
            <StageFilter
              label="Idea status"
              current={stage}
              onPick={(id) => setStage(id as ToyIdeaStatus)}
              options={STAGES.map((s) => ({ id: s, label: IDEA_PILL[s].label, n: all.filter((i) => i.status === s).length })) as never}
            />
            {rows.length === 0 ? (
              <EmptyState
                icon="bulb-outline"
                title={stage === 'pending' ? 'No ideas waiting.' : 'Nothing here.'}
                hint="Ideas members submit show up here."
              />
            ) : (
              rows.map((i) => (
                <View key={i.id} style={styles.item}>
                  <ListRow
                    thumb={<RowThumb photo={i.photo_url} glyph="bulb-outline" tint={theme.colors.violetSoft} />}
                    title={i.title}
                    meta={`${i.profiles?.name ?? 'Someone'} · ${shortDate(i.created_at)}`}
                    pill={<Pill {...IDEA_PILL[i.status]} />}
                    onPress={() => router.push(`/admin/ideas/${i.id}`)}
                    accessibilityHint="Opens the idea."
                  />
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  item: { marginBottom: theme.spacing(3) },
})
