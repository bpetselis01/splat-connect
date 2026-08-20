import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'For contributors — SPLAT Connect',
  description: 'Adapt a toy, write it up, and get an organisation behind it.',
}

export default function ContributorsPage() {
  return (
    <div className="max-w-3xl">
      <EditorialImage illustration="maker" ratio="2/1" />
      <h1 className="mt-6 title-article">For contributors</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        A guide you write once gets built many times, by families who would never have
        worked it out alone. That is the whole leverage of this platform.
      </p>

      <StepList
        steps={[
          {
            title: 'Create an account',
            body: 'Free, and takes a minute. You will be asked to accept the contributor terms, which cover licensing and the standard your work is held to.',
          },
          {
            title: 'Adapt a toy',
            body: 'Pick something with a removable AA, AAA, C or D cell and a single momentary action. Check the Guides library first — if it is already covered, pick something else, or improve the existing guide as a collaborator.',
          },
          {
            title: 'Write it up as you go',
            body: 'Photograph each step while your hands are dirty, not afterwards from memory. A guide needs a parts list with buy links, the steps in order, and any trap you hit. If you printed something, attach the STL.',
          },
          {
            title: 'Ask an organisation to back it',
            body: 'Before submitting, you can ask an organisation — a therapy service, a school, a disability service — to review it. Their name on your guide tells a parent that someone competent read it. Browse the directory to find one.',
          },
          {
            title: 'Submit for review',
            body: 'A SPLAT admin checks it, mostly for safety and completeness. Expect questions. Once approved it is public, credited to you, and it appears on your contributor profile.',
          },
          {
            title: 'Keep going',
            body: 'Offer a toy you have adapted through the Toy Library, collaborate on someone else’s guide, or volunteer your 3D printer when print requests open.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/signup" className="btn btn-primary">
          Create an account
        </Link>
        <Link href="/get-involved/submit-a-tutorial" className="btn btn-soft">
          What writing a guide involves
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        Not sure you have the skills? You almost certainly do —{' '}
        <Link href="/learn" className="font-semibold text-brand-dark hover:underline">
          Learn
        </Link>{' '}
        covers everything from which switch to use to how to solder a joint that lasts.
      </p>
    </div>
  )
}
