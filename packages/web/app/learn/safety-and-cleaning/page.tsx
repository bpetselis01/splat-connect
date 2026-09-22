import Link from 'next/link'
import { Warning, Eyeglasses, Sneaker, User, Scissors, Fire, Wind } from '@phosphor-icons/react/dist/ssr'
import { LearnShell } from '@/components/learn-shell'
import { LessonH2 } from '@/components/lesson-kit'

export const metadata = {
  title: 'Safe handling — SPLAT Connect',
  description: 'Hot irons, lead solder, and small batteries. None of it is dangerous if you follow six habits.',
}

const PPE = [
  { label: 'Safety glasses', icon: Eyeglasses },
  { label: 'Enclosed shoes', icon: Sneaker },
  { label: 'Long hair tied up', icon: User },
]

const TOOLS = [
  {
    title: 'Wire cutters, strippers and pliers',
    icon: Scissors,
    rules: [
      'Hold the tool by its insulated grips, never by the jaws.',
      'Cut away from your body and keep your fingers clear of the cutting area.',
    ],
  },
  {
    title: 'Soldering irons',
    icon: Fire,
    rules: [
      'Turn the extraction fan on and work in front of it, so you are not breathing the fumes.',
      'The iron goes back in its stand every time you put it down — the tip stays dangerously hot.',
      'Hold components with pliers or helping hands, never your fingers. Small metal parts conduct heat through in seconds.',
      'Wash your hands afterwards. Most solder still contains lead.',
    ],
  },
  {
    title: 'Heat guns',
    icon: Wind,
    rules: [
      'Shrink the tubing with short passes rather than holding it in one spot.',
      'Point it away from the toy body — thin plastic deforms long before the heat shrink does.',
    ],
  },
]

export default function SafetyAndCleaning() {
  return (
    <LearnShell slug="safety-and-cleaning">
      <p className="mt-[30px] rounded-[var(--radius-inset)] border border-line bg-[var(--tbad)] px-[22px] py-5 font-bold leading-[1.55] text-[var(--tink)]">
        <Warning weight="fill" className="mr-2 inline align-[-2px] text-danger" aria-hidden="true" />
        Button cells are the one non-negotiable. A swallowed coin cell burns through tissue in hours.
        If a toy takes them and the compartment is not screwed shut, it does not leave your house.
      </p>

      <LessonH2 className="mb-2.5 mt-[34px]">Wear this every time</LessonH2>
      <p className="mb-4 max-w-[66ch] leading-[1.55] text-ink">Whether it is a five-minute job or an afternoon.</p>
      <ul className="flex list-none flex-wrap gap-2.5 p-0">
        {PPE.map((p) => (
          <li key={p.label} className="course-meta gap-2.5 px-4 py-[11px] text-[14.5px]">
            <p.icon size={22} weight="duotone" className="text-brand-dark" aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ul>

      <LessonH2 className="mb-2.5 mt-[34px]">Handling the tools</LessonH2>
      <div className="flex flex-col gap-3.5">
        {TOOLS.map((g) => (
          <div key={g.title} className="rounded-card border border-line bg-surface px-[22px] py-5 shadow-[var(--e1)]">
            <h3 className="mb-2.5 flex items-center gap-2.5 font-display text-lg font-extrabold text-ink">
              <g.icon size={26} weight="duotone" className="text-brand-dark" aria-hidden="true" />
              {g.title}
            </h3>
            <ul className="flex list-disc flex-col gap-2 pl-5 leading-[1.55] text-ink">
              {g.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <LessonH2 className="mb-2.5 mt-[34px]">Batteries out first</LessonH2>
      <p className="max-w-[66ch] leading-[1.6] text-ink">
        Every build in this course starts the same way: remove the batteries before a screwdriver
        touches the toy. A motor that starts while the case is open, or a solder bridge across a live
        cell, is how a cheap toy becomes an expensive lesson.
      </p>
      {/* Not on the board. The route to the formal guidance stays reachable from the lesson. */}
      <p className="mt-4 max-w-[66ch] leading-[1.6] text-ink">
        The full formal guidance, including what to do if you find a problem with a published
        guide, is on the <Link href="/safety">safety page</Link>.
      </p>
    </LearnShell>
  )
}
