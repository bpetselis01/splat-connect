import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  Buildings,
  EnvelopeSimple,
  Flag,
  GraduationCap,
  MapPin,
} from '@phosphor-icons/react/dist/ssr'
import { ORG_FACTS } from '@/lib/org-facts'
import { ContactForm } from '@/components/contact-form'
import { getCapabilities } from '@/lib/capabilities'

export const metadata = { title: 'Contact — SPLAT Connect' }

// Three places that answer faster than the form does.
const ROUTES: Array<{ t: string; d: string; cta: string; icon: typeof Flag; tint: string; href: Route }> = [
  {
    t: 'Problem with a specific guide?',
    d: 'The Report link on the guide reaches an administrator immediately and keeps the context attached.',
    cta: 'Browse guides',
    icon: Flag,
    tint: 'var(--tamber)',
    href: '/library',
  },
  {
    t: 'Want to register an organisation?',
    d: 'No email needed. Register, and we appoint your first leader within the week.',
    cta: 'For organisations',
    icon: Buildings,
    tint: 'var(--tviolet)',
    href: '/get-involved/organisations',
  },
  {
    t: 'New to switch toys?',
    d: 'Most first questions are answered in Learn, which is faster than waiting on us.',
    cta: 'Start with Learn',
    icon: GraduationCap,
    tint: 'var(--tmint)',
    href: '/learn',
  },
]

const ETAS = [
  { k: 'Safety report', v: 'Same day', c: 'var(--ok)' },
  { k: 'Everything else', v: '2 to 5 days', c: 'var(--ink)' },
  { k: 'Weekends', v: 'Slower', c: 'var(--muted)' },
]

const ASIDE_CARD = 'rounded-card border border-line bg-surface p-[22px]'
const ASIDE_LABEL = 'mb-3 block text-xs font-extrabold uppercase tracking-[0.1em] text-muted'

export default async function ContactPage() {
  // Prefilled when there is a session, and not required either way: somebody
  // reporting a hazard should not have to make an account first.
  const caps = await getCapabilities()
  return (
    <div className="max-w-[1100px]">
      <p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">About</p>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Contact
      </h1>
      <p className="mt-3 max-w-[58ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        A guide, a toy, a partnership. Everyone here is a volunteer with another job, so most
        things take a few days. Some things are faster if you go straight to the right place.
      </p>

      <div className="mt-7 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {ROUTES.map((r) => (
          <Link
            key={r.t}
            href={r.href}
            className="flex items-start gap-3.5 rounded-[var(--radius-inset)] border border-line px-5 py-[18px] text-[var(--tink)] transition-transform hover:-translate-y-0.5"
            style={{ background: r.tint }}
          >
            <r.icon size={28} weight="duotone" className="shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-display text-base font-extrabold">{r.t}</span>
              <span className="mt-0.5 block text-[13px] leading-[1.5] opacity-90">{r.d}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold">
                {r.cta}
                <ArrowRight size={12} weight="bold" aria-hidden="true" />
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ContactForm
          defaultName={caps?.profile.name ?? ''}
          defaultEmail={caps?.profile.email ?? ''}
        />

        {/* The board's "Who reads this" card names team members per topic;
            there is no team data to draw it from yet, so it is left out. */}
        <aside className="flex flex-col gap-3.5">
          <div className={ASIDE_CARD} style={{ boxShadow: 'var(--shadow-e1)' }}>
            <span className={ASIDE_LABEL}>Response times</span>
            <div className="grid gap-2.5">
              {ETAS.map((e) => (
                <div key={e.k} className="flex justify-between gap-2.5 text-sm">
                  <span className="font-bold text-ink">{e.k}</span>
                  <span className="whitespace-nowrap font-extrabold" style={{ color: e.c }}>
                    {e.v}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className={ASIDE_CARD} style={{ boxShadow: 'var(--shadow-e1)' }}>
            <span className={`${ASIDE_LABEL} !mb-2.5`}>Other ways</span>
            <p className="m-0 text-sm leading-[1.7] text-ink">
              <EnvelopeSimple size={14} weight="bold" className="mr-1.5 inline text-[var(--b600)]" aria-hidden="true" />
              <a href={`mailto:${ORG_FACTS.contactEmail}`} className="hover:underline">
                {ORG_FACTS.contactEmail}
              </a>
              <br />
              <MapPin size={14} weight="bold" className="mr-1.5 inline text-[var(--b600)]" aria-hidden="true" />
              {ORG_FACTS.basedIn}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
