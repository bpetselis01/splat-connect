/**
 * The Learn course home.
 *
 * Was a hub grid of six standalone articles. It is a course now — six units,
 * sixteen lessons, in an order that teaches — because the artboard's Learn
 * section is a course rather than a reading list, and half the lessons are
 * procedures that only make sense after the one before them.
 *
 * Learn holds the general knowledge. The Guides catalogue at /library holds
 * instructions for one specific toy. Keep the two words apart in all copy.
 */
import Link from 'next/link'
import { Wrench, ShieldCheck, ChatsCircle, BookOpen } from '@phosphor-icons/react/dist/ssr'
import { LearnHome } from '@/components/learn-home'

export const metadata = {
  title: 'Learn — SPLAT Connect',
  description:
    'A free course in switch-adapting toys: how a switch works, the one soldering skill, three toys adapted step by step, and a switch you print yourself.',
}

const REFS = [
  {
    href: '/learn/tools-and-materials' as const,
    icon: Wrench,
    label: 'Tools and materials',
    blurb: 'The shopping list, with what to borrow instead.',
  },
  {
    href: '/learn/safety-and-cleaning' as const,
    icon: ShieldCheck,
    label: 'Safe handling',
    blurb: 'Six habits for irons, cutters and batteries.',
  },
  {
    href: '/learn/ask-an-expert' as const,
    icon: ChatsCircle,
    label: 'Ask an expert',
    blurb: 'Put a question to an OT or a maker.',
  },
  {
    href: '/library' as const,
    icon: BookOpen,
    label: 'Browse the guides',
    blurb: 'Step-by-step for a toy you already own.',
  },
]

export default function LearnPage() {
  return (
    <div>
      <LearnHome />

      <section>
        <h2 className="mb-3.5 mt-7 font-display text-[26px] font-extrabold text-ink">Keep at hand</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REFS.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="card card-link min-w-0 px-5 pb-5 pt-[18px] text-ink no-underline"
            >
              <span className="mb-2 flex items-center gap-2.5">
                <r.icon size={26} weight="duotone" className="text-brand-dark" aria-hidden="true" />
                <span className="font-display text-[17px] font-extrabold">{r.label}</span>
              </span>
              <span className="block text-sm leading-normal text-muted">{r.blurb}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
