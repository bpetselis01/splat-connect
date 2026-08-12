'use client'
/**
 * Scroll reveal that cannot blank the page.
 *
 * WHY: Writing initial={{ opacity: 0 }} gates content visibility on JS.
 *      Transitions do not fire on hidden tabs, and headless renderers can leave
 *      a section permanently invisible — with 90+ e2e tests asserting on visible
 *      content, a naive reveal reads as a suite-wide regression when it is
 *      really a design defect.
 * HOW: The server renders plain markup. Only after mount, and only for content
 *      sitting below the fold, does this swap in the animated element. Motion is
 *      strictly additive to something already correct.
 *
 * The below-the-fold check is not an optimisation. Hiding an element the visitor
 * is already looking at so it can animate back in is a flash, not a reveal, so
 * anything on screen at mount keeps its plain rendering for good.
 *
 * Related files:
 * - lib/motion.ts: the variants this accepts
 * - app/globals.css: the reduced-motion block covering CSS-driven motion
 */
import { useEffect, useRef, useState } from 'react'
import { LazyMotion, domAnimation, m, useReducedMotion } from 'motion/react'
import type { Variants } from 'motion/react'
import { riseIn } from '@/lib/motion'

export function Reveal({
  children,
  className,
  variants = riseIn,
  /** Seconds. Use lib/motion.ts's stagger() index maths at the call site. */
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  variants?: Variants
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return
    if (el.getBoundingClientRect().top > window.innerHeight) setArmed(true)
  }, [reduced])

  if (!armed) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }

  return (
    // strict forbids the eager `motion.` components, so a stray import cannot
    // quietly pull the full bundle back in past LazyMotion.
    <LazyMotion features={domAnimation} strict>
      <m.div
        ref={ref}
        className={className}
        variants={variants}
        initial="hidden"
        whileInView="shown"
        transition={{ delay }}
        viewport={{ once: true, amount: 0.15 }}
      >
        {children}
      </m.div>
    </LazyMotion>
  )
}
