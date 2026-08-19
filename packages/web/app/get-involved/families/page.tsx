import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'For families — SPLAT Connect',
  description: 'Find a guide, gather the parts, adapt the toy you already own.',
}

export default function FamiliesPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="family" ratio="2/1" />
      <h1 className="mt-6 title-article">For families</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        You do not need to be technical, and you do not need to buy much. Most first
        adaptations take an evening and about thirty dollars of parts.
      </p>

      <StepList
        steps={[
          {
            title: 'Find a guide for a toy your child already likes',
            body: 'Search the Guides library by toy or by difficulty. If the exact toy is not there, a guide for a similar one usually transfers — the technique is the same across most battery toys.',
          },
          {
            title: 'Read the parts list before you buy anything',
            body: 'Every guide lists exactly what it needs, with links. Most builds need a battery interrupter, a 3.5 mm mono socket, some wire and a switch. Read the whole guide once through before ordering.',
          },
          {
            title: 'Borrow what you can',
            body: 'Libraries, makerspaces and men’s sheds often lend tools or run a printer for you. Some organisations on SPLAT hold printers for exactly this. You do not need to own a 3D printer to build a printed switch.',
          },
          {
            title: 'Build it, then check it over',
            body: 'Follow the guide’s steps. Before your child touches it: shake it, check every screw, and pull firmly on the switch lead. The safety page has the full checklist.',
          },
          {
            title: 'Or skip the build entirely',
            body: 'The Toy Library lists toys other families and organisations have already adapted and are giving away. If one suits, ask for it — you only cover pickup.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/library" className="btn btn-primary">
          Browse the Guides
        </Link>
        <Link href="/toy-library" className="btn btn-soft">
          See toys being given away
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        New to all of this? Start with{' '}
        <Link href="/learn/toy-adaptation-101" className="font-semibold text-brand-dark hover:underline">
          toy adaptation 101
        </Link>{' '}
        — it explains the one trick everything else is built on.
      </p>
    </div>
  )
}
