/**
 * 3D print requests — a designed stub.
 *
 * Replaces the generic ComingSoon placeholder. The feature is still unbuilt and
 * the page says so plainly; what changed is that it now explains the idea well
 * enough to be worth landing on, and shows the thing it is talking about.
 *
 * ComingSoon stays in the codebase for /toy-library, whose wording is pinned by
 * tests/unit/components/coming-soon.test.tsx and dashboard/shell.spec.ts.
 *
 * Related files:
 * - components/printing-canvas.tsx: the three.js mount, poster-first
 * - lib/nav-model.ts: the rail row, marked soon
 */
import Link from 'next/link'
import { PrintingCanvas } from '@/components/printing-canvas'
import { Reveal } from '@/components/reveal'
import { fadeIn } from '@/lib/motion'

const STEPS = [
  {
    title: 'Pick an association with printers free',
    desc: 'Organisations near you list what their printers can take on this week.',
  },
  {
    title: 'Describe the part and how many you need',
    desc: 'Sizes come from your child’s measurements, so a mount fits the first time.',
  },
  {
    title: 'They’ll be in touch about pickup',
    desc: 'Printing is done by the association. You collect, or arrange delivery with them.',
  },
]

export default function PrintingPage() {
  return (
    <div>
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <div>
          <span className="badge bg-sunken text-muted">NOT LIVE YET</span>
          <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
            Get a part printed near you
          </h1>
          <p className="mt-3 max-w-prose leading-relaxed text-muted">
            Not every adaptation can be bought. Mounts, switch housings and grips
            are usually printed — and most families do not have a printer. This
            will let you ask an association that does.
          </p>
          <p className="mt-3 max-w-prose leading-relaxed text-muted">
            Tutorials that need printed parts already ship their files. Until this
            is built, those files are downloadable from any tutorial that has them.
          </p>
          <Link href="/library" className="btn btn-accent mt-6">
            Browse tutorials
          </Link>
        </div>

        <PrintingCanvas />
      </section>

      <Reveal variants={fadeIn} className="mt-16">
        <h2 className="text-xl font-bold text-ink">How it will work</h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-bold text-ink">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.desc}</p>
            </li>
          ))}
        </ol>
      </Reveal>
    </div>
  )
}
