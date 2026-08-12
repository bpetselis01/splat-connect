'use client'
/**
 * "How it works" — the three steps, with an optional scroll-driven assembly.
 *
 * The markup is the same ordered list it has always been and renders complete
 * without JS: the connector, the numbers and the copy are all server output.
 * GSAP only animates what is already on the page.
 *
 * Scoped to desktop via matchMedia. ScrollTrigger's pinning injects spacer
 * elements and transforms the pinned container, which at phone width both reads
 * badly and moves the heading that reflow.spec.ts measures against the viewport.
 *
 * Numbers are kept because this genuinely is a sequence — first, then, then —
 * not because sections are conventionally numbered.
 *
 * Related files:
 * - app/page.tsx: supplies the steps and renders this
 * - lib/motion.ts: EASE_OUT_QUART, shared with the Motion-driven reveals
 */
import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { EASE_OUT_QUART } from '@/lib/motion'
import type { SVGProps } from 'react'

export type Step = {
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement
  title: string
  desc: string
}

export function HomeSteps({ steps }: { steps: Step[] }) {
  const root = useRef<HTMLOListElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) return
    const el = root.current
    if (!el) return
    if (!window.matchMedia('(min-width: 1024px)').matches) return

    let cleanup: (() => void) | undefined
    let cancelled = false

    // Dynamic import: gsap is ~70kb and this is the only route that uses it.
    void (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)

      const items = Array.from(el.querySelectorAll('[data-step]'))
      const ctx = gsap.context(() => {
        gsap.from(items, {
          // from(), not fromTo(): the resting state is whatever the server
          // rendered, so a failed init leaves the steps correct rather than
          // stuck at opacity 0.
          opacity: 0,
          y: 24,
          duration: 0.5,
          stagger: 0.12,
          ease: `cubic-bezier(${EASE_OUT_QUART.join(',')})`,
          scrollTrigger: { trigger: el, start: 'top 80%', once: true },
        })
      }, el)

      cleanup = () => ctx.revert()
    })()

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [reduced])

  return (
    <ol ref={root} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {steps.map((step, i) => (
        <li key={step.title} data-step className="relative flex gap-4 sm:block">
          {/* Connector between steps — decorative, hidden from the reading order */}
          {i < steps.length - 1 && (
            <span
              aria-hidden="true"
              className="absolute left-6 top-14 hidden h-[calc(100%-2rem)] w-px bg-line sm:left-14 sm:top-6 sm:block sm:h-px sm:w-[calc(100%-2.5rem)]"
            />
          )}
          <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-tint text-2xl text-brand-dark sm:mb-4">
            <step.Icon />
          </span>
          <div>
            <h3 className="font-bold text-ink">
              <span className="text-muted">{i + 1}.</span> {step.title}
            </h3>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
              {step.desc}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
