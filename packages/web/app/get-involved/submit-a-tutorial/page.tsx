import Link from 'next/link'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'Submit a guide — SPLAT Connect',
  description: 'What writing up an adaptation involves, start to finish.',
}

export default function SubmitATutorial() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">Submit a guide</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Here is exactly what is involved, so you can decide before you start rather than
        halfway through.
      </p>

      <StepList
        steps={[
          {
            title: 'What a guide has to contain',
            body: 'A title naming the actual toy, a difficulty, a parts list with links to buy each item, the steps in order with a photograph each, and any design files if something is printed or cut.',
          },
          {
            title: 'Photograph as you go',
            body: 'This is the part people regret skipping. Take a photograph at every step while the toy is open, even the boring ones. Reconstructing them later never works.',
          },
          {
            title: 'Write for someone who has never done this',
            body: 'Name the tool. Say which wire. Mention the screw that is hidden under the label. If you hit a trap, write the trap down — that is the most valuable sentence in any guide.',
          },
          {
            title: 'Optionally, get an organisation behind it',
            body: 'You can ask an organisation to review the guide before it goes for approval. Their name appears on it, which is what tells a parent someone competent read it.',
          },
          {
            title: 'Submit, and expect questions',
            body: 'A SPLAT admin reviews for safety and completeness. Most guides come back with a question or two. Once approved it is public and credited to you.',
          },
          {
            title: 'You can work on it with other people',
            body: 'Guides support collaborators, so you can invite someone to co-write or to check your electronics before it goes out.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/upload" className="btn btn-primary">
          Start a guide
        </Link>
        <Link href="/signup" className="btn btn-soft">
          Create an account first
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        You will need an account and to have accepted the{' '}
        <Link href="/legal/contributor-terms" className="font-semibold text-brand-dark hover:underline">
          contributor terms
        </Link>
        . Signing in takes you straight to the guide editor.
      </p>
    </div>
  )
}
