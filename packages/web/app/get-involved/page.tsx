import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  CheckCircle,
  Gift,
  Hammer,
  HandHeart,
  Lightbulb,
  NotePencil,
  Printer,
  PuzzlePiece,
  Recycle,
  Sparkle,
} from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { SplatMascot, type MascotPose } from '@/components/splat-mascot'

export const metadata = {
  title: 'Get involved — SPLAT Connect',
  description:
    'Three ways in: adapt a toy for your own child, make toys for other people, or bring your organisation in behind the work.',
}

type Track = {
  kicker: string
  title: string
  body: string
  points: string[]
  cta: string
  href: string
  tint: string
  pose: MascotPose
  primary?: boolean
}

// The board's sample tracks, word for word. The CTAs change with the session
// because a signed-out maker's first step is an account, not the editor.
function tracks(signed: boolean): Track[] {
  return [
    {
      kicker: 'For families',
      title: 'Build it yourself — or don’t',
      body: 'Follow a reviewed guide with about $30 of parts, or request a toy someone nearby already adapted.',
      points: [
        'Filter guides by what your child can do',
        'Save guides and toys to one list',
        'Request toys and agree pickups in-app',
      ],
      cta: 'Start with a child profile',
      href: '/onboarding/child',
      tint: 'var(--tcoral)',
      pose: 'hold',
      primary: true,
    },
    {
      kicker: 'For makers',
      title: 'Adapt a toy, write it up',
      body: 'Hobbyists, students and OTs document builds step by step. An organisation or SPLAT reviews before it’s published.',
      points: [
        'Step editor with parts list and STL uploads',
        'Claim a build a family nearby asked for',
        'Get backed by a therapy service',
      ],
      cta: signed ? 'Write your first guide' : 'Create an account to start writing',
      href: signed ? '/upload' : '/signup',
      tint: 'var(--tamber)',
      pose: 'think',
    },
    {
      kicker: 'For organisations',
      title: 'Hold toys, print parts',
      body: 'Therapy centres, schools and libraries keep a shelf of adapted toys for local families and run a 3D printer parents nearby can send parts to.',
      points: [
        'Toy inventory with quantities and handover codes',
        'Print hub: parents pick you, jobs queue in one place',
        'Optionally put your name behind guides',
      ],
      cta: signed ? 'Request your organisation' : 'Register an organisation',
      href: signed ? '/get-involved/organisations/request' : '/signup',
      tint: 'var(--tmint)',
      pose: 'party',
    },
  ]
}

const GROUPS = [
  {
    id: 'inv-need',
    heading: 'If you need something',
    icon: HandHeart,
    tint: 'var(--tcoral)',
    items: [
      { label: 'Submit an idea', blurb: 'No guide for the toy your child needs? Describe it and makers pick it up as a design challenge.', icon: Lightbulb, href: '/get-involved/submit-an-idea' },
      { label: 'Makers wanted', blurb: 'The guide exists but you cannot build it. Ask, and a maker nearby builds it for you.', icon: Hammer, href: '/get-involved/makers-wanted' },
      { label: 'Ask for a print', blurb: 'No printer near you? A printer owner prints the part and hands it over or posts it.', icon: Printer, href: '/printing' },
    ],
  },
  {
    id: 'inv-offer',
    heading: 'If you have something to offer',
    icon: Sparkle,
    tint: 'var(--tmint)',
    items: [
      { label: 'Submit a guide', blurb: 'What writing up an adaptation involves, start to finish.', icon: NotePencil, href: '/get-involved/submit-a-tutorial' },
      { label: 'Build for a family', blurb: 'Claim a request on Makers wanted and build it — you give the time, the family covers the parts.', icon: Hammer, href: '/get-involved/makers-wanted' },
      { label: 'Give a toy', blurb: 'List a toy your child has finished with. Gift it or swap it; we keep the record.', icon: Gift, href: '/dashboard/toys/new' },
      { label: 'Design challenges', blurb: 'Problems nobody has solved yet, open to anyone.', icon: PuzzlePiece, href: '/get-involved/design-challenges' },
    ],
  },
]

const RECYCLE_STEPS = [
  'Sort it, clean it, 2 kg minimum',
  'Book a slot and sign the condition declaration',
  'They weigh it and credit you the grams',
]

export default async function GetInvolvedPage() {
  const signed = !!(await getCapabilities())

  return (
    <div>
      <div className="max-w-[62ch] py-2">
        <span className="font-sans text-[13px] font-extrabold uppercase tracking-[.1em] text-brand">
          Get involved
        </span>
        <h1 className="mt-2.5 max-w-[18ch] font-display text-[clamp(34px,4.2vw,54px)] font-extrabold leading-[1.04] tracking-[-.02em] text-ink [text-wrap:balance]">
          Make something, give something, or back someone.
        </h1>
        <p className="mt-4 text-lg leading-[1.6] text-muted [text-wrap:pretty]">
          SPLAT runs on unpaid work. Makers adapt toys and write down how, families and
          organisations pass on toys and print parts, and organisations put their name behind
          work so a parent knows someone competent read it. The guides, the platform and the
          help are free and always will be — you only ever cover the parts.
        </p>
      </div>

      <div className="mt-9 grid gap-5 md:grid-cols-3">
        {tracks(signed).map((t) => (
          <article key={t.kicker} className="card card-link flex flex-col gap-3.5 p-7">
            <div
              className="grid h-[150px] place-items-center overflow-hidden rounded-[18px]"
              style={{ background: t.tint }}
            >
              <SplatMascot pose={t.pose} width={120} />
            </div>
            <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-[var(--b700)]">
              {t.kicker}
            </span>
            <h3 className="m-0 font-display text-[26px] font-extrabold leading-[1.15] text-ink">
              {t.title}
            </h3>
            <p className="m-0 leading-[1.55] text-muted">{t.body}</p>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm font-semibold">
              {t.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <CheckCircle weight="fill" aria-hidden="true" className="shrink-0 text-lg text-[var(--ok)]" />
                  {p}
                </li>
              ))}
            </ul>
            <Link
              href={t.href as Route}
              className={`btn btn-block mt-auto min-h-[52px] text-base ${
                t.primary ? 'btn-primary' : 'bg-[var(--surface2)] text-ink'
              }`}
            >
              {t.cta}
            </Link>
          </article>
        ))}
      </div>

      <div className="mt-[34px] grid items-center gap-[26px] rounded-card border border-line bg-[var(--tmint)] px-8 py-7 text-[var(--tink)] shadow-[var(--e2),var(--hi)] [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-extrabold uppercase tracking-[.08em] text-ink">
            <Recycle weight="fill" aria-hidden="true" className="text-[var(--b600)]" /> New
          </span>
          <h2 className="mt-3 font-display text-[clamp(24px,2.6vw,32px)] font-extrabold leading-[1.12] [text-wrap:wrap]">
            Your failed prints are somebody&apos;s next switch mount
          </h2>
          <p className="mt-2.5 max-w-[52ch] text-base leading-[1.55]">
            A few organisations run a shredder and an extruder. Bring them 2 kg of clean, sorted
            plastic and they turn it into filament — then credit you the grams to print with on
            their machines. You never handle money and they never handle your word for it: they
            weigh it at the door.
          </p>
          <div className="mt-[18px] flex flex-wrap gap-2.5">
            <Link
              href="/get-involved/recycling"
              className="btn min-h-[52px] bg-ink px-[22px] text-base text-[var(--surface)]"
            >
              <Recycle weight="bold" aria-hidden="true" /> See who takes plastic
            </Link>
            <Link
              href="/get-involved/recycling/drop-off"
              className="btn min-h-[52px] border-[var(--tink)] bg-transparent text-[var(--tink)]"
            >
              Book a drop-off
            </Link>
          </div>
        </div>
        <ol className="m-0 grid min-w-0 list-none gap-2.5 p-0">
          {RECYCLE_STEPS.map((s, i) => (
            <li
              key={s}
              className="flex items-center gap-3 rounded-[18px] bg-[var(--surface)] px-[18px] py-4 text-ink"
            >
              <span
                aria-hidden="true"
                className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[14px] bg-[var(--tmint)] font-display text-sm font-extrabold text-[var(--tink)]"
              >
                {i + 1}
              </span>
              <span className="text-[15px] font-bold leading-[1.45]">{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mb-5 mt-14 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="m-0 font-display text-[30px] font-extrabold leading-[1.1] text-ink">
            Specific things you can do
          </h2>
          <p className="mt-1.5 text-[15px] text-muted">
            Smaller and more concrete. Start from what you need, or what you have.
          </p>
        </div>
        <div aria-hidden="true" className="bob mb-[-6px] mr-3 shrink-0">
          <SplatMascot pose="think" width={96} />
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {GROUPS.map((g) => (
          <section
            key={g.id}
            aria-labelledby={g.id}
            className="flex flex-col gap-3 rounded-card border border-line p-[22px]"
            style={{ background: g.tint }}
          >
            <div className="flex items-center gap-2.5 px-1 pb-1.5">
              <g.icon weight="duotone" aria-hidden="true" className="text-[26px] text-[var(--tink)]" />
              <h3 id={g.id} className="m-0 font-display text-xl font-extrabold text-[var(--tink)]">
                {g.heading}
              </h3>
            </div>
            {g.items.map((c) => (
              <Link
                key={c.label}
                href={c.href as Route}
                className="card-link flex items-center gap-3.5 rounded-[18px] border border-line bg-[var(--surface)] px-4 py-3.5 text-ink shadow-[var(--e1),var(--hi)]"
              >
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--surface2)]"
                >
                  <c.icon weight="duotone" className="text-2xl text-[var(--b600)]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-extrabold">{c.label}</span>
                  <span className="text-sm leading-[1.45] text-muted">{c.blurb}</span>
                </span>
                <ArrowRight weight="bold" aria-hidden="true" className="shrink-0 text-lg text-[var(--b700)]" />
              </Link>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
