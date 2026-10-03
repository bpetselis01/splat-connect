// A child's age as typed: whole years, 0 to 120. `null` when blank, the number
// when it is one, `undefined` when it is not an answer ("5.5", "-3", "Infinity",
// "1e3") — the same three-way verdict as readMeasure, so a stray character is
// never saved (the column is an integer, and JSON turns Infinity into null).
export function readAge(text: string): number | null | undefined {
  const t = text.trim()
  if (t === '') return null
  if (!/^\d{1,3}$/.test(t)) return undefined
  const n = Number(t)
  return n <= 120 ? n : undefined
}
