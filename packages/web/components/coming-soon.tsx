/**
 * Placeholder for a route whose feature has not shipped.
 *
 * Ported from packages/mobile/components/coming-soon.tsx, which states the bar
 * this has to clear: a bare "coming soon" sentence was most of what a new
 * parent saw, so it now explains what the feature will do and routes to the
 * part of the app that already works rather than dead-ending.
 *
 * Copy for /toy-library and /printing is reused verbatim from the mobile tabs
 * so a parent reads the same sentence on both surfaces.
 *
 * Diverges from mobile here: the web surface can also capture interest via
 * `featureKey` (see notify-form.tsx), so build order becomes a ranked list
 * instead of a guess. Mobile has no such form, and stays on the plain
 * "{label} is coming soon." heading — leave it untouched.
 */
import Link from 'next/link'
import type { Route } from 'next'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { BookOpen } from '@phosphor-icons/react/dist/ssr'
import { NotifyForm } from '@/components/notify-form'

export function ComingSoon({
  label,
  description,
  steps,
  featureKey,
  alternatives,
  icon: Glyph,
}: {
  label: string
  description: string
  steps: string[]
  /** When set, the page offers to notify. Omit for a plain placeholder. */
  featureKey?: string
  /**
   * Opt-in to the board's "Not built yet" screen: a tinted glyph tile, a
   * NOT BUILT YET pill, the notify row, and these as "In the meantime" links
   * in place of the steps. Callers without it keep the plan layout below.
   */
  alternatives?: Array<{ label: string; href: Route }>
  icon?: PhosphorIcon
}) {
  if (alternatives) {
    return (
      <div className="mx-auto max-w-[640px] py-14 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid h-[88px] w-[88px] place-items-center rounded-card bg-[var(--tviolet)] text-[var(--tink)]"
          style={{ boxShadow: 'var(--shadow-e2)' }}
        >
          {Glyph ? <Glyph size={44} weight="duotone" /> : <BookOpen className="h-11 w-11" weight="bold" aria-hidden="true" />}
        </span>
        <span className="mt-[22px] inline-block rounded-pill border border-line bg-sunken px-3.5 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
          Not built yet
        </span>
        <h1 className="mt-4 font-display text-[clamp(30px,3.4vw,42px)] font-extrabold leading-[1.1] tracking-[-0.02em] text-ink">
          {label}
        </h1>
        <p className="mt-3.5 text-lg leading-[1.6] text-muted">{description}</p>
        {featureKey && <NotifyForm featureKey={featureKey} pill />}
        <div className="mt-10 border-t border-line pt-7">
          <p className="mb-3.5 text-[15px] text-muted">In the meantime</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {alternatives.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex min-h-11 items-center rounded-pill border border-line bg-surface px-[18px] text-[15px] font-bold text-ink hover:shadow-[var(--shadow-e2)]"
                style={{ boxShadow: 'var(--shadow-e1)' }}
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card flex flex-col items-center px-6 py-10 text-center">
        <span aria-hidden="true" className="empty-badge text-brand-deep">
          <BookOpen className="h-8 w-8" weight="bold" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-ink">{label}</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          <strong className="text-ink">Not built yet</strong> — here&apos;s the plan.
        </p>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
        {featureKey && (
          <div className="w-full max-w-md">
            <NotifyForm featureKey={featureKey} />
          </div>
        )}
      </div>

      {steps.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-ink">How it will work</h2>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep"
                >
                  {i + 1}
                </span>
                <span className="text-sm leading-relaxed text-ink">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-10 text-center">
        <p className="mb-3 text-sm text-muted">In the meantime, Guides is ready to use.</p>
        <Link href="/library" className="btn btn-accent">
          Guides
        </Link>
      </div>
    </div>
  )
}
