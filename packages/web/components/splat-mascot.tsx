/**
 * Splat, the bear.
 *
 * Lifted verbatim from the artboard's #home — the same paths, the same
 * periwinkle (#A7BDE8 body, #98A9D1 ears and paws), the same wave. Redrawing it
 * by hand would have been a different bear, and the mascot is the one thing on
 * the page nobody can approximate.
 *
 * The arm's animation is a class rather than the board's inline shorthand, so
 * the keyframe can sit in globals.css behind a prefers-reduced-motion guard.
 */
export function SplatMascot({ width = 300 }: { width?: number }) {
  return (
    <svg width={width} height={width} viewBox="0 -5 100 100" role="img" aria-label="Bear mascot, wave" className="splat-mascot"><defs><radialGradient id="bgwave" cx="50%" cy="50%" r="50%"><stop offset="70%" stopColor="#FFCBA4" stopOpacity="1"></stop><stop offset="100%" stopColor="#FFCBA4" stopOpacity="0"></stop></radialGradient></defs><ellipse cx="50" cy="89" rx="26" ry="3.5" fill="rgba(74,85,104,.10)"></ellipse><g><g className="splat-mascot__arm"><g transform="rotate(150 32 50)"><rect x="27" y="46" width="10" height="24" rx="5" fill="#A7BDE8"></rect><circle cx="32" cy="69" r="5.5" fill="#98A9D1"></circle></g></g><path d="M50 9C38.9543 9 30 17.9543 30 29V68.5C30 74.0228 34.4772 78.5 40 78.5H60C65.5228 78.5 70 74.0228 70 68.5V29C70 17.9543 61.0457 9 50 9Z" fill="#A7BDE8"></path><circle cx="50" cy="29" r="20" fill="#A7BDE8"></circle><circle cx="37" cy="14" r="6" fill="#98A9D1"></circle><circle cx="63" cy="14" r="6" fill="#98A9D1"></circle><circle cx="38" cy="35" r="4" fill="url(#bgwave)"></circle><circle cx="62" cy="35" r="4" fill="url(#bgwave)"></circle><circle cx="43" cy="29" r="2.5" fill="#4A5568"></circle><circle cx="57" cy="29" r="2.5" fill="#4A5568"></circle><ellipse cx="50" cy="38" rx="8" ry="6" fill="#E8F0FE"></ellipse><ellipse cx="50" cy="36" rx="3.5" ry="2.5" fill="#4A5568"></ellipse><path d="M47 40.5q3 2.5 6 0" stroke="#4A5568" strokeWidth="1.4" fill="none" strokeLinecap="round"></path><g><g transform="rotate(-18 68 50)"><rect x="63" y="46" width="10" height="24" rx="5" fill="#A7BDE8"></rect><circle cx="68" cy="69" r="5.5" fill="#98A9D1"></circle></g></g><ellipse cx="40" cy="84" r="7" fill="#A7BDE8"></ellipse><ellipse cx="60" cy="84" r="7" fill="#A7BDE8"></ellipse></g></svg>
  )
}

