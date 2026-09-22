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
import { LessonH2 } from '@/components/lesson-kit'

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
      <LessonH2 className="mb-2.5 mt-[34px]">Before it goes to a child</LessonH2>
      <p className="mb-4 max-w-[66ch] leading-[1.6] text-ink">
        Five checks, every toy, every time. They take three minutes and they are what separates an
        adapted toy from a hazard with a socket in it.
      </p>
      <ul className="flex list-none flex-col gap-3 p-0">
        {CHECKS.map((c) => (
          <li
            key={c.title}
            className="grid grid-cols-[44px_minmax(0,1fr)] items-start gap-3.5 rounded-[var(--radius-inset)] border border-line bg-surface px-5 py-4 shadow-[var(--e1)]"
          >
            <c.icon size={30} weight="duotone" className="text-brand-dark" aria-hidden="true" />
            <div>
              <h3 className="mb-1 mt-0.5 font-display text-lg font-extrabold text-ink">{c.title}</h3>
              <p className="text-[15px] leading-[1.55] text-ink">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <LessonH2 className="mb-2.5 mt-[34px]">Cleaning between families</LessonH2>
      <p className="mb-3 leading-[1.6] text-ink">
        Toys in the <Link href="/toy-library">toy library</Link> move between households, so cleaning
        is part of the handover, not an afterthought.
      </p>
      <ul className="mt-[18px] grid list-none gap-4 p-0 sm:grid-cols-3">
        {CLEANING.map((c) => (
          <li
            key={c.title}
            className="rounded-[var(--radius-inset)] border border-line bg-surface p-5 shadow-[var(--e1)]"
          >
            <c.icon size={30} weight="duotone" className="text-mint" aria-hidden="true" />
            <h3 className="mb-1.5 mt-2.5 font-display text-[17px] font-extrabold text-ink">{c.title}</h3>
            <p className="text-sm leading-normal text-muted">{c.body}</p>
          </li>
        ))}
      </ul>

      <LessonH2 className="mb-2.5 mt-[34px]">Show the family, not just the toy</LessonH2>
      <p className="max-w-[66ch] leading-[1.6] text-ink">
        Plug the switch in with them watching. Show where the socket is, that the original button
        still works, and how to get the batteries out. Leave the handover note tucked in the battery
        door. A toy nobody knows how to use goes back in the cupboard within a week.
      </p>

      <p className="mt-[30px] rounded-[var(--radius-inset)] border border-line bg-sunken px-[22px] py-5 text-[15px] leading-[1.55] text-muted">
        SPLAT Connect publishes information, not medical devices. Read{' '}
        <Link href="/legal/intended-purpose">what Connect is (and isn&apos;t)</Link> before adapting
        anything a therapist has prescribed.
      </p>
    </LearnShell>
  )
}
