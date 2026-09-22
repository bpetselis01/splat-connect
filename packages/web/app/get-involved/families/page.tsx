import Link from 'next/link'
import { InvolvedIntro, NumberedSteps, TrackCta } from '@/components/involved-page'

export const metadata = {
  title: 'For families — SPLAT Connect',
  description: 'Find a guide, gather the parts, adapt the toy you already own.',
}

export default function FamiliesPage() {
  return (
    <div className="max-w-[860px]">
      <InvolvedIntro
        title="For families"
        lead="Find a guide, gather the parts, adapt the toy you already own. You do not need to be technical and you do not need to buy a workshop."
      />
      <NumberedSteps
        steps={[
          ['Work out what your child can operate', 'Read switch types, or ask the occupational therapist which switch your child already uses. The right switch first saves adapting the wrong toy.'],
          ['Find a guide for a toy you own', 'Filter the library by difficulty and by what tools it needs. Anything marked Easy is an interrupter and no soldering.'],
          ['Gather the parts', 'Most Easy guides need one interrupter and one switch. The parts list on each guide tells you exactly what and where.'],
          ['Build it, following the photos', 'Every step has a photo. If a step is unclear, say so on the guide — the author gets told and it gets fixed.'],
          ['Or borrow instead', 'If building is not for you right now, the toy library has toys already adapted, given by families and organisations.'],
        ]}
      />
      <TrackCta
        title="Start with a guide"
        body="Nothing to sign up for. Filter by Easy, pick a toy you already own, and see what it takes."
      >
        <Link href="/library" className="btn btn-primary px-[26px]">
          Browse guides
        </Link>
      </TrackCta>
    </div>
  )
}
