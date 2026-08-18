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
import { BookOpen } from '@/components/icons'
import { NotifyForm } from '@/components/notify-form'

export function ComingSoon({
  label,
  description,
  steps,
  featureKey,
}: {
  label: string
  description: string
  steps: string[]
  /** When set, the page offers to notify. Omit for a plain placeholder. */
  featureKey?: string
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="card flex flex-col items-center px-6 py-10 text-center">
        <span aria-hidden="true" className="empty-badge text-brand-deep">
          <BookOpen className="h-8 w-8" />
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
