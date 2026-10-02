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
import { ABOUT_LEAD, ABOUT_PILLARS, ABOUT_TEAM_BLURB } from '@splat-connect/types'

export const metadata = {
  title: 'About SPLAT Connect',
  description:
    'What SPLAT is, what it promises, and who runs the platform that makes the knowledge shareable.',
}

const PILLAR_LOOK = [
  { icon: Gift, tint: 'var(--b100)' },
  { icon: SealCheck, tint: 'var(--tmint)' },
  { icon: BookOpenText, tint: 'var(--tamber)' },
]
const PILLARS = ABOUT_PILLARS.map((p, i) => ({ ...p, ...PILLAR_LOOK[i]! }))

// The board's four, not PUBLIC_NAV's five: Stories lives under Impact on the
// board, and these cards carry a small left-aligned glyph rather than the hub
// grid's art band.
const KIDS: Array<{ href: Route; label: string; blurb: string; icon: typeof Gift }> = [
  { href: '/about/team', label: 'Our team', blurb: ABOUT_TEAM_BLURB, icon: UsersThree },
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
        {ABOUT_LEAD}
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

      {/* 099. Distance uses ABS postal-area centres; CC BY 4.0 asks for this line. */}
      <p className="mt-[46px] max-w-prose text-[13px] leading-[1.5] text-muted">
        Distances use postcode centre points derived from the Australian Bureau of Statistics’ Postal Areas (ASGS
        Edition 3, 2021), © Commonwealth of Australia, licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">
          CC BY 4.0
        </a>
        .
      </p>
    </div>
  )
}
