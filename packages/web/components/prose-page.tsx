/**
 * The long-form page frame: trust pages and Learn articles.
 *
 * Measure is capped at ~68 characters via max-w-prose because these are the only
 * pages on the site people actually read top to bottom, and the 6xl layout
 * container is far too wide for that.
 */
export function ProsePage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string
  /** Trust pages only. Learn articles omit it. */
  lastUpdated?: string
  intro?: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-prose">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
      {lastUpdated && (
        <p className="mt-2 text-sm text-muted">Last updated {lastUpdated}</p>
      )}
      {intro && (
        <p className="mt-4 text-base leading-relaxed text-ink">{intro}</p>
      )}
      <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-muted [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:font-bold [&_h3]:text-ink [&_li]:mt-1.5 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </article>
  )
}
