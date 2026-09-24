/**
 * A build lesson: facts, what to buy, what to have out, and numbered steps with
 * the workshop's own photographs.
 *
 * Data-driven from lib/learn-content.json, which is the artboard's own lesson
 * tables rather than prose re-authored from them — these steps were written at
 * a bench with a camera, and the photographs are of the actual toys. Rewriting
 * them would have meant inventing the parts of a procedure nobody had performed.
 *
 * A server component. There is nothing interactive in a procedure: the checkbox
 * a reader might want against each step is the lesson's own "Done" button in
 * the shell, and per-step ticks on a nine-step page are a lot of state for
 * something read once.
 *
 * Related files:
 * - lib/learn-content.json: every field below
 * - components/learn-shell.tsx: the outline and the next-lesson control
 */
import Image from 'next/image'
import Link from 'next/link'
import { Lightbulb, Warning, Wrench, Copyright, Confetti } from '@phosphor-icons/react/dist/ssr'
import { KitTable, LessonH2, PhotoSlot } from '@/components/lesson-kit'

type BuildStep = {
  title: string
  body: string
  tip?: string
  warn?: string
  imgs?: Array<{ src: string; alt: string }>
  /** A photo the workshop has not taken yet: what it will show. */
  slotPh?: string
}

type BuildMaterial = {
  item: string
  why: string
  shop: string
  qty: string
  cost: string
  img?: string
}

export type BuildLesson = {
  hero?: string
  heroAlt?: string
  /** A placeholder where the artboard had a photo slot rather than a photo. */
  slotPh?: string
  /** Attribution for a build adapted from somebody else's published guide. */
  credit?: string
  facts: Array<{ k: string; v: string }>
  note?: string
  materials: BuildMaterial[]
  tools: string[]
  steps: BuildStep[]
  doneTitle: string
  doneBody: string
}

/** The body of a build lesson. The shell above it owns the title and lede. */
export function BuildLesson({ lesson }: { lesson: BuildLesson }) {
  return (
    <div>
      {lesson.hero ? (
        <div className="relative mt-[30px] aspect-[2/1] w-full overflow-hidden rounded-card border border-line bg-sunken shadow-[var(--e2)]">
          <Image
            src={lesson.hero}
            alt={lesson.heroAlt ?? ''}
            fill
            sizes="(min-width: 1024px) 880px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      ) : (
        lesson.slotPh && (
          <PhotoSlot
            label={lesson.slotPh}
            className="mt-[30px] aspect-[2/1] w-full rounded-card border border-line shadow-[var(--e2)]"
          />
        )
      )}

      {lesson.credit && (
        <p className="mt-3.5 text-[13px] font-semibold leading-normal text-muted">
          <Copyright weight="bold" className="mr-1.5 inline align-[-2px]" aria-hidden="true" />
          {lesson.credit}
        </p>
      )}

      <dl className="mt-7 grid gap-3.5 sm:grid-cols-3">
        {lesson.facts.map((f) => (
          <div
            key={f.k}
            className="min-w-0 rounded-[var(--radius-inset)] border border-line bg-surface px-[18px] py-4 shadow-[var(--e1)]"
          >
            <dt className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted">{f.k}</dt>
            <dd className="mt-1 font-display text-lg font-extrabold leading-[1.2] text-ink">{f.v}</dd>
          </div>
        ))}
      </dl>

      {/*
        One section, not two. The board puts the shopping list and the bench
        list under a single "You will need", with the tools as an h3 inside it —
        a builder reads them together.
      */}
      <section>
        <LessonH2 className="mb-2.5 mt-9">You will need</LessonH2>
        <p className="mb-3.5 text-[15px] text-muted">
          On top of the general equipment and consumables from{' '}
          <Link href="/learn/tools-and-materials">Unit 2</Link>.
        </p>
        <KitTable rows={lesson.materials} head={['Part', 'What it is', 'Where · qty · cost']} />

        {lesson.tools.length > 0 && (
          <>
            <h3 className="mb-2.5 mt-[22px] font-display text-[19px] font-extrabold text-ink">
              Tools for this build
            </h3>
            <ul className="flex list-none flex-wrap gap-2 p-0">
              {lesson.tools.map((t) => (
                <li key={t} className="course-meta px-3.5 py-[9px] text-sm">
                  <Wrench weight="bold" className="text-apricot" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </>
        )}

        {lesson.note && (
          <p className="mt-[22px] rounded-[var(--radius-inset)] border border-line bg-[var(--tamber)] px-[22px] py-[18px] font-bold leading-[1.55] text-[var(--tink)]">
            <Lightbulb weight="fill" className="mr-2 inline align-[-2px]" aria-hidden="true" />
            {lesson.note}
          </p>
        )}
      </section>

      <section>
        <LessonH2 className="mb-1.5 mt-10">Step by step</LessonH2>
        <p className="mb-[18px] text-[15px] text-muted">
          Batteries out, glasses on, fan running. Read the whole step before you start it.
        </p>
        <ol className="flex list-none flex-col gap-4 p-0">
          {lesson.steps.map((step, i) => (
            <li
              key={step.title}
              className="grid grid-cols-[52px_minmax(0,1fr)] gap-4 rounded-card border border-line bg-surface px-6 pb-6 pt-[22px] shadow-[var(--e2),var(--hi)]"
            >
              <span
                aria-hidden="true"
                className="grid h-11 w-11 place-items-center rounded-full bg-brand-dark font-display text-lg font-extrabold text-white shadow-[var(--glow)]"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="my-2 font-display text-[21px] font-extrabold leading-[1.2] text-ink">{step.title}</h3>
                <p className="leading-[1.6] text-ink [text-wrap:pretty]">{step.body}</p>

                {step.tip && (
                  <p className="mt-3 rounded-[var(--radius-field)] border border-line bg-brand-50 px-4 py-3 text-[15px] leading-normal text-ink">
                    <strong className="text-brand-deep">Tip.</strong> {step.tip}
                  </p>
                )}
                {step.warn && (
                  <p className="mt-3 rounded-[var(--radius-field)] border border-line bg-[var(--tbad)] px-4 py-3 text-[15px] font-bold leading-normal text-[var(--tink)]">
                    <Warning weight="fill" className="mr-1.5 inline align-[-2px] text-danger" aria-hidden="true" />
                    {step.warn}
                  </p>
                )}

                {step.imgs && step.imgs.length > 0 && (
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                    {step.imgs.map((img) => (
                      <div
                        key={img.src}
                        className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-inset)] border border-line bg-sunken"
                      >
                        <Image src={img.src} alt={img.alt} fill sizes="(min-width: 1024px) 360px, 100vw" className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {step.slotPh && (
                  <PhotoSlot
                    label={step.slotPh}
                    className="mt-4 aspect-[16/7] w-full rounded-[var(--radius-inset)] border border-line"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-7 flex items-center gap-4 rounded-card border border-line bg-[var(--tok)] px-[26px] py-6">
        <Confetti size={40} weight="fill" className="flex-none text-success" aria-hidden="true" />
        <div>
          <h3 className="mb-1 font-display text-[21px] font-extrabold text-[var(--tink)]">{lesson.doneTitle}</h3>
          <p className="leading-[1.55] text-[var(--tink)]">{lesson.doneBody}</p>
        </div>
      </div>
    </div>
  )
}
