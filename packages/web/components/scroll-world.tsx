'use client'

/**
 * "How it works", as the board draws it: one camera flight through five scenes,
 * scrubbed by scroll rather than autoplayed.
 *
 * A tall spacer (1020vh) with a `position: sticky` stage pinned inside it.
 * Scrolling the spacer moves progress from 0 to 1 while the stage stays put, so
 * the flight is the scroll and cannot get out of sync with the reader.
 *
 * The motion is the board's paint(), number for number. Each scene owns a fifth
 * of the scroll and holds still and sharp through the middle half of it (the
 * dwell); flying in, it rises from below, small and blurred; flying out, it
 * grows past the camera and blurs away. The camera eases towards the scroll
 * position (12% of the gap per frame) rather than jumping to it, which is what
 * makes a flick of the wheel read as a glide.
 *
 * Styles are written straight onto the scene elements in a rAF loop, not through
 * React state: this runs every frame for as long as the page is scrolling, and
 * re-rendering five scenes 60 times a second to move them is waste.
 *
 * Reduced motion — the OS setting or the header's toggle — is one markup and a
 * CSS switch (globals.css, "reduced flight"): the spacer collapses and the five
 * scenes stack as ordinary blocks. Someone who asked for stillness gets a page
 * they can read, not a slower flight. Rendering the same markup either way is
 * also what keeps the server render and hydration from disagreeing.
 *
 * Related files:
 * - app/page.tsx: the only caller
 * - globals.css: .sw-* styles
 * - components/nav.tsx: publishes --header-h, which the stage pins under
 */
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, HouseLine, Wrench, Cube, SealCheck, Gift } from '@phosphor-icons/react/dist/ssr'
import { Slot } from '@/components/slot'

export interface Scene {
  place: string
  title: string
  body: string
  cta: string
  href: Route
  art: string
  Icon: typeof Gift
  tint: string
}

/** The board's five, verbatim — copy, icons and tints. */
export const SCENES: Scene[] = [
  {
    place: 'At home',
    title: 'A child finds the toy that won’t play back.',
    body: 'Most toys need a small, precise squeeze. A child with cerebral palsy or low tone may never get the reward of making it go.',
    cta: 'Which switch suits my child?',
    // The board sends this to the child-profile wizard, which signs a guest
    // out to /login first. The switch guide answers the question as asked.
    href: '/learn/switch-types' as Route,
    art: 'Cosy living room, child + toy (scene 1 still)',
    Icon: HouseLine,
    tint: 'var(--tcoral)',
  },
  {
    place: 'At the bench',
    title: 'A maker adapts it and writes every step down.',
    body: 'A battery interrupter, a 3.5mm jack, twenty minutes. The guide lists every part, where to buy it, and what to print.',
    cta: 'See a guide',
    href: '/library' as Route,
    art: 'Maker’s workbench, soldering iron (scene 2 still)',
    Icon: Wrench,
    tint: 'var(--tamber)',
  },
  {
    place: 'At the printer',
    title: 'Someone nearby prints the parts that hold it all together.',
    body: 'Switch mounts, battery doors, joystick grips. Every guide lists its printable parts, and anyone with a printer can print them for a family — they give the time and the machine, the family covers the filament, itemised down to the gram. Some of that filament started as somebody else’s failed prints.',
    cta: 'Find a printer',
    href: '/printing' as Route,
    art: '3D printer mid-print, switch mount on the bed (scene 3 still)',
    Icon: Cube,
    tint: 'var(--tviolet)',
  },
  {
    place: 'At the clinic',
    title: 'A therapy service reviews it and puts their name on it.',
    body: 'An occupational therapist checks the safety list and the fit, so a parent knows someone competent read it first.',
    cta: 'Who backs the guides?',
    href: '/impact' as Route,
    art: 'Therapy centre, OT with switch toy (scene 4 still)',
    Icon: SealCheck,
    tint: 'var(--tmint)',
  },
  {
    place: 'Back home',
    title: 'The toy comes home — built, or borrowed.',
    body: 'Follow the guide with about $30 of parts, or request a toy someone nearby has already adapted. Press it. Watch it go.',
    cta: 'Borrow a toy',
    href: '/toy-library' as Route,
    art: 'Child pressing big switch, toy lights up (scene 5 still)',
    Icon: Gift,
    tint: 'var(--b100)',
  },
]

/**
 * One scene's transform at camera position p (0..1). Pure, so the flight can be
 * checked without a browser — see tests/unit/components/scroll-world.test.ts.
 */
export function sceneStyle(p: number, i: number, n: number) {
  const seg = 1 / n
  const raw = (p - i * seg) / seg // 0..1 while this scene owns the scroll
  // The first scene is already in place when the section arrives — no fly-in,
  // so the stage is never blank.
  const dw0 = i === 0 ? 0 : 0.24
  const dw1 = 0.76
  // -1..0 arriving, 0 dwelling, 0..1 leaving
  const local = raw < dw0 ? (raw - dw0) / dw0 : raw > dw1 ? (raw - dw1) / (1 - dw1) : 0
  return {
    scale: local < 0 ? 0.55 + 0.45 * Math.max(0, 1 + local * 1.6) : 1 + local * 1.7,
    opacity: local < 0 ? Math.max(0, 1 + local * 1.8) : Math.max(0, 1 - local * 1.5),
    y: local < 0 ? -local * 220 : -local * 120,
    blur: local < 0 ? Math.min(8, -local * 10) : Math.min(10, local * 14),
    z: local < 0 ? 10 - i : 20 + i,
  }
}

function isReduced() {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.dataset.motion === 'reduced'
  )
}

export function ScrollWorld() {
  const spacer = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const scenes = useRef<(HTMLElement | null)[]>([])
  const dots = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    const el = spacer.current
    const pin = stage.current
    if (!el || !pin) return
    const n = SCENES.length
    let target = 0
    let cur = 0
    let raf = 0

    const paint = (p: number) => {
      scenes.current.forEach((scene, i) => {
        if (!scene) return
        const s = sceneStyle(p, i, n)
        scene.style.transform = `translate3d(0, ${s.y}px, 0) scale(${s.scale})`
        scene.style.opacity = String(s.opacity)
        scene.style.filter = `blur(${s.blur}px)`
        scene.style.zIndex = String(s.z)
        // Past half-faded a scene is not what you are looking at, so it must
        // not take a click or a Tab stop either.
        scene.toggleAttribute('inert', s.opacity <= 0.5)
      })
      if (bar.current) bar.current.style.width = `${(p * 100).toFixed(1)}%`
      const active = Math.min(n - 1, Math.floor(p * n))
      dots.current.forEach((d, i) => d?.classList.toggle('is-active', i === active))
    }

    const tick = () => {
      cur += (target - cur) * 0.12
      if (Math.abs(target - cur) < 0.0005) cur = target
      paint(cur)
      raf = cur === target ? 0 : requestAnimationFrame(tick)
    }

    const measure = () => {
      // The stage pins under the header, so progress starts at the header's
      // edge rather than the window's — the board's `-(r.top - 70)`.
      const top = parseFloat(getComputedStyle(pin).top) || 0
      const travel = el.offsetHeight - window.innerHeight
      target = travel > 0 ? Math.min(1, Math.max(0, (top - el.getBoundingClientRect().top) / travel)) : 0
    }

    const onScroll = () => {
      if (isReduced()) return
      measure()
      if (!raf) raf = requestAnimationFrame(tick)
    }

    // Either flying, or a stack of plain blocks with every inline style and
    // inert flag the flight wrote taken back off.
    const sync = () => {
      cancelAnimationFrame(raf)
      raf = 0
      if (isReduced()) {
        scenes.current.forEach((scene) => {
          scene?.removeAttribute('style')
          scene?.removeAttribute('inert')
        })
        return
      }
      measure()
      cur = target
      paint(cur)
    }

    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const toggle = new MutationObserver(sync)
    toggle.observe(document.body, { attributes: true, attributeFilter: ['data-motion'] })
    query.addEventListener('change', sync)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    sync()
    return () => {
      cancelAnimationFrame(raf)
      toggle.disconnect()
      query.removeEventListener('change', sync)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section ref={spacer} aria-label="How SPLAT works, as a journey" className="sw-spacer">
      <div ref={stage} className="sw-stage">
        <div className="sw-kicker">
          <span className="sw-kicker__label">
            How it works<span className="sw-kicker__hint"> · scroll to fly through</span>
          </span>
          {/* How far through the flight you are. A 1020vh section with no
              progress read reads as a page that has stopped responding. */}
          <span className="sw-progress" aria-hidden="true">
            <span ref={bar} />
          </span>
        </div>

        {SCENES.map(({ place, title, body, cta, href, art, Icon, tint }, i) => (
          <article
            key={place}
            ref={(node) => {
              scenes.current[i] = node
            }}
            className="sw-scene"
            // Before the script runs only the first scene is on stage; the
            // rest wait out of reach. sync() owns this from then on.
            inert={i > 0}
          >
            <div className="sw-scene__inner">
              <div className="sw-scene__art" style={{ backgroundColor: tint }}>
                {/* Transparent and square-cornered: the tinted card IS the art
                    frame here, so the slot contributes only its dashed brief. */}
                <Slot kind="art" note={art} className="h-full w-full !rounded-none !border-0 !bg-transparent" />
                <span aria-hidden="true" className="sw-scene__badge">
                  <Icon weight="duotone" />
                </span>
              </div>
              <div className="sw-scene__copy">
                <p className="sw-scene__place">
                  <span aria-hidden="true" className="sw-scene__num">
                    {i + 1}
                  </span>
                  {place}
                </p>
                <h2 className="sw-scene__title">{title}</h2>
                <p className="sw-scene__body">{body}</p>
                <Link href={href} className="sw-scene__cta">
                  {cta}
                  <ArrowRight weight="bold" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </article>
        ))}

        <ol className="sw-rail" aria-hidden="true">
          {SCENES.map((scene, i) => (
            <li
              key={scene.place}
              ref={(node) => {
                dots.current[i] = node
              }}
              className={i === 0 ? 'is-active' : undefined}
            />
          ))}
        </ol>
      </div>
    </section>
  )
}
