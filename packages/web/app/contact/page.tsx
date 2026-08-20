import Link from 'next/link'
import { ORG_FACTS } from '@/lib/org-facts'

export const metadata = { title: 'Contact — SPLAT Connect' }

export default function ContactPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="title-article">Contact</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        Email reaches a person. There is no ticketing system and no chatbot.
      </p>

      <p className="mt-6">
        <a href={`mailto:${ORG_FACTS.contactEmail}`} className="btn btn-primary">
          {ORG_FACTS.contactEmail}
        </a>
      </p>

      <div className="mt-10 flex flex-col gap-5">
        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">A safety problem with a guide</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Tell us immediately and we will take the guide down while we check it. Include
            the guide title and what you found. We would much rather pull a guide than
            leave a hazard published. See the{' '}
            <Link href="/safety" className="font-semibold text-brand-dark hover:underline">
              safety page
            </Link>
            .
          </p>
        </div>

        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">Bringing an organisation on board</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Organisations are set up by us rather than self-registered, so a name on a
            guide means something. Tell us who you are and what you would like to do —{' '}
            <Link
              href="/get-involved/organisations"
              className="font-semibold text-brand-dark hover:underline"
            >
              what that involves
            </Link>
            .
          </p>
        </div>

        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">Your account or your data</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            To request a copy of everything held against your account, or to have it
            deleted, email us from the address on the account. What we hold is set out in
            the{' '}
            <Link href="/privacy" className="font-semibold text-brand-dark hover:underline">
              privacy policy
            </Link>
            .
          </p>
        </div>

        <div className="card-flat p-5">
          <h2 className="font-bold text-ink">Reporting someone&apos;s behaviour</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Reports go to the SPLAT team, not to the person being reported, and we tell
            you what we decided. See the{' '}
            <Link href="/code-of-conduct" className="font-semibold text-brand-dark hover:underline">
              code of conduct
            </Link>
            .
          </p>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted">
        {ORG_FACTS.legalName} · {ORG_FACTS.basedIn}
      </p>
    </div>
  )
}
