/**
 * Partners and supporters.
 *
 * The delivery partners section is live and always has been — it is the
 * organisations directory, read from the same route the public list uses, so an
 * organisation that registers appears here without anybody editing a page.
 *
 * The funders and in-kind sections are EMPTY, and say so. The artboard draws
 * them with placeholder rows ("Funder name", "What the grant paid for, e.g. …")
 * because SPLAT has none yet, and three invented logos on an About page is the
 * one kind of lie a small volunteer project cannot afford. An honest empty
 * state also says what would go there, which is what a prospective funder
 * reading this page actually wants to know.
 *
 * Was a ComingSoon with a notify form. Half of it was never coming — it was
 * already here.
 */
import Link from 'next/link'
import { Buildings, HandCoins, Wrench } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { ORG_FACTS } from '@/lib/org-facts'

export const metadata = {
  title: 'Partners and supporters — SPLAT Connect',
  description:
    'The organisations that hand finished toys to families, and the funders and in-kind partners behind them.',
}

type Org = { id: string; name: string; suburb?: string | null; state?: string | null }

export default async function PartnersPage() {
  const orgs = await apiClient
    .get<Org[]>('/api/public/organizations')
    .catch(() => [] as Org[])

  return (
    <div>
      <p className="eyebrow text-muted">About</p>
      <h1 className="mt-1.5 title-hub">Partners and supporters</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
        SPLAT is a small volunteer team. Almost everything on this site reaches a family through
        one of the organisations below.
      </p>

      <section className="mt-10">
        <h2 className="title-detail flex items-center gap-2">
          <Buildings className="h-5 w-5 text-brand-dark" aria-hidden="true" />
          Delivery partners
        </h2>
        <p className="mb-4 mt-1 max-w-prose text-sm leading-relaxed text-muted">
          The therapy centres, schools and community groups that run build days and hand finished
          toys to families. These are live:{' '}
          <Link
            href="/get-involved/organisations/request"
            className="font-semibold text-brand-dark hover:underline"
          >
            register your organisation
          </Link>{' '}
          and it appears here.
        </p>

        {orgs.length === 0 ? (
          <p className="card p-6 text-sm text-muted">
            No organisations yet. They are set up by SPLAT rather than self-registered, so a name
            on a guide means something.
          </p>
        ) : (
          <ul className="grid list-none gap-3 sm:grid-cols-2">
            {orgs.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/organizations/${o.id}/public`}
                  className="card card-link flex items-center gap-3 p-4"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card bg-brand-tint font-display text-sm font-extrabold text-brand-deep"
                  >
                    {o.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-ink">{o.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[o.suburb, o.state].filter(Boolean).join(' ') || 'Australia'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <section>
          <h2 className="title-detail flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-brand-dark" aria-hidden="true" />
            Funders and grants
          </h2>
          <p className="card mt-3 p-5 text-sm leading-relaxed text-muted">
            None yet. When there are, every grant will be listed here with what it actually paid
            for — hosting, the guide review programme, printed packs for build days — rather than
            a logo and a thank-you.
          </p>
        </section>

        <section>
          <h2 className="title-detail flex items-center gap-2">
            <Wrench className="h-5 w-5 text-brand-dark" aria-hidden="true" />
            In-kind and technical
          </h2>
          <p className="card mt-3 p-5 text-sm leading-relaxed text-muted">
            None yet. Printer time, parts at cost, a venue for build days, or professional work
            given free would go here, with what it covers and for how long.
          </p>
        </section>
      </div>

      <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted">
        If you are a foundation, council or business that wants to fund a specific piece of work,{' '}
        <Link href="/about/support" className="font-semibold text-brand-dark hover:underline">
          Support SPLAT
        </Link>{' '}
        says how that can work, or email{' '}
        <a
          href={`mailto:${ORG_FACTS.contactEmail}`}
          className="font-semibold text-brand-dark hover:underline"
        >
          {ORG_FACTS.contactEmail}
        </a>
        .
      </p>
    </div>
  )
}
