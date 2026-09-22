/**
 * Have a question?
 *
 * A routing page, not a form, and the first sentence says why: there is no
 * private expert queue on SPLAT on purpose. An answer in the open helps the
 * next family too, and a private one helps exactly one.
 *
 * So this is four doors and the rule for choosing between them — which is more
 * use than a contact form that would funnel every question to the same two
 * volunteers and answer none of them where anybody could find it later.
 *
 * Was a ComingSoon with a notify form. It stopped needing one when every
 * destination below became real.
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  NotePencil,
  GraduationCap,
  ChatsCircle,
  Lifebuoy,
  ArrowRight,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'Have a question? — SPLAT Connect',
  description:
    'Where each kind of question gets answered on SPLAT, and why none of them go to a private queue.',
}

const DOORS: Array<{
  icon: typeof NotePencil
  tint: string
  title: string
  body: string
  cta: string
  href: Route
}> = [
  {
    icon: NotePencil,
    tint: 'var(--b100)',
    title: 'About a step in a guide',
    body:
      'Unclear photo, wrong part, a step that did not work. Ask on the guide itself so the author and everyone building it can see.',
    cta: 'Open the guide, then Community notes',
    href: '/library',
  },
  {
    icon: GraduationCap,
    tint: 'var(--tmint)',
    title: 'Which switch, which toy, is this safe?',
    body:
      'The course answers most first questions in a few minutes, written for parents standing in a shop aisle.',
    cta: 'Start with Learn',
    href: '/learn',
  },
  {
    // The board says "a public Question" with its own thread. Ideas are the
    // nearest thing that exists; a Question kind would need backend work.
    icon: ChatsCircle,
    tint: 'var(--tviolet)',
    title: 'Nobody has adapted this yet',
    body:
      'Post it as a public idea. Makers and OTs answer in the thread, and if it needs a build it becomes a design challenge.',
    cta: 'Submit an idea',
    href: '/get-involved/submit-an-idea',
  },
  {
    icon: Lifebuoy,
    tint: 'var(--tamber)',
    title: 'I need a person, not an answer',
    body:
      'A build day near you, someone to print parts, or a maker to build it. One request, one helper.',
    // Help is asked for from the guide it is about, so this door opens the
    // catalogue rather than a generic form.
    cta: 'Get help on a guide',
    href: '/library',
  },
]

export default function AskAnExpertPage() {
  return (
    <div className="max-w-[900px]">
      <p className="eyebrow text-brand">Learn</p>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Have a question?
      </h1>
      <p className="mt-3 max-w-[58ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        There is no private expert queue on SPLAT, on purpose: an answer in the open helps the next
        family too. Pick what your question is about and it goes where it gets answered.
      </p>

      <div className="mt-[30px] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
        {DOORS.map((d) => (
          <Link
            key={d.title}
            href={d.href}
            className="flex flex-col gap-2.5 rounded-card border border-line p-[22px] text-[var(--tink)] no-underline transition-transform hover:-translate-y-[3px]"
            style={{ background: d.tint }}
          >
            <d.icon size={32} weight="duotone" aria-hidden="true" />
            <span className="font-display text-[19px] font-extrabold">{d.title}</span>
            <span className="flex-1 text-sm leading-normal opacity-90">{d.body}</span>
            <span className="text-sm font-extrabold">
              {d.cta} <ArrowRight weight="bold" className="inline" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-[26px] max-w-[64ch] text-sm leading-[1.6] text-muted">
        <ShieldCheck weight="fill" className="inline text-success" aria-hidden="true" /> Something
        unsafe? Do not post it — use the Report link on the guide or the Safety report topic in{' '}
        <Link href="/contact" className="font-extrabold text-brand-deep hover:underline">
          Contact
        </Link>
        . That reaches an administrator the same day.
      </p>
    </div>
  )
}
