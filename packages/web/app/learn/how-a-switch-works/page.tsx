/**
 * How a switch works.
 *
 * Two diagrams carry the whole lesson, and they are inline SVG rather than
 * images: a circuit with two states is exactly the thing a picture of a
 * photograph cannot show, and a reader on a slow connection should not wait for
 * a JPEG of a rectangle and two lines.
 *
 * The diagrams are decorative — every one has a caption under it saying what it
 * shows, and the paragraphs say it again in words. Somebody using a screen
 * reader gets the lesson, not a list of unlabelled shapes.
 */
import Link from 'next/link'
import { LearnShell } from '@/components/learn-shell'
import { Alert } from '@/components/alert'

export const metadata = {
  title: 'How a switch works — SPLAT Connect',
  description:
    'A button is a gap in a circuit. An adapted toy just gives that gap a second way to close.',
}

/** One loop, with the gap open or closed. */
function CircuitDiagram({ closed, second }: { closed: boolean; second?: boolean }) {
  return (
    <svg
      viewBox="0 0 220 120"
      aria-hidden="true"
      className="h-auto w-full max-w-sm"
      fill="none"
      strokeWidth={3}
      strokeLinecap="round"
    >
      {/* The loop */}
      <path
        d="M30 30 H110 M130 30 H190 V90 H30 V30"
        className="stroke-ink"
      />
      {/* The original button: a gap, bridged when pressed */}
      {closed ? (
        <path d="M110 30 H130" className="stroke-ink" />
      ) : (
        <path d="M110 30 l14 -12" className="stroke-ink" />
      )}
      {/* The toy, as a lamp */}
      <circle
        cx="190"
        cy="60"
        r="11"
        className={closed ? 'fill-honey-soft stroke-ink' : 'fill-surface stroke-ink'}
      />
      {second && (
        <>
          {/* The added switch, in parallel across the same gap */}
          <path d="M110 30 V8 H130 V30" className="stroke-brand-dark" strokeDasharray="5 4" />
          <circle cx="120" cy="8" r="6" className="fill-brand-tint stroke-brand-dark" />
        </>
      )}
    </svg>
  )
}

export default function Page() {
  return (
    <LearnShell slug="how-a-switch-works">
      <h1 className="mt-1.5 title-article">How a switch works</h1>

      <section className="mt-6">
        <h2 className="title-detail">A button is a gap</h2>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink">
          Electrically, a button is nothing more than a break in a loop of wire. While it is not
          pressed, the loop is open and nothing flows. Press it and the two sides touch, the loop
          closes, and the toy turns on. Let go and the gap comes back.
        </p>
        <div className="mt-5 flex flex-wrap gap-6">
          <figure>
            <CircuitDiagram closed={false} />
            <figcaption className="mt-1 text-sm text-muted">Switch open, toy off.</figcaption>
          </figure>
          <figure>
            <CircuitDiagram closed />
            <figcaption className="mt-1 text-sm text-muted">Switch closed, toy on.</figcaption>
          </figure>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="title-detail">Two buttons, one job</h2>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink">
          An adapted toy adds a second switch <em>in parallel</em> with the first — its two wires
          join the two sides of the original button. Now either switch can close the loop. The
          toy&apos;s own button keeps working for siblings, and the big external switch works for
          the child. Nothing about the toy&apos;s electronics changes; you have just given the gap
          a second way to close.
        </p>
        <figure className="mt-5">
          <CircuitDiagram closed={false} second />
          <figcaption className="mt-1 text-sm text-muted">
            The external switch sits beside the original. Either one turns the toy on.
          </figcaption>
        </figure>
      </section>

      <section className="mt-10">
        <h2 className="title-detail">Jack, socket, and why 3.5 mm</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="font-bold text-ink">Jack — goes on the switch</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The plug. Two contacts: tip and sleeve. Every commercial accessible switch — jelly
              bean, buddy button, the lot — ends in one of these.
            </p>
          </div>
          <div className="card p-5">
            <p className="font-bold text-ink">Socket — goes in the toy</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              The hole. Its two pins are what you solder across the toy&apos;s button. Any switch a
              family already owns will plug straight in.
            </p>
          </div>
        </div>
        <Alert tone="warn" className="mt-6">
          <strong className="font-bold">Mono, not stereo.</strong> A stereo plug has three contacts
          and will sometimes work by luck. Buy mono every time so the child&apos;s switch behaves
          the same in every toy you adapt.
        </Alert>
        <p className="mt-4 text-sm text-muted">
          Wiring one is the next practical step —{' '}
          <Link href="/learn/wire-a-connector" className="font-semibold text-brand-dark hover:underline">
            Unit 3 does it in nine steps
          </Link>
          .
        </p>
      </section>
    </LearnShell>
  )
}
