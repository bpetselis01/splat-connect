/**
 * Checks, cleaning and handover.
 *
 * The last read of the course, and the one that decides whether what somebody
 * made is an adapted toy or a hazard with a socket in it. Five checks as cards
 * because they are a list somebody works through at a bench rather than prose
 * they read once — and because the fifth is the one people skip.
 *
 * The three cleaning notes exist because the toy library moves toys between
 * households. Cleaning is part of the handover here, not an afterthought
 * appended to it.
 */
import Link from 'next/link'
import {
  TestTube,
  ArrowsOutLineVertical,
  Scissors,
  SpeakerHigh,
  BatteryWarning,
  Drop,
  TShirt,
  NotePencil,
} from '@phosphor-icons/react/dist/ssr'
import { LearnShell } from '@/components/learn-shell'
import { NotMedicalNote } from '@/components/not-medical-note'

export const metadata = {
  title: 'Checks, cleaning and handover — SPLAT Connect',
  description:
    'Five safety checks, how to clean between families, and what to show the family when you hand it over.',
}

const CHECKS = [
  {
    icon: TestTube,
    title: 'Choke test',
    body:
      'Anything that fits through a 32 mm tube with a 57 mm depth comes off or gets glued down. Button caps you left out count — bin them, do not leave them in the box.',
  },
  {
    icon: ArrowsOutLineVertical,
    title: 'Pull test',
    body:
      'Hang the toy by its switch lead. If the lead moves where it enters the case, redo the strain relief — a knot inside, a cable tie, or hot glue around the hole.',
  },
  {
    icon: Scissors,
    title: 'Sharp edges',
    body:
      'Every hole you drilled or cut gets deburred. Run a fingertip around it; if you can feel it, a child can cut on it.',
  },
  {
    icon: SpeakerHigh,
    title: 'Volume',
    body:
      'Measure at 30 cm with a phone app. Above 85 dB, tape over part of the speaker grille or add a resistor in series.',
  },
  {
    icon: BatteryWarning,
    title: 'Battery door',
    body:
      'Screwed, not clipped, for any child who mouths objects. Button cells in an unscrewed compartment mean the toy does not leave your house.',
  },
]

const CLEANING = [
  {
    icon: Drop,
    title: 'Hard surfaces',
    body:
      'Damp cloth, mild detergent, then a dry wipe. Never submerge — the interrupter lead is not sealed.',
  },
  {
    icon: TShirt,
    title: 'Fabric and plush',
    body:
      'Remove the interrupter, machine wash on cold in a bag, air dry fully before reassembly.',
  },
  {
    icon: NotePencil,
    title: 'The handover note',
    body:
      'Cleaned on, batteries fitted, switch type, and one line on what the toy does. Every toy, every time.',
  },
]

export default function Page() {
  return (
    <LearnShell slug="handover">
      <h1 className="mt-1.5 title-article">Checks, cleaning and handover</h1>

      <section className="mt-6">
        <h2 className="title-detail">Before it goes to a child</h2>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink">
          Five checks, every toy, every time. They take three minutes and they are what separates
          an adapted toy from a hazard with a socket in it.
        </p>
        <ul className="mt-4 grid list-none gap-3 sm:grid-cols-2">
          {CHECKS.map((c) => (
            <li key={c.title} className="card flex items-start gap-3 p-5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-danger-soft text-danger"
              >
                <c.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-ink">{c.title}</span>
                <span className="block text-sm leading-relaxed text-muted">{c.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="title-detail">Cleaning between families</h2>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink">
          Toys in the{' '}
          <Link href="/toy-library" className="font-semibold text-brand-dark hover:underline">
            toy library
          </Link>{' '}
          move between households, so cleaning is part of the handover, not an afterthought.
        </p>
        <ul className="mt-4 flex list-none flex-col gap-3">
          {CLEANING.map((c) => (
            <li key={c.title} className="card flex items-start gap-3 p-5">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-sunken text-brand-deep"
              >
                <c.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-bold text-ink">{c.title}</span>
                <span className="block text-sm leading-relaxed text-muted">{c.body}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="title-detail">Show the family, not just the toy</h2>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-ink">
          Plug the switch in with them watching. Show where the socket is, that the original button
          still works, and how to get the batteries out. Leave the handover note tucked in the
          battery door. A toy nobody knows how to use goes back in the cupboard within a week.
        </p>
      </section>

      <div className="mt-8">
        <NotMedicalNote />
      </div>
    </LearnShell>
  )
}
