import Link from 'next/link'
import { StepList } from '@/components/step-list'
import { IdeaForm } from '@/components/idea-form'
import { getUserRole } from '@/lib/auth'

export const metadata = {
  title: 'Submit an idea — SPLAT Connect',
  description: 'Suggest a toy worth adapting, even if you cannot build it yourself.',
}

/**
 * REPLACE BEFORE LAUNCH. This is a draft of what SPLAT will and will not
 * take on as a design challenge — a safety judgement the project owner has
 * not signed off yet. Keep it in sync with whatever they actually decide;
 * do not treat it as final, and do not add exclusions of your own invention.
 */
const SCOPE_EXCLUSIONS = [
  "Nothing load-bearing — it must never need to hold a child's weight or safety.",
  'Battery-powered only — nothing wired into the mains.',
  'Nothing that could be swallowed.',
  'Nothing medical.',
  "Nothing beyond what a volunteer can build with their own tools.",
]

export default async function SubmitAnIdea() {
  const role = await getUserRole()

  return (
    <div className="max-w-3xl">
      <h1 className="title-article">Submit an idea</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        You do not have to be able to build something to be the person who thought of it.
        Parents and therapists spot the need long before a maker does.
      </p>

      <StepList
        steps={[
          {
            title: 'Tell us the toy, and what needs to change',
            body: 'Which toy, what your child cannot do with it as it stands, and what you wish it did. A photograph helps more than a paragraph.',
          },
          {
            title: 'We check whether it already exists',
            body: 'Often it does, under a name you would not have searched for. If so, we send you the guide and you are done.',
          },
          {
            title: 'If it does not, it goes to the makers',
            body: 'We put it in front of contributors looking for something to work on. Simple adaptations get picked up quickly; awkward ones become design challenges.',
          },
          {
            title: 'It becomes a guide',
            body: 'Whoever solves it writes it up, and it joins the library for everyone else. You get credited as the person who raised it, if you want to be.',
          },
        ]}
      />

      <div className="card mt-10 p-6">
        <h2 className="text-lg font-bold text-ink">What we can&apos;t take on</h2>
        <p className="mt-1 text-sm text-muted">
          This list is still being confirmed, so treat it as a guide rather than the final
          word. If you are unsure whether an idea fits, submit it anyway and we will tell you.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {SCOPE_EXCLUSIONS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {role ? (
        <IdeaForm />
      ) : (
        <div className="mt-6">
          <Link href="/login?next=/get-involved/submit-an-idea" className="btn btn-primary">
            Sign in to submit an idea
          </Link>
        </div>
      )}
    </div>
  )
}
