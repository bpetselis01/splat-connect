// packages/mobile/components/my-tutorials/sections/draft-gate.tsx
//
// A section's body mounts only once its draft has arrived: the parts, tools,
// steps and files sections copy the draft into local state when they mount,
// and opened cold (a deep link, a reload on web) they would otherwise start
// empty for good, their replace-set save deleting what was there. Loading and
// a failed load look as they do on the hub, with a way to try again.
import type { ReactNode } from 'react'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { Screen } from '../../ui/Screen'
import { SkeletonRow } from '../../ui/Skeleton'
import { EmptyState } from '../../ui/EmptyState'
import { Button } from '../../ui/Button'

export function DraftGate({ children }: { children: () => ReactNode }) {
  const { tutorial, loading, loadError, reload } = useDraft()
  if (tutorial) return <>{children()}</>
  if (loading && !loadError)
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  return (
    <Screen>
      <EmptyState icon="cloud-offline-outline" title="Couldn't load this guide." hint="Check your connection and try again.">
        <Button label="Try again" variant="secondary" onPress={reload} />
      </EmptyState>
    </Screen>
  )
}
