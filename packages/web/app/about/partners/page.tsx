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
import { apiClient } from '@/lib/api-client'

export const metadata = {
  title: 'Partners and supporters — SPLAT Connect',
  description:
    'The organisations that hand finished toys to families, and the funders and in-kind partners behind them.',
}

type Org = { id: string; name: string; suburb?: string | null; state?: string | null }

// The board cycles the org initials tile through these.
const TINTS = ['var(--tmint)', 'var(--b100)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)', 'var(--tok)']

const H2 = 'font-display text-[26px] font-extrabold text-ink'
const EMPTY = 'rounded-[var(--radius-inset)] border border-line bg-surface p-4 text-[13px] leading-[1.5] text-muted'

export default async function PartnersPage() {
  const orgs = await apiClient
    .get<Org[]>('/api/public/organizations')
    .catch(() => [] as Org[])

  return (
    <div>
      <p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">About</p>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Partners and supporters
      </h1>
      <p className="mt-3 max-w-[60ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        SPLAT is a small volunteer team. Almost everything on this site reaches a family through
        one of the organisations below.
      </p>

      <section className="mt-10">
        <h2 className={`${H2} mb-1.5`}>Delivery partners</h2>
        <p className="mb-[18px] max-w-[64ch] text-sm text-muted">
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
          <ul className="grid list-none gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {orgs.map((o, i) => (
              <li key={o.id}>
                <Link
                  href={`/organizations/${o.id}/public`}
                  className="card card-link flex h-full items-center gap-3.5 rounded-[var(--radius-inset)] p-[18px] text-ink"
                  style={{ boxShadow: 'var(--shadow-e1), var(--shadow-hi)' }}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-field)] text-[15px] font-extrabold text-[var(--tink)]"
                    style={{ background: TINTS[i % TINTS.length] }}
                  >
                    {o.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-base font-extrabold">{o.name}</span>
                    <span className="block text-[13px] font-semibold text-muted">
                      {[o.suburb, o.state].filter(Boolean).join(', ') || 'Australia'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Funders and in-kind stay honestly empty until there are some — the
          board's rows are placeholder names, and so is its partner quote, which
          is why there is no quote block here either. */}
      <div className="mt-11 grid items-start gap-5 sm:grid-cols-2">
        <section>
          <h2 className={`${H2} mb-1.5`}>Funders and grants</h2>
          <p className="mb-[18px] text-sm text-muted">
            Every grant is listed with what it actually paid for.
          </p>
          <p className={EMPTY} style={{ boxShadow: 'var(--shadow-e1)' }}>
            None yet. When there are, every grant will be listed here with what it actually paid
            for — hosting, the guide review programme, printed packs for build days — rather than
            a logo and a thank-you.
          </p>
        </section>

        <section>
          <h2 className={`${H2} mb-1.5`}>In-kind and technical</h2>
          <p className="mb-[18px] text-sm text-muted">
            Printer time, parts, venues and expertise given instead of money.
          </p>
          <p className={EMPTY} style={{ boxShadow: 'var(--shadow-e1)' }}>
            None yet. Printer time, parts at cost, a venue for build days, or professional work
            given free would go here, with what it covers and for how long.
          </p>
        </section>
      </div>

      {/* Plain-text names, no logos: the board keeps this so the lists above
          only ever show who is helping now. Empty for the same reason they are. */}
      <section className="mt-11">
        <h2 className="mb-2.5 font-display text-xl font-extrabold text-muted">Past supporters</h2>
        <p className="max-w-[64ch] text-sm text-muted">
          None yet. When a grant ends or a partner steps back, the name stays here in plain text
          so the lists above only show who is helping now.
        </p>
      </section>

      <div className="card mt-11 grid items-center gap-6 px-[34px] py-[30px] sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h2 className="mb-1.5 font-display text-2xl font-extrabold text-ink">Become a partner</h2>
          <p className="m-0 max-w-[60ch] text-[15px] leading-[1.6] text-muted">
            Organisations register and start publishing straight away. Funders and in-kind
            partners, tell us what you can offer and we will tell you exactly what it would pay
            for.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/get-involved/organisations" className="btn btn-primary">
            Register an organisation
          </Link>
          <Link href="/contact" className="btn btn-quiet">
            Talk about funding
          </Link>
        </div>
      </div>
    </div>
  )
}
