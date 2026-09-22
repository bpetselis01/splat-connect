import Link from 'next/link'
import { getCapabilities } from '@/lib/capabilities'
import { InvolvedIntro, NumberedSteps, TrackCta } from '@/components/involved-page'

export const metadata = {
  title: 'For contributors — SPLAT Connect',
  description: 'Adapt a toy, write it up, and get an organisation behind it.',
}

export default async function ContributorsPage() {
  const signed = !!(await getCapabilities())
  return (
    <div className="max-w-[860px]">
      <InvolvedIntro
        title="For contributors"
        lead="Adapt a toy, write it up, and get an organisation behind it. One guide helps every family who owns that toy."
      />
      <NumberedSteps
        steps={[
          ['Adapt something, photographing as you go', 'This is the part people get wrong: nobody can reconstruct the photos afterwards. One photo per action, toy the right way up.'],
          ['Create an account and accept the contributor terms', 'One screen. It covers who owns your work (you do) and what you may not claim.'],
          ['Write the guide in the editor', 'Steps, parts, tools, safety notes and files, each its own section. Save as often as you like; nothing is public until you submit.'],
          ['Ask an organisation to back it', 'Optional but worth it. A parent trusts a guide more when a therapy service has read it. Pick one when you submit.'],
          ['Answer the review', 'A reviewer will name anything missing. Fix it, resubmit, and it goes public.'],
        ]}
      />
      <TrackCta
        title={signed ? 'Write your first guide' : 'Create an account to start writing'}
        body="The editor holds a draft indefinitely. Start with the toy on your bench right now."
      >
        <Link href={signed ? '/upload' : '/signup'} className="btn btn-primary px-[26px]">
          {signed ? 'Start a guide' : 'Create an account'}
        </Link>
      </TrackCta>
    </div>
  )
}
