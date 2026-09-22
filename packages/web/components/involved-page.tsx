/**
 * The pieces every Get involved explainer is built from, as the board draws
 * them: the brand eyebrow and 46px heading, the icon-disc flow, the tinted
 * note, and the numbered step cards the three track pages use.
 *
 * Server-safe: icons are passed in as Phosphor SSR components.
 */
import type { ReactNode } from 'react'
import type { Icon } from '@phosphor-icons/react'

export function InvolvedIntro({
  title,
  lead,
  eyebrow = 'Get Involved',
}: {
  title: string
  lead?: ReactNode
  eyebrow?: string
}) {
  return (
    <>
      <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-brand">{eyebrow}</span>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink">
        {title}
      </h1>
      {lead && (
        <p className="mt-4 max-w-[60ch] text-[19px] leading-[1.6] text-muted [text-wrap:pretty]">{lead}</p>
      )}
    </>
  )
}

export type FlowStep = { t: string; d: string; icon: Icon; tint: string }

/** The icon-disc flow: what happens, in order, with no card around each step. */
export function FlowSteps({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="mt-[34px] flex list-none flex-col p-0">
      {steps.map((s) => (
        <li key={s.t} className="grid grid-cols-[auto_1fr] gap-5 pb-[26px]">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-full text-[var(--tink)]"
            style={{ background: s.tint }}
          >
            <s.icon weight="bold" className="text-xl" />
          </span>
          <span>
            <span className="mb-1 block font-display text-xl font-extrabold text-ink">{s.t}</span>
            <span className="block max-w-[58ch] text-[15px] leading-[1.55] text-muted">{s.d}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** A tinted aside under a flow: the one thing to know before starting. */
export function TintNote({
  title,
  children,
  tint = 'var(--tamber)',
}: {
  title: string
  children: ReactNode
  tint?: string
}) {
  return (
    <div className="mt-3.5 rounded-card border border-line px-[26px] py-6 text-[var(--tink)]" style={{ background: tint }}>
      <h2 className="mb-2 font-display text-xl font-extrabold">{title}</h2>
      <div className="text-[15px] leading-[1.6]">{children}</div>
    </div>
  )
}

/** The secondary button the explainers pair with a primary: surface, hairline, 52px. */
export const SECONDARY_BTN = 'btn min-h-[52px] border-line bg-[var(--surface)] px-6 text-base text-ink'

/** "Free forever" under a sign-in CTA, as the board sets it. */
export function FreeForever() {
  return <p className="mt-3 text-[13px] font-semibold text-muted">Free forever. No card, no newsletter.</p>
}

/** The track pages' numbered steps: one card per step, a 44px number tile. */
export function NumberedSteps({ steps }: { steps: [string, string][] }) {
  return (
    <ol className="mt-9 flex list-none flex-col gap-3.5 p-0">
      {steps.map(([t, d], i) => (
        <li key={t} className="card flex gap-4 px-6 py-[22px]">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[var(--b100)] font-display text-[19px] font-extrabold text-[var(--b700)]"
          >
            {i + 1}
          </span>
          <span>
            <span className="mb-[5px] block font-display text-[19px] font-extrabold text-ink">{t}</span>
            <span className="block text-[15px] leading-[1.55] text-muted">{d}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** The closing panel on a track page: one action, on --b50. */
export function TrackCta({
  title,
  body,
  children,
}: {
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <div className="mt-[34px] rounded-card border border-line bg-[var(--b50)] p-[26px]">
      <h2 className="mb-2 font-display text-[22px] font-extrabold text-ink">{title}</h2>
      <p className="mb-[18px] text-[15px] text-muted">{body}</p>
      {children}
    </div>
  )
}
