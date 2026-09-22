'use client'
import { useState } from 'react'
import { Sun, Moon, CircleHalf, PersonSimpleRun, PersonSimple } from '@phosphor-icons/react/dist/ssr'
import { MODE_COOKIE, MOTION_COOKIE, type Mode, type Motion } from '@/lib/display-prefs'

const YEAR = 60 * 60 * 24 * 365

function persist(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${YEAR}; samesite=lax`
}

const MODES: { mode: Mode; label: string; Icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light mode', Icon: Sun },
  { mode: 'dark', label: 'Dark mode', Icon: Moon },
  { mode: 'hc', label: 'High contrast mode', Icon: CircleHalf },
]

/**
 * The board's colour-mode segment and reduce-motion button. Each writes a body
 * attribute that globals.css keys every token off, plus a cookie so the next
 * server render starts in the same state (lib/display-prefs.ts).
 */
export function DisplayToggles({ mode: initialMode, motion: initialMotion }: { mode: Mode; motion: Motion }) {
  const [mode, setMode] = useState(initialMode)
  const [motion, setMotion] = useState(initialMotion)

  function chooseMode(next: Mode) {
    setMode(next)
    if (next === 'light') document.body.removeAttribute('data-mode')
    else document.body.setAttribute('data-mode', next)
    persist(MODE_COOKIE, next)
  }

  function toggleMotion() {
    const next: Motion = motion === 'reduced' ? 'full' : 'reduced'
    setMotion(next)
    if (next === 'full') document.body.removeAttribute('data-motion')
    else document.body.setAttribute('data-motion', next)
    persist(MOTION_COOKIE, next)
  }

  const reduced = motion === 'reduced'
  const MotionIcon = reduced ? PersonSimple : PersonSimpleRun

  return (
    <>
      <div role="group" aria-label="Colour mode" className="mode-group">
        {MODES.map(({ mode: m, label, Icon }) => (
          <button
            key={m}
            type="button"
            aria-label={label}
            aria-pressed={mode === m}
            title={label.replace(' mode', '')}
            onClick={() => chooseMode(m)}
          >
            <Icon aria-hidden="true" />
          </button>
        ))}
      </div>
      <button
        type="button"
        className="motion-toggle"
        aria-label="Reduce motion"
        aria-pressed={reduced}
        title={reduced ? 'Motion reduced — click for full motion' : 'Full motion — click to reduce'}
        onClick={toggleMotion}
      >
        <MotionIcon weight="duotone" aria-hidden="true" />
      </button>
    </>
  )
}
