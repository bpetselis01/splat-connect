/**
 * The Learn section hub.
 *
 * Learn holds *articles* — general knowledge about switch adaptation. The Guides
 * catalogue at /library holds instructions for one specific toy. Keep the two
 * words apart in all copy.
 */
import Link from 'next/link'
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'

export const metadata = {
  title: 'Learn — SPLAT Connect',
  description:
    'How switch adaptation works: battery interrupters, switch types, tools, safety and 3D printing.',
}

const START_HERE = ['/learn/toy-adaptation-101', '/learn/switch-types', '/learn/choosing-a-toy']

export default function LearnPage() {
  const learn = PUBLIC_NAV.find((s) => s.href === '/learn')!
  const startHere = learn.children.filter((c) => START_HERE.includes(c.href))
  const deeper = learn.children.filter((c) => !START_HERE.includes(c.href))

  return (
    <div>
      <h1 className="title-hub">Learn</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Adapting a toy is a small piece of electronics and a lot of judgement. These
        articles cover the judgement — what a switch does, which toys take to it, and
        how to hand the result over safely. For instructions on one particular toy,
        head to the <Link href="/library" className="font-semibold text-brand-dark hover:underline">Guides</Link>.
      </p>

      <h2 className="mt-10 text-lg font-bold text-ink">Start here</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Read these three in order and you will know enough to adapt your first toy.
      </p>
      <HubGrid items={startHere} tone={learn.tone} />

      <h2 className="mt-10 text-lg font-bold text-ink">Going deeper</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        Reference material for when you are past the first one.
      </p>
      <HubGrid items={deeper} tone={learn.tone} leadFirst={false} />
    </div>
  )
}
