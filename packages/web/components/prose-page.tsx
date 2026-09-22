/**
 * The long-form page frame: trust pages and articles.
 *
 * Measure is capped at ~68 characters via max-w-prose because these are the only
 * pages on the site people actually read top to bottom, and the 6xl layout
 * container is far too wide for that.
 *
 * Left-aligned rather than centred. It was centred, which left it floating in the
 * middle of a 6xl container with a gutter on both sides while every hub page on
 * the site started at the left edge. Aligning it means the breadcrumb the layout
 * renders above it lines up with the heading, and the backdrop shapes have a side
 * of the page to occupy.
 *
 * This is Pixel's quiet register: one backdrop shape, one accent element, and
 * otherwise upright body content. The personality on a page like the privacy
 * policy comes from writing the heading like a human and giving one idea a box —
 * not from tilting the paragraphs.
 *
 * Quiet is a matter of how much is on the page, not of which language it is
 * drawn in. The stamp and the pull quote carry the same borders and hard
 * shadows as a card on the homepage; there are simply two of them on a page
 * instead of twenty.
 */
import { Info } from '@phosphor-icons/react/dist/ssr'
import { PixelBackdrop } from '@/components/pixel-backdrop'
import { LegalSiblings } from '@/components/legal-siblings'
import type { Tone } from '@/lib/tone'

/*
 * Drawn as the board's one "Policy document" layout, which every legal page
 * shares: a LEGAL eyebrow, the title, the intro as a lead, the date as a mono
 * meta line, the one boxed idea as an amber callout, then plain sections and
 * the row of sibling policies. Style only — the wording lives in each page and
 * is not this component's to change (docs/REGULATORY-CHANGES.md).
 */
export function ProsePage({
  title,
  lastUpdated,
  intro,
  tone,
  children,
}: {
  title: string
  /** Trust pages only. Articles omit it. */
  lastUpdated?: string
  intro?: string
  /** The section's colour, when the page belongs to one. */
  tone?: Tone
  children: React.ReactNode
}) {
  return (
    <article className="relative max-w-[760px]">
      {tone && <PixelBackdrop tone={tone} />}
      <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Legal</span>
      <h1 className="mt-2.5 font-display text-[clamp(30px,3.4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        {title}
      </h1>
      {intro && (
        <p className="mt-3.5 text-lg leading-[1.6] text-muted [text-wrap:pretty]">{intro}</p>
      )}
      {lastUpdated && (
        <p className="mt-4 font-mono text-xs font-medium text-muted">Last updated {lastUpdated}</p>
      )}
      <div className="mt-[34px] flex flex-col gap-[30px] text-base leading-[1.65] text-ink [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-[23px] [&_h2]:font-extrabold [&_h2]:text-ink [&_h3]:mt-4 [&_h3]:font-display [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:text-ink [&_li]:mt-1.5 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:font-semibold [&_a]:text-[var(--b700)] [&_a:hover]:underline">
        {children}
      </div>
      <LegalSiblings />
    </article>
  )
}

/**
 * One idea, given a box — the board's amber callout.
 *
 * The lever on a prose page is editing, not decoration: pull the single sentence
 * a reader most needs out of the wall of text and let it sit on its own. Used
 * sparingly — more than one on a page and neither stands out.
 */
export function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <p className="-mt-1 flex items-start gap-2 rounded-[var(--radius-inset)] border border-line bg-[var(--tamber)] px-[22px] py-5 font-bold text-[var(--tink)]">
      <Info size={18} weight="fill" className="mt-1 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
