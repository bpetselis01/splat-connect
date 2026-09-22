import Link from 'next/link'
import type { Route } from 'next'
import {
  BookOpenText,
  EnvelopeSimple,
  Gift,
  Handshake,
  Heart,
  SealCheck,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'About SPLAT Connect',
  description:
    'What SPLAT is, what it promises, and who runs the platform that makes the knowledge shareable.',
}

const PILLARS = [
  {
    icon: Gift,
    tint: 'var(--b100)',
    t: 'No paid tier, ever',
    d: 'No commission, no ads, nothing to subscribe to. If a family cannot afford it, it does not work.',
  },
  {
    icon: SealCheck,
    tint: 'var(--tmint)',
    t: 'Reviewed, not just posted',
    d: 'Every guide is read by an administrator or an organisation leader before it goes public.',
  },
  {
    icon: BookOpenText,
    tint: 'var(--tamber)',
    t: 'Information, not devices',
    d: 'We publish instructions. We do not manufacture, supply or prescribe anything.',
  },
]

// The board's four, not PUBLIC_NAV's five: Stories lives under Impact on the
// board, and these cards carry a small left-aligned glyph rather than the hub
// grid's art band.
const KIDS: Array<{ href: Route; label: string; blurb: string; icon: typeof Gift }> = [
  { href: '/about/team', label: 'Our team', blurb: 'The people behind the platform.', icon: UsersThree },
  { href: '/contact', label: 'Contact', blurb: 'Get in touch about a guide, a toy or a partnership.', icon: EnvelopeSimple },
  {
    href: '/about/partners',
    label: 'Partners and supporters',
    blurb: 'The organisations, funders and in-kind partners making this possible.',
    icon: Handshake,
  },
  { href: '/about/support', label: 'Support SPLAT', blurb: 'Skills, parts, a workplace build day. Money last.', icon: Heart },
]

export default function AboutPage() {
  return (
    <div>
      <h1 className="font-display text-[clamp(34px,4vw,52px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
        About
      </h1>
      <p className="mt-3.5 max-w-[64ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        SPLAT stands for Supporting Play by Adapting Toys. We make toy adaptation knowledge
        discoverable and shareable, so a parent who has never held a soldering iron can still
        get a toy their child can start. The knowledge on the platform is free and stays free.
        The making is given time; you cover the parts.
      </p>

      <div className="mt-[34px] grid gap-4 sm:grid-cols-3">
        {PILLARS.map((p) => (
          <div
            key={p.t}
            className="rounded-card border border-line p-[26px] text-[var(--tink)]"
            style={{ background: p.tint }}
          >
            <p.icon size={34} weight="duotone" aria-hidden="true" />
            <h2 className="mb-1.5 mt-3 font-display text-[21px] font-extrabold">{p.t}</h2>
            <p className="m-0 text-[15px] leading-[1.55]">{p.d}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-[18px] mt-[46px] font-display text-[26px] font-extrabold text-ink">
        In this section
      </h2>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {KIDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card card-link rounded-[var(--radius-inset)] p-5 text-ink"
            style={{ boxShadow: 'var(--shadow-e1), var(--shadow-hi)' }}
          >
            <c.icon size={28} weight="duotone" className="mb-2.5 text-[var(--b600)]" aria-hidden="true" />
            <span className="mb-[5px] block font-display text-[17px] font-extrabold">{c.label}</span>
            <span className="block text-[13px] leading-[1.5] text-muted">{c.blurb}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
