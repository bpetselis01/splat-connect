// The board's is_soon screen for anything in the pending registry
// (packages/types/src/pending.ts) that a PendingButton links to.
import { PENDING, isPendingId } from '@splat-connect/types'
import { ComingSoon } from '@/components/coming-soon'
import { pendingIcon } from '@/lib/pending-icons'

export const metadata = { title: 'Not built yet — SPLAT Connect' }

export default async function NotBuiltPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isPendingId(id)) {
    return (
      <ComingSoon
        label="Not built yet"
        description="This part of SPLAT Connect isn't ready yet."
        steps={[]}
        alternatives={[{ label: 'Home', href: '/' }]}
      />
    )
  }
  return (
    <ComingSoon
      label={PENDING[id].title}
      description={PENDING[id].blurb}
      steps={[]}
      icon={pendingIcon(id)}
      alternatives={[{ label: 'Home', href: '/' }]}
    />
  )
}
