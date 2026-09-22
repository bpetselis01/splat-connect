/**
 * What a set of printed parts adds up to, in the board's words.
 *
 * The request form's summary tiles ("3 h 10 min printing", "41 g PETG
 * filament"), the printer's queue chips and the job page's file line all read
 * the same STL rows (068), so the arithmetic lives once, here.
 */
import type { PrintJobFile, StlFile } from '@splat-connect/types'

type Part = Pick<StlFile, 'filename' | 'print_minutes' | 'filament_grams' | 'material'> & {
  quantity?: number
}

/** "3 h 10 min", "45 min", "2 h". */
export function formatPrintMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/**
 * Sum over the parts, one copy each unless `quantity` says otherwise. A part
 * with no figure adds nothing; when NO part has one the total is null, so the
 * tile can draw "—" rather than a confident 0.
 */
export function printSummary(parts: Part[]): {
  minutes: number | null
  grams: number | null
  /** Distinct materials in the order first seen, e.g. "PETG" or "PETG + TPU". */
  material: string | null
} {
  const sum = (key: 'print_minutes' | 'filament_grams') => {
    const known = parts.filter((p) => p[key] != null)
    if (known.length === 0) return null
    return known.reduce((n, p) => n + p[key]! * (p.quantity ?? 1), 0)
  }
  const materials = [...new Set(parts.map((p) => p.material).filter(Boolean))]
  return {
    minutes: sum('print_minutes'),
    grams: sum('filament_grams'),
    material: materials.length ? materials.join(' + ') : null,
  }
}

/** The tile and chip texts, or "—" where the guide never said. */
export function printTimeLabel(parts: Part[]): string {
  const { minutes } = printSummary(parts)
  return minutes === null ? '—' : formatPrintMinutes(minutes)
}
export function filamentLabel(parts: Part[]): string {
  const { grams, material } = printSummary(parts)
  if (grams === null) return material ?? '—'
  return material ? `${grams} g ${material}` : `${grams} g`
}

/** "switch-mount-body.stl, cradle-65mm.stl × 2" — the board's file line. */
export function printFilesLine(files: Pick<PrintJobFile, 'filename' | 'quantity'>[]): string {
  return files
    .map((f) => (f.quantity > 1 ? `${f.filename} × ${f.quantity}` : f.filename))
    .join(', ')
}
