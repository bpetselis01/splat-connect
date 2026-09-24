'use client'
/**
 * The five-photo carousel, shown wherever a toy or a guide is read rather than
 * edited: the public toy page and the guide view.
 *
 * A native scroll-snap rail: the browser does the swipe, the momentum and the
 * settle, and the counter and dots just read where it came to rest. No
 * carousel library and no pointer maths.
 *
 * One photo renders as one photo. A gallery's dots, counter and drag are all
 * answers to "which of these am I looking at", and with a single image there
 * is no question to answer.
 *
 * The frame is a 16:10 card at --e2, the board's shape. It used to be a fixed
 * h-72, which on a wide column cropped a portrait photo to a letterbox strip
 * and on a narrow one left it taller than the text beside it. Arrows and a
 * counter came with the ratio: drag is the only way through a gallery on a
 * phone, and on a laptop with a mouse it is no way at all.
 */
import { useRef, useState } from 'react'
import Image from 'next/image'
import { CaretLeft, CaretRight, Package } from '@phosphor-icons/react/dist/ssr'

import { safePhotoSrc } from '@/lib/photo-src'

export function PhotoCarousel({
  urls,
  switchUrl,
  alt,
  className = 'aspect-[16/10]',
}: {
  urls: string[]
  /** Which photo shows the accessibility switch, flagged as it comes past. */
  switchUrl?: string | null
  alt: string
  className?: string
}) {
  const [index, setIndex] = useState(0)
  const rail = useRef<HTMLDivElement>(null)

  if (urls.length === 0) {
    return (
      <div
        data-testid="photo-placeholder"
        className={`grid ${className} w-full place-items-center rounded-card bg-sunken text-muted shadow-e2`}
      >
        <Package weight="duotone" size={48} aria-hidden="true" />
      </div>
    )
  }

  if (urls.length === 1) {
    return (
      <div className={`relative ${className} w-full overflow-hidden rounded-card bg-sunken shadow-e2`}>
        <Image
          src={safePhotoSrc(urls[0]) ?? '/illustrations/adapted-toy.svg'}
          alt={alt}
          fill
          className="object-cover"
        />
      </div>
    )
  }

  // No behaviour here: the rail's motion-safe:scroll-smooth decides, so reduced
  // motion jumps.
  function goTo(next: number) {
    const el = rail.current
    if (el) el.scrollTo({ left: Math.max(0, Math.min(urls.length - 1, next)) * el.clientWidth })
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={alt}
        tabIndex={0}
        className={`relative ${className} w-full overflow-hidden rounded-card bg-sunken shadow-e2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') goTo(index + 1)
          if (e.key === 'ArrowLeft') goTo(index - 1)
        }}
      >
        <div
          ref={rail}
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          className="flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] motion-safe:scroll-smooth [&::-webkit-scrollbar]:hidden"
        >
          {urls.map((url, i) => (
            <div key={url} className="relative h-full w-full shrink-0 snap-center">
              <Image
                src={safePhotoSrc(url) ?? '/illustrations/adapted-toy.svg'}
                alt={urls.length > 1 ? `${alt} — photo ${i + 1} of ${urls.length}` : alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                draggable={false}
              />
              {switchUrl === url && (
                <span className="absolute left-3 top-3 rounded-full border border-line bg-mint-soft px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-ink">
                  Shows the switch
                </span>
              )}
            </div>
          ))}
        </div>

        {/* 46px discs on --surface at --e2, the board's. They sit over the
            photo rather than under it so the frame stays one object. */}
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="carousel-arrow left-3 disabled:pointer-events-none disabled:opacity-0"
        >
          <CaretLeft size={20} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => goTo(index + 1)}
          disabled={index === urls.length - 1}
          className="carousel-arrow right-3 disabled:pointer-events-none disabled:opacity-0"
        >
          <CaretRight size={20} weight="bold" aria-hidden="true" />
        </button>

        <p
          aria-live="polite"
          className="absolute bottom-3 left-3 m-0 rounded-pill bg-surface px-3.5 py-[7px] text-[13px] font-extrabold text-ink shadow-e1"
        >
          {index + 1} / {urls.length}
        </p>
      </div>

      {/* The current dot stretches into a bar rather than changing colour: at
          8px a colour change is the one thing a photograph behind it can hide. */}
      <div role="tablist" aria-label={`Photos of ${alt}`} className="flex items-center justify-center gap-2">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            role="tab"
            aria-label={`Show photo ${i + 1} of ${urls.length}`}
            aria-selected={i === index}
            onClick={() => goTo(i)}
            className="grid h-[30px] min-w-[30px] place-items-center rounded-[var(--radius-field)]"
          >
            <span
              aria-hidden="true"
              className={`block h-2 rounded-pill transition-all duration-200 ${
                i === index ? 'w-6 bg-brand-dark' : 'w-2 bg-line'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
