'use client'
import { useEffect, useRef } from 'react'

/**
 * A figure that counts up from zero once, the board's hero counters: 150ms in,
 * 1.4s with an ease-out cubic.
 *
 * The server renders the real number, so a reader without JavaScript — or a
 * screen reader landing before the animation — never meets a zero. The count
 * starts after hydration, inside the hero copy's own fade-in, which is what
 * hides the snap from the real figure back to 0.
 *
 * Writes textContent directly rather than through state: it is 80-odd frames of
 * one text node, and the last frame puts the server's own string back so the
 * locale formatting can never differ from what was rendered.
 */
export function CountUp({ to, children }: { to: number; children: string }) {
  const node = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = node.current
    if (!el || to <= 0) return
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.body.dataset.motion === 'reduced'
    if (reduced) return

    const final = el.textContent
    let raf = 0
    el.textContent = '0'
    const timer = window.setTimeout(() => {
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 1400)
        const eased = 1 - Math.pow(1 - k, 3)
        el.textContent = k < 1 ? Math.round(to * eased).toLocaleString() : final
        if (k < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, 150)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      el.textContent = final
    }
  }, [to])

  return <span ref={node}>{children}</span>
}
