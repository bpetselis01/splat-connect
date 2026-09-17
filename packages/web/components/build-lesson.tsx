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
 * a reader might want against each step is the lesson's own "Mark as done" in
 * the shell, and per-step ticks on a nine-step page are a lot of state for
 * something read once.
 *
 * Related files:
 * - lib/learn-content.json: every field below
 * - components/learn-shell.tsx: the outline and the next-lesson control
 */
import Image from 'next/image'
import { Warning, Lightbulb, Check } from '@phosphor-icons/react/dist/ssr'

export type BuildStep = {
  title: string
  body: string
  tip?: string
  warn?: string
  imgs?: Array<{ src: string; alt: string }>
}

export type BuildMaterial = {
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
  facts: Array<{ k: string; v: string }>
  note?: string
  materials: BuildMaterial[]
  tools: string[]
  steps: BuildStep[]
  doneTitle: string
  doneBody: string
}

export function BuildLesson({ lesson, title }: { lesson: BuildLesson; title: string }) {
  return (
    <div>
      <h1 className="mt-1.5 title-article">{title}</h1>

      <dl className="mt-4 flex flex-wrap gap-2">
        {lesson.facts.map((f) => (
          <div key={f.k} className="rounded-pill bg-sunken px-3 py-1.5">
            <dt className="inline text-xs font-bold text-muted">{f.k}: </dt>
            <dd className="inline text-xs font-bold text-ink">{f.v}</dd>
          </div>
        ))}
      </dl>

      {lesson.hero ? (
        <div className="relative mt-5 aspect-[3/2] w-full overflow-hidden rounded-card bg-sunken">
          <Image
            src={lesson.hero}
            alt={lesson.heroAlt ?? ''}
            fill
            sizes="(min-width: 1024px) 48rem, 100vw"
            className="object-cover"
            priority
          />
        </div>
      ) : (
        lesson.slotPh && (
          // The one lesson whose hero the workshop never photographed. Saying
          // what the picture WOULD be is more use than a grey rectangle.
          <p className="mt-5 rounded-card border border-dashed border-line bg-sunken px-5 py-8 text-center text-sm text-muted">
            {lesson.slotPh}
          </p>
        )
      )}

      {lesson.note && (
        <p className="mt-5 flex items-start gap-2 rounded-card bg-honey-soft px-5 py-4 text-sm leading-relaxed text-ink">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {lesson.note}
        </p>
      )}

      {/*
        One section, not two. The board puts the shopping list and the bench
        list under a single "You will need", with the tools as an h3 inside it —
        a builder reads them together, and splitting them into sibling h2s made
        the page claim two topics where the design has one.
      */}
      <section className="mt-10">
        <h2 className="title-detail">You will need</h2>
        {/*
          A table, because this is tabular data and the board draws it as one:
          PART | WHAT IT IS | WHERE · QTY · COST. Live had it as a list of
          cards, which reads fine down a phone and stops a builder comparing
          two rows — the thing you actually do with a shopping list. It also
          gives a screen reader column headers it did not have.

          The photo stays inside the first cell rather than taking a fourth
          column, so the shape still matches the board's three.
        */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Part</th>
                <th scope="col" className="eyebrow pb-2 pr-3 text-muted">What it is</th>
                <th scope="col" className="eyebrow whitespace-nowrap pb-2 text-right text-muted">
                  Where · Qty · Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {lesson.materials.map((m) => (
                <tr key={m.item} className="border-b border-line align-top last:border-0">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-3">
                      {m.img && (
                        <span className="relative hidden h-12 w-12 shrink-0 overflow-hidden rounded-field bg-sunken sm:block">
                          <Image src={m.img} alt="" fill sizes="48px" className="object-cover" />
                        </span>
                      )}
                      <span className="font-bold text-ink">{m.item}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-sm leading-relaxed text-muted">{m.why}</td>
                  <td className="py-3 text-right">
                    <span className="block font-mono text-sm font-bold tabular-nums text-ink">
                      {m.cost}
                    </span>
                    <span className="block text-xs text-muted">
                      {m.qty} · {m.shop}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-[19px] font-extrabold text-ink">Tools for this build</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {lesson.tools.map((t) => (
            <span key={t} className="badge bg-sunken text-brand-deep">
              {t}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="title-detail">Step by step</h2>
        <ol className="mt-4 flex list-none flex-col gap-8">
          {lesson.steps.map((step, i) => (
            <li key={step.title}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-dark font-display text-sm font-extrabold text-white"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="title-section">{step.title}</h3>
                  <p className="mt-1 max-w-prose text-base leading-relaxed text-ink">{step.body}</p>

                  {step.warn && (
                    <p className="mt-3 flex items-start gap-2 rounded-card bg-danger-soft px-4 py-3 text-sm leading-relaxed text-ink">
                      <Warning className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                      {step.warn}
                    </p>
                  )}
                  {step.tip && (
                    <p className="mt-3 flex items-start gap-2 rounded-card bg-sunken px-4 py-3 text-sm leading-relaxed text-muted">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      {step.tip}
                    </p>
                  )}

                  {step.imgs && step.imgs.length > 0 && (
                    <div
                      className={`mt-4 grid gap-3 ${step.imgs.length > 1 ? 'sm:grid-cols-2' : ''}`}
                    >
                      {step.imgs.map((img) => (
                        <figure key={img.src}>
                          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card bg-sunken">
                            <Image
                              src={img.src}
                              alt={img.alt}
                              fill
                              sizes="(min-width: 640px) 24rem, 100vw"
                              className="object-cover"
                            />
                          </div>
                        </figure>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="card mt-10 flex items-start gap-4 p-6">
        <span aria-hidden="true" className="empty-badge shrink-0 text-brand-deep">
          <Check className="h-7 w-7" />
        </span>
        <div>
          <p className="font-display text-xl font-extrabold text-ink">{lesson.doneTitle}</p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{lesson.doneBody}</p>
        </div>
      </div>
    </div>
  )
}
