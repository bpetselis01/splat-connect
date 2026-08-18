import Link from 'next/link'
import { EditorialImage } from '@/components/editorial-image'
import { ORG_FACTS } from '@/lib/org-facts'
import { PUBLIC_NAV } from '@/lib/public-nav'
import { HubGrid } from '@/components/hub-grid'

export const metadata = {
  title: 'About SPLAT Connect',
  description:
    'Why toy adaptation matters, and who runs the platform that makes the knowledge shareable.',
}

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <EditorialImage illustration="organisation" ratio="3/2" />
      <h1 className="mt-6 text-2xl font-bold text-ink sm:text-3xl">About SPLAT Connect</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        SPLAT stands for <strong className="text-ink">Supporting Play by Adapting
        Toys</strong>. We publish free instructions for modifying ordinary toys so that
        children with disabilities can operate them, and we connect the people who build
        them to the families who need them.
      </p>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Why this exists</h2>
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

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">How the platform works</h2>
        <p className="mt-2 leading-relaxed text-muted">
          Contributors adapt a toy and write down how, in enough detail that a parent
          with no electronics experience can follow it. Organisations — therapy services,
          schools, disability services — review that work and put their name on it, so a
          badge on a guide means a professional read it. Families follow the guides, or
          receive a toy someone has already adapted through the Toy Library. Everything
          published here is free to read and free to build from.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">Who runs it</h2>
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

      <section className="mt-10">
        <h2 className="text-lg font-bold text-ink">What we are working on next</h2>
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

      <h2 className="mt-10 text-lg font-bold text-ink">More about SPLAT</h2>
      <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
        The team, how to reach us, and how to support what we do.
      </p>
      <HubGrid items={PUBLIC_NAV.find((s) => s.href === '/about')!.children} />
    </div>
  )
}
