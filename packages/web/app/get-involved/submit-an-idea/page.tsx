import Link from 'next/link'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'Submit an idea — SPLAT Connect',
  description: 'Suggest a toy worth adapting, even if you cannot build it yourself.',
}

export default function SubmitAnIdea() {
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

      <div className="mt-10">
        <Link href="/contact" className="btn btn-primary">
          Send us the idea
        </Link>
      </div>

      <p className="mt-6 text-sm text-muted">
        A form for this is coming. For now email reaches a person faster, which is why
        this page sends you there rather than to something automated. Ideas that no one
        has cracked yet will eventually be listed publicly on{' '}
        <Link href="/get-involved/design-challenges" className="font-semibold text-brand-dark hover:underline">
          design challenges
        </Link>
        .
      </p>
    </div>
  )
}
