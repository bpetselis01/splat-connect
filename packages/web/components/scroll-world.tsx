'use client'

/**
 * "How it works", as the board draws it: one camera flight through five scenes,
 * scrubbed by scroll rather than autoplayed.
 *
 * The mechanism is the board's own, measured off it: a tall spacer (1020vh) with
 * a `position: sticky` stage pinned inside it. Scrolling the spacer moves
 * progress from 0 to 1 while the stage stays put, so the page scrolls and the
 * picture does not — the flight is the scroll, which is why it needs no play
 * button and cannot get out of sync with the reader.
 *
 * Scenes are laid out on top of each other and cross-faded; the outgoing one
 * drops back in Z and the incoming one rises, which is what makes it read as a
 * flight rather than a slideshow. One `perspective` on the stage, as the board
 * has.
 *
 * Reduced motion: no transforms, no fades — the scenes become five ordinary
 * stacked blocks and the spacer collapses. Someone who has asked the OS to stop
 * moving things gets a page they can read, not a shorter animation. That is why
 * the reduced-motion branch renders different markup instead of setting a
 * duration to zero.
 *
 * Related files:
 * - app/page.tsx: the only caller
 * - globals.css: .sw-* styles, and the .sw-stage perspective
 */
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, House, Wrench, Printer, FirstAidKit, Gift } from '@phosphor-icons/react/dist/ssr'
import { Slot } from '@/components/slot'

export interface Scene {
  place: string
  title: string
  body: string
  cta: string
  href: Route
  art: string
  icon: 'home' | 'bench' | 'printer' | 'clinic' | 'back'
  tint: string
}

const ICONS = {
  home: House,
  bench: Wrench,
  printer: Printer,
  clinic: FirstAidKit,
  back: Gift,
} as const

/** The board's five, verbatim. */
export const SCENES: Scene[] = [
  {
    place: 'At home',
    title: 'A child finds the toy that won’t play back.',
    body: 'Most toys need a small, precise squeeze. A child with cerebral palsy or low tone may never get the reward of making it go.',
    cta: 'Which switch suits my child?',
    href: '/learn/switch-types' as Route,
    art: 'A child and a toy that will not respond (scene 1 still)',
    icon: 'home',
    tint: 'var(--color-brand-soft)',
  },
  {
    place: 'At the bench',
    title: 'A maker adapts it and writes every step down.',
    body: 'A battery interrupter, a 3.5mm jack, twenty minutes. The guide lists every part, where to buy it, and what to print.',
    cta: 'See a guide',
    href: '/library' as Route,
    art: 'Maker’s workbench, soldering iron (scene 2 still)',
    icon: 'bench',
    tint: 'var(--color-honey-soft)',
  },
  {
    place: 'At the printer',
    title: 'Someone nearby prints the parts that hold it all together.',
    body: 'Switch mounts, battery doors, joystick grips. Every guide lists its printable parts, and anyone with a printer can print them for a family — they give the time and the machine, the family covers the filament, itemised down to the gram.',
    cta: 'Find a printer',
    href: '/printing' as Route,
    art: 'A printer mid-job, switch mount on the bed (scene 3 still)',
    icon: 'printer',
    tint: 'var(--color-apricot-soft)',
  },
  {
    place: 'At the clinic',
    title: 'A therapy service reviews it and puts their name on it.',
    body: 'An occupational therapist checks the safety list and the fit, so a parent knows someone competent read it first.',
    cta: 'Who backs the guides?',
    href: '/organizations' as Route,
    art: 'A therapist reading a guide at a clinic bench (scene 4 still)',
    icon: 'clinic',
    tint: 'var(--color-mint-soft)',
  },
  {
    place: 'Back home',
    title: 'The toy comes home — built, or borrowed.',
    body: 'Follow the guide with about $30 of parts, or request a toy someone nearby has already adapted. Press it. Watch it go.',
    cta: 'Borrow a toy',
    href: '/toy-library' as Route,
    art: 'The adapted toy in use at home (scene 5 still)',
    icon: 'back',
    tint: 'var(--color-violet-soft)',
  },
]

function SceneBody({ scene, index }: { scene: Scene; index: number }) {
  const Icon = ICONS[scene.icon]
  return (
    <div className="sw-scene__inner">
      <div className="sw-scene__art" style={{ backgroundColor: scene.tint }}>
        <Slot kind="art" note={scene.art} className="h-full w-full" />
        <span aria-hidden="true" className="sw-scene__badge">
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="sw-scene__copy">
        <p className="sw-scene__place">
          <span aria-hidden="true" className="sw-scene__num">
            {index + 1}
          </span>
          {scene.place}
        </p>
        <h3 className="sw-scene__title">{scene.title}</h3>
        <p className="sw-scene__body">{scene.body}</p>
        <Link href={scene.href} className="btn btn-quiet no-underline">
          {scene.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  )
}

export function ScrollWorld() {
  const spacer = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  // Starts true so the server render and the first client render agree; the
  // effect corrects it. Rendering the animated branch first would hydrate a
  // moving page for someone who asked for a still one.
  const [reduced, setReduced] = useState(true)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (reduced) return
    const el = spacer.current
    if (!el) return
    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const box = el.getBoundingClientRect()
        // 0 when the spacer's top reaches the viewport top, 1 when its bottom
        // does. Clamped, because the stage is sticky and both ends overshoot.
        const travel = box.height - window.innerHeight
        const seen = Math.min(Math.max(-box.top, 0), travel)
        setProgress(travel > 0 ? seen / travel : 0)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [reduced])

  if (reduced) {
    return (
      <section aria-label="How SPLAT works, as a journey" className="sw-static">
        <p className="eyebrow text-muted">How it works</p>
        {SCENES.map((scene, i) => (
          <SceneBody key={scene.place} scene={scene} index={i} />
        ))}
      </section>
    )
  }

  // Which scene is centred, and how far through it we are.
  const exact = progress * (SCENES.length - 1)
  const active = Math.round(exact)

  return (
    <section
      ref={spacer}
      aria-label="How SPLAT works, as a journey"
      className="sw-spacer"
      style={{ height: `${SCENES.length * 180 + 120}vh` }}
    >
      <div className="sw-stage">
        <p className="sw-kicker eyebrow">How it works · scroll to fly through</p>
        {SCENES.map((scene, i) => {
          const distance = exact - i
          const near = Math.abs(distance) < 1.2
          return (
            <div
              key={scene.place}
              className="sw-scene"
              aria-hidden={active !== i}
              style={{
                opacity: near ? Math.max(0, 1 - Math.abs(distance) * 1.35) : 0,
                transform: `translate3d(0, ${distance * -60}px, ${-Math.abs(distance) * 460}px)`,
                pointerEvents: active === i ? 'auto' : 'none',
              }}
            >
              <SceneBody scene={scene} index={i} />
            </div>
          )
        })}
        <ol className="sw-rail" aria-hidden="true">
          {SCENES.map((scene, i) => (
            <li key={scene.place} className={i === active ? 'is-active' : undefined} />
          ))}
        </ol>
      </div>
    </section>
  )
}
