'use client'

/**
 * The hero mascot: a pixel-art bear wired to a pixel-art big-button switch.
 *
 * This is the one thing on the homepage that does what the headline promises.
 * "Press it. Watch it go." sat above a photograph and two placeholders, so the
 * page asserted the whole point of the charity without ever demonstrating it —
 * a visitor had to take our word for what a switch-adapted toy is. Holding the
 * button here *is* the explanation, and it costs a sentence less than the
 * sentence it replaces.
 *
 * Drawn per-frame on two canvases rather than as SVG or CSS, ported from a
 * Claude Design handoff: a coarse grid of filled squares, with ellipses
 * rasterised into it so every curve breaks into chunky steps. Smooth vector
 * curves would render the same shapes and lose the entire aesthetic, so the
 * blockiness is the deliverable, not an artefact.
 *
 * This file and its tests are now the whole spec — the handoff bundle is gone,
 * so the geometry constants below are the source of truth rather than a copy of
 * one. Change them deliberately.
 *
 * The palette below is fixed by that handoff and deliberately does NOT come from
 * the app's theme tokens: the mascot is a character, and a character that
 * changes colour when the site is retinted stops being one. The chrome around
 * it — badge, label — uses tokens like everything else.
 */
import { useEffect, useRef, useState } from 'react'

/** null = an empty cell, which paints nothing rather than painting white. */
type Grid = (string | null)[][]

const BEAR_CELLS = 24
const SWITCH_COLS = 26
const SWITCH_ROWS = 18

/* Approved layout: the bear leads at 8px cells (192px) and the switch answers
   at 6px (156px). Equal sizes read as two unrelated sprites; the smaller switch
   reads as the thing you reach for. */
const BEAR_PX = 8
const SWITCH_PX = 6

const OUTLINE = '#4a2f1c'
const BODY = '#a9713f'
const TAN = '#e3b07a'
const TAN_DARK = '#c98f56'
const DARK = '#2a1810'
const GLOW = '#f0b429'
const GLOW_BRIGHT = '#ffe08a'

/**
 * Grid drawing primitives, shared by both canvases.
 *
 * `blob` is the interesting one: it fills every cell inside an ellipse, then
 * refills the cells inside a slightly smaller ellipse with the fill colour. The
 * ring left between the two is a one-cell outline that follows the curve for
 * free — which is why nothing here ever strokes a path.
 */
function gridPainter(cols: number, rows: number) {
  const grid: Grid = Array.from({ length: rows }, () => new Array<string | null>(cols).fill(null))

  /** Cell centres, not corners, so the rasterised ellipse stays symmetrical. */
  const inside = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
    const nx = (x + 0.5 - cx) / rx
    const ny = (y + 0.5 - cy) / ry
    return nx * nx + ny * ny <= 1
  }

  return {
    grid,
    blob(cx: number, cy: number, rx: number, ry: number, outline: string, fill: string) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (!inside(x, y, cx, cy, rx, ry)) continue
          grid[y][x] = inside(x, y, cx, cy, rx - 1.1, ry - 1.1) ? fill : outline
        }
      }
    },
    dot(cx: number, cy: number, r: number, color: string) {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          if (inside(x, y, cx, cy, r, r)) grid[y][x] = color
        }
      }
    },
    cell(x: number, y: number, color: string) {
      if (x >= 0 && x < cols && y >= 0 && y < rows) grid[y][x] = color
    },
  }
}

/**
 * The bear at time `t` seconds.
 *
 * At rest it breathes on a slow sine. Pressed, it bobs six times faster, waves
 * one arm at a time on a 0.32s cycle, lights its belly badge, and flashes a
 * sparkle by each ear every other half-cycle.
 *
 * Exported for tests: the geometry is the design, so it is checked directly
 * rather than through a canvas mock that would only prove fillRect was called.
 */
export function bearGrid(t: number, pressed: boolean): Grid {
  const { grid, blob, dot, cell } = gridPainter(BEAR_CELLS, BEAR_CELLS)

  const k = 1.2
  const bob = (pressed ? Math.sin(t * 9) * 0.35 : Math.sin(t * 1.4) * 0.12) * k
  // The head rides at 60% of the body's travel, so the bear compresses slightly
  // rather than translating as one rigid block.
  const headBob = bob * 0.6

  blob(12, 13.5 * k + bob, 6.36, 5.52, OUTLINE, BODY)
  blob(12, 6 * k + headBob, 5.04, 4.8, OUTLINE, BODY)
  blob(7.44, 2.64 + headBob, 2.04, 2.04, OUTLINE, BODY)
  blob(16.56, 2.64 + headBob, 2.04, 2.04, OUTLINE, BODY)
  dot(7.44, 2.88 + headBob, 0.96, TAN)
  dot(16.56, 2.88 + headBob, 0.96, TAN)
  dot(12, 9.12 + headBob, 2.16, TAN)

  // Eyes and nose are single cells, so they snap to the grid instead of
  // sliding a fraction of a pixel and smearing the face.
  const eyeY = Math.round(6 + headBob)
  cell(10, eyeY, DARK)
  cell(14, eyeY, DARK)
  const noseY = Math.round(8.88 + headBob)
  cell(11, noseY, DARK)
  cell(12, noseY, DARK)

  const bellyR = pressed ? 3.12 + Math.sin(t * 9) * 0.18 : 2.64
  if (pressed) dot(12, 16.56 + bob, bellyR + 1.2, GLOW)
  dot(12, 16.56 + bob, bellyR, pressed ? GLOW_BRIGHT : TAN_DARK)

  dot(8.76, 21.36 + bob * 0.5, 1.92, BODY)
  dot(8.76, 21.6 + bob * 0.5, 0.84, TAN)
  dot(15.24, 21.36 + bob * 0.5, 1.92, BODY)
  dot(15.24, 21.6 + bob * 0.5, 0.84, TAN)

  const armDownL = () => blob(4.8, 15 + bob, 1.68, 3.12, OUTLINE, BODY)
  const armDownR = () => blob(19.2, 15 + bob, 1.68, 3.12, OUTLINE, BODY)
  const armUpL = () => blob(6, 9.12 + bob, 1.8, 2.76, OUTLINE, BODY)
  const armUpR = () => blob(18, 9.12 + bob, 1.8, 2.76, OUTLINE, BODY)

  if (!pressed) {
    armDownL()
    armDownR()
  } else {
    const cyc = Math.floor(t / 0.32)
    if (cyc % 2 === 0) {
      armUpL()
      armDownR()
    } else {
      armDownL()
      armUpR()
    }
    if (cyc % 4 < 2) {
      cell(4, 0, GLOW_BRIGHT)
      cell(19, 0, GLOW_BRIGHT)
    }
  }

  return grid
}

/**
 * The switch: a black base plate, two screws, a dangling cable and plug, and a
 * glossy cap.
 *
 * The cap stays teal in both states. It would be easy — and wrong — to light it
 * up on press: a real accessibility switch gives mechanical feedback, not a
 * light show, and the payoff belongs on the toy. So the only change here is the
 * cap sinking 1.4 cells and shrinking, which reads as depressed.
 */
export function switchGrid(pressed: boolean): Grid {
  const { grid, blob, dot } = gridPainter(SWITCH_COLS, SWITCH_ROWS)

  blob(13, 12, 10, 4.6, '#000000', '#242424')
  dot(4.2, 13, 0.7, '#9a9a9a')
  dot(21.8, 13, 0.7, '#9a9a9a')
  dot(18.5, 14.2, 0.9, '#1a1a1a')
  dot(20.5, 15.4, 0.9, '#1a1a1a')
  dot(22, 16.4, 0.9, '#1a1a1a')
  dot(23.3, 17.1, 1.0, '#c9c9c9')

  const capCy = pressed ? 8.4 : 7.0
  const capR = pressed ? 6.0 : 6.8
  blob(13, capCy, capR, capR * 0.72, '#0f6f9c', '#2fbf9f')
  dot(10.3, capCy - 2.3, 1.6, '#8fe0cd')

  return grid
}

function paint(canvas: HTMLCanvasElement, grid: Grid, pixelSize: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const color = grid[y][x]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
    }
  }
}

export function SwitchAdaptedBear({ className = '' }: { className?: string }) {
  const [pressed, setPressed] = useState(false)
  const bearRef = useRef<HTMLCanvasElement>(null)
  const switchRef = useRef<HTMLCanvasElement>(null)
  // Kept across effect re-runs so pressing the switch doesn't reset the clock
  // and snap the bear back to the top of its bob.
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    const bear = bearRef.current
    const sw = switchRef.current
    if (!bear || !sw) return

    // The switch has exactly two frames, so it is painted on state change
    // rather than 60 times a second for no difference.
    paint(sw, switchGrid(pressed), SWITCH_PX)

    // Reduced motion keeps the press *response* — glow, sunken cap — and drops
    // only the continuous idle bob. Removing the response instead would leave
    // someone who asked for less motion with a button that appears broken.
    // Optional call: jsdom has no matchMedia, and an animation loop is the one
    // thing a test environment least needs.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      paint(bear, bearGrid(0, pressed), BEAR_PX)
      return
    }

    let frame = 0
    const loop = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      paint(bear, bearGrid((ts - startRef.current) / 1000, pressed), BEAR_PX)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [pressed])

  return (
    <div className={`mx-auto flex w-full max-w-[372px] items-center justify-center gap-6 ${className}`.trim()}>
      {/* flexBasis + min-w-0 rather than fixed widths: below ~372px the pair
          shrinks in proportion instead of pushing the hero into a sideways
          scroll, and the canvases scale with it. */}
      <div className="relative min-w-0 shrink" style={{ flexBasis: BEAR_CELLS * BEAR_PX }}>
        <canvas
          ref={bearRef}
          width={BEAR_CELLS * BEAR_PX}
          height={BEAR_CELLS * BEAR_PX}
          aria-hidden="true"
          className="block h-auto w-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {/* aria-hidden: the button's aria-pressed already states this, and a
            second announcement of the same fact is noise. */}
        <span
          aria-hidden="true"
          className={`meta absolute -right-3 -top-2 rounded-[var(--radius-pixel-chip)] border-2 px-2.5 py-1 leading-none ${
            pressed
              ? 'border-honey bg-honey-soft text-honey-deep'
              : 'border-ink bg-surface text-muted'
          }`}
        >
          {pressed ? 'On' : 'Off'}
        </span>
      </div>

      <div className="min-w-0 shrink" style={{ flexBasis: SWITCH_COLS * SWITCH_PX }}>
        {/*
          A real button, not a canvas with pointer handlers bolted on. The
          mascot for a charity about switch access cannot itself be unreachable
          by keyboard.

          Pointer events rather than click so press-and-hold works and dragging
          off cancels. Space and Enter give the keyboard the same hold — key
          repeat holds the state — instead of the toggle a click handler would
          force, so every input method gets the same behaviour.
        */}
        <button
          type="button"
          aria-pressed={pressed}
          aria-label="Hold the switch to make the bear play"
          className="block w-full touch-none"
          onPointerDown={() => setPressed(true)}
          onPointerUp={() => setPressed(false)}
          onPointerLeave={() => setPressed(false)}
          onPointerCancel={() => setPressed(false)}
          onKeyDown={(e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return
            e.preventDefault()
            setPressed(true)
          }}
          onKeyUp={(e) => {
            if (e.key !== ' ' && e.key !== 'Enter') return
            e.preventDefault()
            setPressed(false)
          }}
        >
          <canvas
            ref={switchRef}
            width={SWITCH_COLS * SWITCH_PX}
            height={SWITCH_ROWS * SWITCH_PX}
            className="block h-auto w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </button>
        <p className="meta mt-2.5 text-center text-muted">Hold to play</p>
      </div>
    </div>
  )
}
