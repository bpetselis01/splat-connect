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
 * This is Playroom's quiet register: one backdrop shape, one accent element, and
 * otherwise upright body content. The personality on a page like the privacy
 * policy comes from writing the heading like a human and giving one idea a box —
 * not from tilting the paragraphs.
 */
import { PlayroomBackdrop } from '@/components/playroom-backdrop'
import type { Tone } from '@/lib/tone'

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
    <article className="relative max-w-prose">
      {tone && <PlayroomBackdrop tone={tone} />}
      <h1 className="title-article">{title}</h1>
      {lastUpdated && (
        // Tilted, because it is the one flash of personality a legal page gets.
        <p className="stamp mt-3">Last updated {lastUpdated}</p>
      )}
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-ink">{intro}</p>
      )}
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted [&_h2]:text-lg [&_h2]:font-black [&_h2]:text-ink [&_h3]:font-black [&_h3]:text-ink [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  )
}

/**
 * One idea, given a box.
 *
 * The lever on a prose page is editing, not decoration: pull the single sentence
 * a reader most needs out of the wall of text and let it sit on its own. Used
 * sparingly — more than one on a page and neither stands out.
 */
export function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <p className="pullquote my-2 text-base">{children}</p>
  )
}
