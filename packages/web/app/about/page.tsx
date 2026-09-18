import Link from 'next/link'
import { BookOpen, HandHeart, SealCheck } from '@phosphor-icons/react/dist/ssr'
import { ORG_FACTS } from '@/lib/org-facts'
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'

export const metadata = {
  title: 'About SPLAT Connect',
  description:
    'Why toy adaptation matters, and who runs the platform that makes the knowledge shareable.',
}

export default function AboutPage() {
  const about = PUBLIC_NAV.find((s) => s.href === '/about')!
  return (
    <div>
      {/* No hero image. The board's About opens on the heading, and a 3:2 slot
          above the fold waiting for a photograph nobody has taken is the one
          thing on the page that says "unfinished". */}
      <h1 className="title-article">About</h1>
      <p className="mt-3.5 max-w-[64ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        SPLAT stands for <strong className="text-ink">Supporting Play by Adapting
        Toys</strong>. We publish free instructions for modifying ordinary toys so that
        children with disabilities can operate them, and we connect the people who build
        them to the families who need them.
      </p>

      {/* Three tinted pillars, as the board draws them: what the whole thing
          does, in one screenful, before anybody scrolls into the prose. */}
      <div className="mt-9 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: BookOpen,
            tint: 'var(--b100)',
            t: 'The knowledge is free',
            d: 'Every guide is free to read and free to build from, and it stays that way. You only ever cover the parts.',
          },
          {
            icon: SealCheck,
            tint: 'var(--tmint)',
            t: 'Somebody competent read it',
            d: 'Therapy services, schools and disability services review guides and put their name on them, so a badge means a professional checked it.',
          },
          {
            icon: HandHeart,
            tint: 'var(--tamber)',
            t: 'Nobody charges for their time',
            d: 'The making is given. SPLAT never handles money, and what people do spend is written down before you agree to anything.',
          },
        ].map((p) => (
          <div
            key={p.t}
            className="rounded-card border border-line p-[26px] text-ink"
            style={{ background: p.tint }}
          >
            <p.icon size={34} weight="duotone" aria-hidden="true" />
            <h2 className="mb-1.5 mt-3 font-display text-[21px] font-extrabold">{p.t}</h2>
            <p className="m-0 text-[15px] leading-[1.55]">{p.d}</p>
          </div>
        ))}
      </div>

      <section className="mt-12 max-w-prose">
        <h2 className="title-detail">Why this exists</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Play is how children learn that their actions change the world. A child who
          cannot press a small stiff button is shut out of that, not because the toy is
          too complex, but because the button is in the wrong place.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          Purpose-built switch-adapted toys exist. They cost several times what the same
          toy costs off a shelf, the range is narrow, and a child rarely gets to choose
          the one they actually like. Meanwhile the modification itself is often a
          two-dollar part and twenty minutes — if you know which two wires to touch.
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          That knowledge is the bottleneck, and it is the thing this platform exists to
          remove.
        </p>
      </section>

      <section className="mt-10 max-w-prose">
        <h2 className="title-detail">How the platform works</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Contributors adapt a toy and write down how, in enough detail that a parent
          with no electronics experience can follow it. Organisations — therapy services,
          schools, disability services — review that work and put their name on it, so a
          badge on a guide means a professional read it. Families follow the guides, or
          receive a toy someone has already adapted through the Toy Library. Everything
          published here is free to read and free to build from.
        </p>
      </section>

      <section className="mt-10 max-w-prose">
        <h2 className="title-detail">Who runs it</h2>
        <p className="mt-2 leading-relaxed text-muted">
          SPLAT Connect is run by {ORG_FACTS.legalName}, based in {ORG_FACTS.basedIn} and
          working since {ORG_FACTS.founded}. The platform is free to use and carries no
          advertising.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/about/team" className="btn btn-primary">
            Our team
          </Link>
          <Link href="/contact" className="btn btn-soft">
            Contact us
          </Link>
        </div>
      </section>

      <section className="mt-10 max-w-prose">
        <h2 className="title-detail">What we are working on next</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Some of what you can see on this site is not built yet, and those pages say so
          plainly rather than pretending. The largest missing piece is a way for a family
          to <em>ask</em> for an adaptation and have a maker nearby pick it up. If that
          would be useful to you, say so on the{' '}
          <Link href="/get-involved/requests" className="font-semibold text-brand-dark hover:underline">
            requests page
          </Link>{' '}
          — we build in the order people ask.
        </p>
      </section>

      <h2 className="mt-14 font-display text-[26px] font-extrabold text-ink">More about SPLAT</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        The team, how to reach us, and how to support what we do.
      </p>
      <HubGrid items={about.children} tone={about.tone} columns={4} />
    </div>
  )
}
