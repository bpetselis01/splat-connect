import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { StepList } from '@/components/step-list'

export const metadata = {
  title: 'For organisations — SPLAT Connect',
  description: 'Back contributors, hold toys for local families, host a build day.',
}

export default function OrganisationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="organisation" ratio="2/1" />
      <h1 className="mt-6 title-article">For organisations</h1>
      <p className="mt-3 max-w-prose text-base leading-relaxed text-muted">
        Therapy services, schools, disability organisations and community groups. What
        you bring is the thing a volunteer platform cannot generate on its own:
        professional judgement, and a physical place families can get to.
      </p>

      <StepList
        steps={[
          {
            title: 'Get in touch',
            body: 'Organisations are set up by the SPLAT team rather than self-registered, so that a name on a guide means something. Tell us who you are and what you would like to do.',
          },
          {
            title: 'Back contributors’ work',
            body: 'Contributors can ask your organisation to review a guide before it is published. One of your leaders reads it and stands behind it, and your name appears on it. This is the strongest signal of quality the library has.',
          },
          {
            title: 'Hold toys for local families',
            body: 'If you hold stock — five identical sensory toys, say — you can list them from your organisation with a fixed pickup address, rather than a staff member using a personal account and their home address.',
          },
          {
            title: 'Run a build day',
            body: 'A group of staff, students or volunteers can build a batch of switches and adapted toys in an afternoon, and the output goes to families you already work with.',
          },
          {
            title: 'Be findable',
            body: 'Your organisation gets a public profile listing what you have backed and what you hold, so a parent reading a badge on a guide can see who is behind it.',
          },
        ]}
      />

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/contact" className="btn btn-primary">
          Get in touch
        </Link>
        <Link href="/organizations" className="btn btn-soft">
          See who is already involved
        </Link>
      </div>
    </div>
  )
}
