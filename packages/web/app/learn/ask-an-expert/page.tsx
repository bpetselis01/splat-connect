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
  ChatCircleText,
  BookOpen,
  Lightbulb,
  Handshake,
  Warning,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'Have a question? — SPLAT Connect',
  description:
    'Where each kind of question gets answered on SPLAT, and why none of them go to a private queue.',
}

const DOORS: Array<{
  icon: typeof BookOpen
  title: string
  body: string
  cta: string
  href: Route
}> = [
  {
    icon: ChatCircleText,
    title: 'About a step in a guide',
    body:
      'Unclear photo, wrong part, a step that did not work. Ask on the guide itself so the author and everyone building it can see.',
    cta: 'Open the guide, then Community notes',
    href: '/library',
  },
  {
    icon: BookOpen,
    title: 'Which switch, which toy, is this safe?',
    body:
      'The course answers most first questions in a few minutes, written for parents standing in a shop aisle.',
    cta: 'Start with Learn',
    href: '/learn',
  },
  {
    icon: Lightbulb,
    title: 'Nobody has adapted this yet',
    body:
      'Post it as a public idea. Makers and OTs answer in the thread, and if it needs a build it becomes a design challenge.',
    cta: 'Submit an idea',
    href: '/get-involved/submit-an-idea',
  },
  {
    icon: Handshake,
    title: 'I need a person, not an answer',
    body:
      'A build day near you, someone to print parts, or a maker to build it. One request, one helper.',
    cta: 'Ask for a build',
    href: '/get-involved/makers-wanted',
  },
]

export default function AskAnExpertPage() {
  return (
    <div>
      <p className="eyebrow text-muted">Learn</p>
      <h1 className="mt-1.5 title-hub">Have a question?</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
        There is no private expert queue on SPLAT, on purpose: an answer in the open helps the
        next family too. Pick what your question is about and it goes where it gets answered.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DOORS.map((d) => (
          <Link key={d.title} href={d.href} className="card card-link flex flex-col gap-2 p-5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-card bg-brand-tint text-brand-deep"
            >
              <d.icon className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-extrabold text-ink">{d.title}</span>
            <span className="flex-1 text-sm leading-relaxed text-muted">{d.body}</span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-dark">
              {d.cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <p className="mt-8 flex items-start gap-2 rounded-card bg-danger-soft px-5 py-4 text-sm leading-relaxed text-ink">
        <Warning className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <span>
          Something unsafe? Do not post it — use the Safety report topic in{' '}
          <Link href="/contact" className="font-bold underline">
            Contact
          </Link>
          . That reaches an administrator the same day.
        </span>
      </p>
    </div>
  )
}
