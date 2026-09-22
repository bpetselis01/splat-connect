import Link from 'next/link'
import { getCapabilities } from '@/lib/capabilities'
import { InvolvedIntro, NumberedSteps, TrackCta } from '@/components/involved-page'

export const metadata = {
  title: 'For organisations — SPLAT Connect',
  description: 'Hold adapted toys for local families, and be the 3D printing hub parents nearby can send parts to.',
}

const REQUEST = '/get-involved/organisations/request'

export default async function OrganisationsPage() {
  const signed = !!(await getCapabilities())
  return (
    <div className="max-w-[860px]">
      <InvolvedIntro
        title="For organisations"
        lead="Hold a shelf of adapted toys for local families, and be the 3D printing hub parents nearby can send parts to. One dashboard for both, with nothing to invoice."
      />
      <NumberedSteps
        steps={[
          ['Request to bring your organisation in', 'Sign in, tell us who you are and what you hold or print, and how we can check you actually work there. An administrator verifies it and appoints your first leader — leadership is never self-started.'],
          ['Hold a shelf of toys', 'List the adapted toys your service holds, with quantities. Local families request them through the platform, you agree a pickup, and a handover code closes each one off.'],
          ['Be the local print hub', 'List your printer once and parents nearby can send you the parts a guide needs. Requests arrive in one queue with the file, quantity and who it is for; you accept, print and mark ready for pickup. Switch mounts are a twenty-minute print, and you set the hours you take jobs.'],
          ['Manage it from one place', 'Toy requests and print jobs share the same dashboard and the same five words: Needs you, Live, Waiting, Hidden, Declined. Appoint a couple of staff as leaders so it never sits on one person.'],
          ['Optionally, back guides', 'If a contributor asks, a leader can read a guide and put your name behind it. Useful, but not required to run a shelf or a printer.'],
        ]}
      />
      <TrackCta
        title={signed ? 'Request to bring your organisation in' : 'Sign in to request your organisation'}
        body={
          signed
            ? 'Tell us who you are, what you hold or print, and how we can verify you work there. An administrator reviews every request.'
            : 'You will need an account first — it is how we know who to verify and where to send the decision.'
        }
      >
        <Link
          href={signed ? REQUEST : `/login?next=${encodeURIComponent(REQUEST)}`}
          className="btn btn-primary px-[26px]"
        >
          {signed ? 'Start the request' : 'Sign in to continue'}
        </Link>
      </TrackCta>
    </div>
  )
}
