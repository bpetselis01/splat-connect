/**
 * The split composition behind /login and /signup.
 *
 * These two routes are in BARE_PREFIXES (app/layout.tsx), so they never get the
 * signed-in rail — which left them as a lone card on an empty canvas, the least
 * finished-looking surfaces on the site despite being where every account
 * starts.
 *
 * The brand panel is decorative and hidden below md: on a phone the form should
 * own the viewport, not share it with a value proposition the visitor has
 * already been sold on by getting here.
 *
 * Purely presentational. No field, label, button text or submit behaviour lives
 * here — four e2e specs cover those flows and none of them should notice this.
 */
import { Logo } from '@/components/icons'

export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string
  intro?: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="mx-auto mt-4 max-w-4xl sm:mt-10">
      <div className="grid overflow-hidden rounded-2xl border border-line bg-surface shadow-rest md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div
          aria-hidden="true"
          className="hidden flex-col justify-between bg-brand-deep p-8 md:flex"
        >
          <span className="flex items-center gap-2 font-bold text-white">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
              <Logo className="h-5 w-5" />
            </span>
            SPLAT Connect
          </span>
          <div>
            <p className="text-xl font-bold leading-snug text-white">
              Every child deserves to play.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-brand-soft">
              Free guides for switch-adapting the toys children already love,
              written by the families and therapists who worked them out.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-ink">{title}</h1>
          {intro && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{intro}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>
      <div className="mt-4 text-center text-sm text-muted">{footer}</div>
    </div>
  )
}
