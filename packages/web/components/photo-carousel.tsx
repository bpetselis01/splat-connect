'use client'
/**
 * The five-photo carousel, shown wherever a toy or a guide is read rather than
 * edited: the public toy page and the guide view.
 *
 * Drag-follows-finger, then settles on the nearest photo with a spring
 * (--spring-photo). No carousel library: the whole behaviour is a rail with a
 * transform on it, and the one piece of real logic — where a release lands —
 * is four lines and is the thing worth testing.
 *
 * One photo renders as one photo. A gallery's dots, counter and drag are all
 * answers to "which of these am I looking at", and with a single image there
 * is no question to answer.
 */
import { useRef, useState } from 'react'
import Image from 'next/image'

/** A release past this much of the frame commits to the next photo. */
const COMMIT_FRACTION = 1 / 3
/** Past an end there is nothing to reveal, so the rail resists rather than moves. */
const RUBBER_BAND = 0.32

export function PhotoCarousel({
  urls,
  switchUrl,
  alt,
  className = 'h-72',
}: {
  urls: string[]
  /** Which photo shows the accessibility switch, flagged as it comes past. */
  switchUrl?: string | null
  alt: string
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  // State rather than a ref: the rail's transition is switched off while the
  // finger is down, and that is read during render.
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const frame = useRef<HTMLDivElement>(null)

  if (urls.length === 0) {
    return (
      <div className={`flex ${className} items-center justify-center rounded-2xl bg-brand-tint text-6xl`}>
        🧸
      </div>
    )
  }

  if (urls.length === 1) {
    return (
      <div className={`relative ${className} w-full overflow-hidden rounded-2xl bg-sunken`}>
        <Image src={urls[0]} alt={alt} fill className="object-cover" />
      </div>
    )
  }

  const width = () => frame.current?.clientWidth ?? 1

  function goTo(next: number) {
    setIndex(Math.max(0, Math.min(urls.length - 1, next)))
    setDragX(0)
  }

  function onPointerDown(e: React.PointerEvent) {
    setDragging(true)
    startX.current = e.clientX
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return
    const dx = e.clientX - startX.current
    // At either end the rail gives, but only a little: the resistance is what
    // says "nothing that way" without a message saying it.
    const atEnd = (index === 0 && dx > 0) || (index === urls.length - 1 && dx < 0)
    setDragX(atEnd ? dx * RUBBER_BAND : dx)
  }

  function onPointerUp() {
    if (!dragging) return
    setDragging(false)
    const committed = Math.abs(dragX) > width() * COMMIT_FRACTION
    goTo(committed ? index - Math.sign(dragX) : index)
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frame}
        role="group"
        aria-roledescription="carousel"
        aria-label={alt}
        tabIndex={0}
        className={`relative ${className} w-full touch-pan-y overflow-hidden rounded-2xl bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(index + 1)
          if (e.key === 'ArrowLeft') goTo(index - 1)
        }}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(calc(${-index * 100}% + ${dragX}px), 0, 0)`,
            // No transition while the finger is down — the rail is following it,
            // not animating towards it.
            transition: dragging ? 'none' : 'transform var(--spring-photo)',
          }}
        >
          {urls.map((url, i) => (
            <div key={url} className="relative h-full w-full shrink-0">
              <Image
                src={url}
                alt={urls.length > 1 ? `${alt} — photo ${i + 1} of ${urls.length}` : alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                draggable={false}
              />
              {switchUrl === url && (
                <span className="absolute left-3 top-3 rounded-full border-2 border-ink bg-mint-soft px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-mint-deep">
                  Shows the switch
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            aria-label={`Photo ${i + 1}`}
            aria-current={i === index}
            onClick={() => goTo(i)}
            className={`h-2.5 w-2.5 rounded-full border-2 border-ink transition-colors ${
              i === index ? 'bg-apricot' : 'bg-surface'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
