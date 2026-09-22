/**
 * Splat, the bear.
 *
 * Lifted verbatim from the artboard's bear() — the same paths, the same
 * periwinkle (#A7BDE8 body, #98A9D1 ears and paws), the same poses. Redrawing
 * it by hand would have been a different bear, and the mascot is the one thing
 * on the page nobody can approximate.
 *
 * The wave arm's animation is a class so its keyframe can sit in globals.css
 * behind a prefers-reduced-motion guard; the other poses name their keyframes
 * inline, exactly as the board does, and the same guard stops them.
 */
import type { CSSProperties, ReactNode } from 'react'

export type MascotPose = 'wave' | 'think' | 'party' | 'hold'

const B = '#A7BDE8'
const D = '#98A9D1'
const S = '#4A5568'
const M = '#E8F0FE'

const pivot = (x: number, y: number, animation?: string): CSSProperties | undefined =>
  animation ? { transformBox: 'view-box', transformOrigin: `${x}px ${y}px`, animation } : undefined

/** A limb hanging from a shoulder, rotated about it (0 = straight down). */
function Arm({ sx, sy, rot, anim }: { sx: number; sy: number; rot: number; anim?: string }) {
  return (
    <g style={pivot(sx, sy, anim)}>
      <g transform={`rotate(${rot} ${sx} ${sy})`}>
        <rect x={sx - 5} y={sy - 4} width="10" height="24" rx="5" fill={B} />
        <circle cx={sx} cy={sy + 19} r="5.5" fill={D} />
      </g>
    </g>
  )
}

export function SplatMascot({ width = 300, pose = 'wave' }: { width?: number; pose?: MascotPose }) {
  const gid = `bg${pose}`
  let eyes: ReactNode = (
    <>
      <circle cx="43" cy="29" r="2.5" fill={S} />
      <circle cx="57" cy="29" r="2.5" fill={S} />
    </>
  )
  let mouth: ReactNode = (
    <path d="M47 40.5q3 2.5 6 0" stroke={S} strokeWidth="1.4" fill="none" strokeLinecap="round" />
  )
  let left: ReactNode = null
  let right: ReactNode = null
  let extras: ReactNode = null
  let bodyAnim: string | undefined

  if (pose === 'wave') {
    // The class, not inline, so the home hero's existing rules still reach it.
    left = (
      <g className="splat-mascot__arm">
        <g transform="rotate(150 32 50)">
          <rect x="27" y="46" width="10" height="24" rx="5" fill={B} />
          <circle cx="32" cy="69" r="5.5" fill={D} />
        </g>
      </g>
    )
    right = <Arm sx={68} sy={50} rot={-18} />
  } else if (pose === 'think') {
    eyes = (
      <>
        <circle cx="44" cy="28" r="2.5" fill={S} />
        <circle cx="58" cy="28" r="2.5" fill={S} />
        <path d="M54 22q4 -2 7 1" stroke={S} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </>
    )
    mouth = <path d="M47 41q3 -1 6 0" stroke={S} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    left = <Arm sx={32} sy={50} rot={15} />
    right = (
      <g style={pivot(68, 50, 'btap 2.2s ease-in-out infinite')}>
        <path d="M68 50L61 42" stroke={B} strokeWidth="10" strokeLinecap="round" />
        <circle cx="60" cy="42" r="5.5" fill={D} />
      </g>
    )
    extras = (
      <g style={pivot(78, 20, 'bq 2.2s ease-in-out infinite')}>
        <path
          d="M73 18C73 15 76 13 78.5 13C81 13 83.5 15 83.5 18C83.5 20.5 81 21.5 78.5 22V25"
          stroke={S}
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="78.5" cy="29" r="1.6" fill={S} />
      </g>
    )
  } else if (pose === 'party') {
    eyes = (
      <>
        <path d="M40 30q3 -3.5 6 0" stroke={S} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M54 30q3 -3.5 6 0" stroke={S} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </>
    )
    mouth = <path d="M45 40q5 5 10 0z" fill={S} />
    bodyAnim = 'bhop .9s cubic-bezier(.3,.7,.4,1) infinite'
    left = <Arm sx={32} sy={50} rot={150} anim="bcheer .9s ease-in-out infinite" />
    right = <Arm sx={68} sy={50} rot={-150} anim="bcheer .9s .45s ease-in-out infinite" />
    extras = (
      [
        ['#F6AD55', 22, 12, 2.2, 0],
        ['#81E6D9', 78, 14, 1.8, 0.3],
        ['#F687B3', 50, 0, 2.4, 0.6],
        ['#F6AD55', 88, 32, 1.6, 0.9],
        ['#81E6D9', 12, 34, 1.8, 1.2],
      ] as const
    ).map(([c, x, y, r, d]) => (
      <circle
        key={`${x}-${y}`}
        cx={x}
        cy={y}
        r={r}
        fill={c}
        style={{ animation: `btwinkle 1.8s ${d}s ease-in-out infinite` }}
      />
    ))
  } else {
    right = (
      <>
        <g style={pivot(50, 66, 'bpress 2.8s ease-in-out infinite')}>
          <ellipse cx="50" cy="66" rx="17" ry="5" fill="#E8A317" />
          <ellipse cx="50" cy="61" rx="12" ry="9" fill="#FF8A5C" />
          <ellipse cx="46" cy="57" rx="5" ry="2.5" fill="rgba(255,255,255,.55)" />
        </g>
        <ellipse cx="34" cy="64" rx="6" ry="5" fill={B} />
        <ellipse cx="33" cy="64" rx="3.5" ry="3" fill={D} />
        <ellipse cx="66" cy="64" rx="6" ry="5" fill={B} />
        <ellipse cx="67" cy="64" rx="3.5" ry="3" fill={D} />
      </>
    )
  }

  return (
    <svg width={width} height={width} viewBox="0 -5 100 100" role="img" aria-label={`Bear mascot, ${pose}`} className="splat-mascot">
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="#FFCBA4" stopOpacity="1" />
          <stop offset="100%" stopColor="#FFCBA4" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="50" cy="89" rx="26" ry="3.5" fill="rgba(74,85,104,.10)" />
      <g style={pivot(50, 86, bodyAnim)}>
        {left}
        <path d="M50 9C38.9543 9 30 17.9543 30 29V68.5C30 74.0228 34.4772 78.5 40 78.5H60C65.5228 78.5 70 74.0228 70 68.5V29C70 17.9543 61.0457 9 50 9Z" fill={B} />
        <circle cx="50" cy="29" r="20" fill={B} />
        <circle cx="37" cy="14" r="6" fill={D} />
        <circle cx="63" cy="14" r="6" fill={D} />
        <circle cx="38" cy="35" r="4" fill={`url(#${gid})`} />
        <circle cx="62" cy="35" r="4" fill={`url(#${gid})`} />
        {eyes}
        <ellipse cx="50" cy="38" rx="8" ry="6" fill={M} />
        <ellipse cx="50" cy="36" rx="3.5" ry="2.5" fill={S} />
        {mouth}
        {right}
        {/* No feet: the board's two ellipses carry `r`, which an ellipse
            ignores, so they never render there either. */}
      </g>
      {extras}
    </svg>
  )
}
