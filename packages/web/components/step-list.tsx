/**
 * The numbered walkthrough used by every audience track and both submit
 * explainers. An ordered list, so the steps are connected rather than dropped
 * into interchangeable cards — same reasoning as the homepage's how-it-works
 * strip.
 */
export function StepList({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="mt-6 flex flex-col gap-5">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-4">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-deep"
          >
            {i + 1}
          </span>
          <div>
            <h3 className="font-bold text-ink">{step.title}</h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
