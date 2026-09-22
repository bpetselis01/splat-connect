import Image from 'next/image'
import { LearnShell } from '@/components/learn-shell'
import { LessonH2 } from '@/components/lesson-kit'

export const metadata = {
  title: 'How a switch works — SPLAT Connect',
  description:
    'A button is a gap in a circuit. An adapted toy just gives that gap a second way to close.',
}

// The workshop's own diagrams. Width and height are the files' intrinsic size,
// so next/image reserves the right box before they load.
function Diagram({
  src,
  alt,
  caption,
  maxWidth,
  width,
  height,
}: {
  src: string
  alt: string
  caption: string
  maxWidth: number
  width: number
  height: number
}) {
  return (
    <figure className="rounded-card border border-line bg-surface px-6 pb-4 pt-[22px] shadow-[var(--e2)]">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="mx-auto block h-auto w-full"
        style={{ maxWidth }}
      />
      <figcaption className="mt-2.5 text-center text-sm font-semibold text-muted">{caption}</figcaption>
    </figure>
  )
}

const CONNECTORS = [
  {
    img: '/learn/img/18.jpeg',
    alt: 'A 3.5 mm mono jack plug',
    title: 'Jack — goes on the switch',
    body: 'The plug. Two contacts: tip and sleeve. Every commercial accessible switch — jelly bean, buddy button, the lot — ends in one of these.',
  },
  {
    img: '/learn/img/19.jpeg',
    alt: 'A 3.5 mm mono socket',
    title: 'Socket — goes in the toy',
    body: "The hole. Its two pins are what you solder across the toy's button. Any switch a family already owns will plug straight in.",
  },
]

export default function HowASwitchWorks() {
  return (
    <LearnShell slug="how-a-switch-works">
      <LessonH2>A button is a gap</LessonH2>
      <p className="mb-[18px] leading-[1.6] text-ink">
        Electrically, a button is nothing more than a break in a loop of wire. While it is not
        pressed, the loop is open and nothing flows. Press it and the two sides touch, the loop
        closes, and the toy turns on. Let go and the gap comes back.
      </p>
      <Diagram
        src="/learn/img/02.png"
        alt="Two circuit diagrams: an open switch with the lamp off, and a closed switch with the lamp lit"
        caption="Left: switch open, toy off. Right: switch closed, toy on."
        maxWidth={560}
        width={1216}
        height={396}
      />

      <LessonH2>Two buttons, one job</LessonH2>
      <p className="mb-[18px] leading-[1.6] text-ink">
        An adapted toy adds a second switch <strong>in parallel</strong> with the first — its two
        wires join the two sides of the original button. Now either switch can close the loop. The
        toy&apos;s own button keeps working for siblings, and the big external switch works for the
        child. Nothing about the toy&apos;s electronics changes; you have just given the gap a
        second way to close.
      </p>
      <Diagram
        src="/learn/img/03.png"
        alt="Two circuit diagrams showing an external switch wired in parallel with the toy's own switch"
        caption="The external switch sits beside the original. Either one turns the toy on."
        maxWidth={620}
        width={1191}
        height={499}
      />

      <LessonH2>Jack, socket, and why 3.5&nbsp;mm</LessonH2>
      <div className="grid gap-4 sm:grid-cols-2">
        {CONNECTORS.map((c) => (
          <div
            key={c.title}
            className="overflow-hidden rounded-card border border-line bg-surface shadow-[var(--e1)]"
          >
            <div className="relative aspect-video w-full bg-sunken">
              <Image src={c.img} alt={c.alt} fill sizes="(min-width: 1024px) 432px, 100vw" className="object-cover" />
            </div>
            <div className="px-[18px] pb-[18px] pt-4">
              <h3 className="mb-1 font-display text-lg font-extrabold text-ink">{c.title}</h3>
              <p className="text-[15px] leading-normal text-muted">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-[22px] rounded-[var(--radius-inset)] border border-line bg-brand-50 px-[22px] py-5 leading-[1.55] text-ink">
        <strong>Mono, not stereo.</strong> A stereo plug has three contacts and will sometimes work by
        luck. Buy mono every time so the child&apos;s switch behaves the same in every toy you adapt.
      </p>
    </LearnShell>
  )
}
