/**
 * Turns a PDF's positioned text into a guide draft. Deterministic on purpose:
 * no model, no network — text, font size and position, and a few dozen
 * patterns for how maker guides are usually laid out (Makers Making Change's
 * template above all). Everything here is a guess the author reviews.
 *
 * Pipeline: items -> cells (runs of text on one line, split where a column
 * gap is) -> noise removed (running headers/footers, licence lines, tables of
 * contents, callout numbers) -> each cell tagged with the section heading it
 * sits under -> per-section readers (lists, steps, print settings, summary).
 *
 * Pure: extract.ts does the PDF reading and hands this module plain items.
 */
import { BUILD_TIME_OPTIONS } from '@splat-connect/types'
import type { Difficulty, PdfImportConfidence, PdfImportDraft, PdfImportPrintSettings, TutorialKind } from '@splat-connect/types'

/** One text run as pdf.js reports it. y grows upwards (PDF space). */
export interface TextItem {
  page: number
  str: string
  x: number
  y: number
  /** Advance width of the run. */
  w: number
  /** Font size in points. */
  size: number
}

export interface Cell {
  page: number
  text: string
  x: number
  x2: number
  y: number
  size: number
}

type Section = 'contents' | 'print' | 'tools' | 'parts' | 'steps' | 'overview' | 'other'

interface Tagged extends Cell {
  section: Section
  heading: boolean
  /** A big "01." beside a photo — Makers Making Change's step layout. */
  marker: boolean
}

const MAX_STEPS = 60
const MAX_STEP_TITLE = 120
const MAX_STEP_BODY = 2000
const MAX_SUMMARY = 500
const PHOTO_WARNING = 'Photos and diagrams inside the PDF are not copied — add them to the guide yourself.'

// ---------------------------------------------------------------- cells

const sameRow = (a: { y: number; size: number }, b: { y: number; size: number }) =>
  Math.abs(a.y - b.y) <= Math.max(2, Math.min(a.size, b.size) * 0.3)

/** Joins items into cells: same line, similar size, and no column-sized gap between them. */
export function toCells(items: TextItem[]): Cell[] {
  const cells: Cell[] = []
  const byPage = new Map<number, TextItem[]>()
  for (const it of items) {
    if (!it.str.trim()) continue
    const list = byPage.get(it.page) ?? []
    list.push(it)
    byPage.set(it.page, list)
  }
  for (const [page, list] of [...byPage].sort((a, b) => a[0] - b[0])) {
    // Rows first (top to bottom), then left to right within a row.
    const rows: TextItem[][] = []
    for (const it of [...list].sort((a, b) => b.y - a.y)) {
      const row = rows.find((r) => sameRow(r[0], it))
      if (row) row.push(it)
      else rows.push([it])
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x)
      let cur: Cell | null = null
      for (const it of row) {
        const gap = cur ? it.x - cur.x2 : Infinity
        // A lone number is a photo callout ("1" beside "1x Cool Beats"), not the start of the text after it.
        // An ID code ("A02") starts a table entry of its own, even right after the last one's "QTY: 1".
        const joinable =
          cur && Math.abs(cur.size - it.size) <= 1.5 && !/^\d+$/.test(cur.text.trim()) && !ID_CELL.test(it.str.trim())
        // Words in a line sit a space apart; table columns sit further apart than that
        // — but a bullet or "1." sits a column-like gap before its text and still belongs to it.
        const reach = LIST_MARK.test(cur?.text ?? '') ? 2 : 0.75
        if (cur && joinable && gap <= Math.max(cur.size, it.size) * reach) {
          const space = gap > it.size * 0.15 && !cur.text.endsWith(' ') && !it.str.startsWith(' ')
          cur.text += (space ? ' ' : '') + it.str
          cur.x2 = Math.max(cur.x2, it.x + it.w)
        } else {
          cur = { page, text: it.str, x: it.x, x2: it.x + it.w, y: it.y, size: it.size }
          cells.push(cur)
        }
      }
    }
  }
  for (const c of cells) c.text = cleanText(c.text)
  return cells.filter((c) => c.text).sort(readingOrder)
}

/**
 * Symbol-font glyphs arrive in Unicode's private-use area: U+F0B0 is the
 * degree sign ("a 90° angle"), U+F0A7/F0B7 are bullets. Map those, drop the rest.
 */
function cleanText(s: string): string {
  return s
    .replace(/\uF0B0/g, '°')
    .replace(/[\uF0A7\uF0B7\uF06C\uF0D8]/g, '•')
    .replace(/[\uE000-\uF8FF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function readingOrder(a: Cell, b: Cell) {
  if (a.page !== b.page) return a.page - b.page
  if (!sameRow(a, b)) return b.y - a.y
  return a.x - b.x
}

// ---------------------------------------------------------------- noise

const LIST_MARK = /^([^\p{L}\p{N}\s]|\(?\d{1,2}[.)])$/u

const BOILERPLATE =
  /©|\bcopyright\b|licen[cs]ed under|creativecommons\.org|files available at|^page\s*\d+(\s*of\s*\d+)?$|^v\d+(\.\d+)*\s*\|/i
const TOC_LINE = /\.{4,}\s*\d*$/

/**
 * Running headers/footers (same text, same place, on most pages), licence
 * lines, TOC rows, and — unless `keepNumbers`, which the print-settings
 * tables need — lone numbers, which are photo callouts ("1", "14").
 */
export function dropNoise(cells: Cell[], pageCount: number, keepNumbers = false): Cell[] {
  const key = (c: Cell) => `${c.text.toLowerCase().replace(/\d+/g, '#')}@${Math.round(c.y / 4)}`
  const pagesByKey = new Map<string, Set<number>>()
  for (const c of cells) {
    const set = pagesByKey.get(key(c)) ?? new Set()
    set.add(c.page)
    pagesByKey.set(key(c), set)
  }
  const repeatAt = Math.max(2, Math.ceil(pageCount * 0.5))
  return cells.filter((c) => {
    // Step numbers sit in the same place on every page too; they are not a running header.
    const stepLike = STEP_LINE.test(c.text) || MARKER.test(c.text)
    if (pageCount >= 2 && !stepLike && (pagesByKey.get(key(c))?.size ?? 0) >= repeatAt) return false
    if (BOILERPLATE.test(c.text)) return false
    if (TOC_LINE.test(c.text)) return false
    if (!/[\p{L}\p{N}]/u.test(c.text)) return false
    if (!keepNumbers && /^[\d\s]*$/.test(c.text)) return false
    return true
  })
}

/** The size most of the text is set in, weighted by length. */
function bodySize(cells: Cell[]): number {
  const weight = new Map<number, number>()
  for (const c of cells) {
    const s = Math.round(c.size * 2) / 2
    weight.set(s, (weight.get(s) ?? 0) + c.text.length)
  }
  let best = 11
  let most = -1
  for (const [s, w] of weight) if (w > most) [best, most] = [s, w]
  return best
}

// ---------------------------------------------------------------- sections

/** Heading text -> section. Order matters: "Required Tools and Supplies" is tools. */
function headingSection(text: string): Section {
  const t = text.toLowerCase()
  if (/^(table of )?contents$/.test(t)) return 'contents'
  if (/3d[- ]?print|print(ing)? (settings|summary|guide)|slicer/.test(t)) return 'print'
  if (/\btools?\b|equipment|\bppe\b|protective/.test(t)) return 'tools'
  if (/bill of materials|\bbom\b|\bcomponents?\b|\bparts?\b|\bmaterials?\b|supplies|what you('| wi)ll need|shopping list/.test(t))
    return 'parts'
  if (/assembly|instructions?|\bsteps?\b|procedure|directions|how to (build|make|assemble)/.test(t)) return 'steps'
  if (/overview|introduction|description|\babout\b|summary/.test(t)) return 'overview'
  return 'other'
}

/** A body-size line that is only a section label ("BILL OF MATERIALS", "Required Materials:"). */
const LABEL =
  /^(required\s+|the\s+)?(bill of materials|bom|parts( list)?|components|materials|supplies|tools( (required|needed|list))?|instructions|steps|assembly( instructions| steps)?)\s*:?$/i
const STEP_LINE = /^step\s*0*(\d{1,2})\b\s*[:.)\-–]?\s*(.*)$/i
const MARKER = /^0?(\d{1,2})[.)]$/

function tagSections(cells: Cell[], body: number): Tagged[] {
  let section: Section = 'other'
  // A label shares its line with nothing; "Components" in a table header row is not a heading.
  const alone = (c: Cell) => !cells.some((o) => o !== c && o.page === c.page && sameRow(o, c))
  let page = 0
  return cells.map((c) => {
    // A table of contents ends with its page; its dotted rows are already gone.
    if (c.page !== page && section === 'contents') section = 'other'
    page = c.page
    const marker = MARKER.test(c.text) && c.size >= body * 1.8
    const heading =
      !marker &&
      !STEP_LINE.test(c.text) &&
      /\p{L}{3}/u.test(c.text) &&
      ((c.size >= body + 1.5 && c.text.length <= 80) || (LABEL.test(c.text) && alone(c)))
    if (heading) section = headingSection(c.text)
    return { ...c, section, heading, marker }
  })
}

// ---------------------------------------------------------------- lists

const BULLET = /^[^\p{L}\p{N}\s(“"'$]\s*/u
const NUMBERED = /^\(?\d{1,2}[.)]\s+/
const ID_CELL = /^[A-Z]{1,3}\d{2,3}$/
const QTY_LEAD = /^(\d+)\s*[x×]\s+|^[x×]\s*(\d+)\s+/i
const QTY_CELL = /^qty:?\s*(\d+)$/i

interface ListItem {
  text: string
  qty?: number
  page: number
  x: number
  lastY: number
  rowY: number
  size: number
  awaitingName: boolean
}

/**
 * Reads a list or table section into entries. Handles bullets, "1." numbers,
 * "2x" quantities, ID-coded table rows ("A01 | Tactile switch | QTY: 1") and
 * lines that wrap. When any entry is marked, unmarked stray cells (table
 * headers, notes columns) are dropped rather than read as entries.
 */
function readList(cells: Cell[]): { text: string; qty?: number }[] {
  const marked = (t: string) => BULLET.test(t) || NUMBERED.test(t) || QTY_LEAD.test(t) || ID_CELL.test(t)
  const anyMarked = cells.some((c) => marked(c.text))
  const items: ListItem[] = []
  const last = () => items[items.length - 1]
  const start = (c: Cell, text: string, awaitingName = false) =>
    items.push({ text, page: c.page, x: c.x, lastY: c.y, rowY: c.y, size: c.size, awaitingName })

  for (const c of cells) {
    const qty = QTY_CELL.exec(c.text)
    const prev = last()
    const onPrevRow = prev && prev.page === c.page && sameRow({ y: prev.rowY, size: prev.size }, c)
    if (qty) {
      if (onPrevRow) prev.qty = Number(qty[1])
      continue
    }
    if (ID_CELL.test(c.text)) {
      start(c, '', true)
      continue
    }
    if (onPrevRow && prev.awaitingName) {
      prev.text = c.text
      prev.x = c.x
      prev.awaitingName = false
      continue
    }
    if (BULLET.test(c.text) || NUMBERED.test(c.text) || QTY_LEAD.test(c.text)) {
      start(c, c.text.replace(NUMBERED, '').replace(BULLET, ''))
      continue
    }
    // A wrapped line: just below an entry, starting where it starts (or where its text starts after a marker).
    const owner = [...items]
      .reverse()
      .find(
        (it) =>
          it.page === c.page &&
          c.x >= it.x - 6 &&
          c.x <= it.x + 25 &&
          it.lastY - c.y > 0 &&
          it.lastY - c.y <= c.size * 1.7
      )
    if (owner && owner.text) {
      owner.text += ' ' + c.text
      owner.lastY = c.y
      continue
    }
    if (onPrevRow) continue // another column of the same table row
    if (!anyMarked) start(c, c.text)
  }
  return items.filter((i) => i.text).map((i) => ({ text: i.text.trim(), qty: i.qty }))
}

/** "2x Mono jack" -> 2, "Mono jack"; "Screw ×4" -> 4, "Screw"; "Qty 2 Nut" -> 2, "Nut". */
export function splitQuantity(text: string): { name: string; quantity: number } {
  const patterns: [RegExp, number, number][] = [
    [/^(\d+)\s*[x×]\s*(.+)$/i, 1, 2],
    [/^[x×]\s*(\d+)\s+(.+)$/i, 1, 2],
    [/^qty:?\s*(\d+)\s+(.+)$/i, 1, 2],
    [/^(.+?)\s*[(\[]?\s*[x×]\s*(\d+)\s*[)\]]?$/i, 2, 1],
    [/^(.+?)\s*[-–,(]?\s*qty:?\s*(\d+)\)?$/i, 2, 1],
  ]
  for (const [re, q, n] of patterns) {
    const m = re.exec(text)
    if (m && Number(m[q]) > 0 && Number(m[q]) < 1000) return { name: cleanName(m[n]), quantity: Number(m[q]) }
  }
  return { name: cleanName(text), quantity: 1 }
}

const cleanName = (s: string) => s.replace(/\s+/g, ' ').replace(/[:;,]\s*$/, '').trim().slice(0, 200)

function dedupe<T extends { name: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  return list.filter((p) => {
    const k = p.name.toLowerCase()
    if (p.name.length < 2 || !/\p{L}/u.test(p.name) || LABEL.test(p.name) || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Cells of one section, split at each heading so separate tables are read separately. */
function sectionRuns(tagged: Tagged[], section: Section): Cell[][] {
  const runs: Cell[][] = []
  let run: Cell[] | null = null
  for (const c of tagged) {
    if (c.heading) {
      run = c.section === section ? [] : null
      if (run) runs.push(run)
    } else if (run && !c.marker) run.push(c)
  }
  return runs
}

// ---------------------------------------------------------------- paragraphs

/** Joins lines into paragraph text: wrapped lines with a space, bigger gaps and page breaks as blank lines. */
function joinLines(cells: Cell[]): string {
  let out = ''
  let prev: Cell | null = null
  for (const c of cells) {
    if (!prev) out = c.text
    else if (prev.page === c.page && (sameRow(prev, c) || prev.y - c.y <= c.size * 1.8)) out += ' ' + c.text
    else out += '\n\n' + c.text
    prev = c
  }
  return out.trim()
}

/** Lines stacked in one column (same left edge, line spacing apart) — a paragraph, however many columns the page has. */
function blocks(cells: Cell[]): Cell[][] {
  const out: Cell[][] = []
  for (const c of cells) {
    const open = out.find((b) => {
      const l = b[b.length - 1]
      return l.page === c.page && Math.abs(l.x - c.x) <= 20 && l.y - c.y > 0 && l.y - c.y <= c.size * 1.7
    })
    if (open) open.push(c)
    else out.push([c])
  }
  return out
}

// ---------------------------------------------------------------- steps

interface StepDraft {
  n: number
  title?: string
  body: string
}

/** "Step 3: Solder the leads" lines, each followed by its text up to the next step or heading. */
function explicitSteps(tagged: Tagged[]): StepDraft[] {
  const steps: { n: number; title: string; cells: Cell[] }[] = []
  let cur: (typeof steps)[number] | null = null
  for (const c of tagged) {
    if (c.section === 'contents') continue
    const m = STEP_LINE.exec(c.text)
    if (m) {
      cur = { n: Number(m[1]), title: m[2].trim(), cells: [] }
      steps.push(cur)
    } else if (c.heading || c.marker) {
      cur = null
    } else if (cur) {
      cur.cells.push(c)
    }
  }
  const byNumber = new Map<number, StepDraft>()
  for (const s of steps) {
    let title = s.title || undefined
    let cells = s.cells
    // "Setting up the 3D prints:" — a short first line ending in a colon reads as the step's title.
    if (!title && cells[0] && cells[0].text.length <= 80 && cells[0].text.endsWith(':')) {
      title = cells[0].text.slice(0, -1).trim()
      cells = cells.slice(1)
    }
    const step = { n: s.n, title, body: joinLines(cells) }
    const had = byNumber.get(s.n)
    if (!had || step.body.length > had.body.length) byNumber.set(s.n, step)
  }
  return [...byNumber.values()].sort((a, b) => a.n - b.n)
}

/**
 * Big "01." numbers beside photos, text to their right (often in two
 * columns). Text is grouped into blocks, and each block goes to the marker on
 * its page that sits just left of it at about the same height.
 */
function markerSteps(tagged: Tagged[], body: number): StepDraft[] {
  const markers = tagged.filter((c) => c.marker)
  const text = tagged.filter((c) => !c.marker && !c.heading && c.size <= body * 1.3)
  const found = new Map<number, Cell[][]>()
  for (const m of markers) found.set(Number(MARKER.exec(m.text)![1]), [])
  // A block with no real words ("0mm", "FRONT") is a label on the photo.
  const words = (b: Cell[]) => {
    const t = b.map((c) => c.text).join(' ')
    return t.split(/\s+/).length >= 2 && /\p{L}{3}/u.test(t)
  }
  for (const b of blocks(text).filter(words)) {
    const top = b[0]
    const candidates = markers.filter(
      (m) => m.page === top.page && top.x > m.x && top.x <= m.x + 80 && top.y >= m.y - m.size && top.y <= m.y + m.size + 10
    )
    if (!candidates.length) continue
    const mid = (m: Cell) => Math.abs(top.y - (m.y + m.size / 2))
    const best = candidates.reduce((a, m) => (mid(m) < mid(a) ? m : a))
    found.get(Number(MARKER.exec(best.text)![1]))!.push(b)
  }
  return [...found]
    .sort((a, b) => a[0] - b[0])
    .map(([n, bs]) => ({ n, body: bs.map(joinLines).join('\n\n') }))
}

/** No step markers at all: the steps section's own list entries, or its paragraphs. */
function listSteps(tagged: Tagged[]): StepDraft[] {
  return sectionRuns(tagged, 'steps')
    .flatMap(readList)
    .map((it, i) => ({ n: i + 1, body: it.text }))
}

// ---------------------------------------------------------------- print settings

const NUM = /^\d+(\.\d+)?$/

/** "1h 09m", "1 h 9 m", "1:09" (hr:min), "2 hours", "45 min", bare "101" (as minutes). */
export function parseDuration(s: string, bareIs: 'min' | null = 'min'): number | null {
  const t = s.trim().toLowerCase()
  let m = /^(\d+)\s*h(?:ours?|rs?)?\s*(\d+)\s*m(?:in(?:utes?|s)?)?$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = /^(\d{1,3}):(\d{2})$/.exec(t)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = /^(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?)$/.exec(t)
  if (m) return Math.round(Number(m[1]) * 60)
  m = /^(\d+)\s*(m|min|mins|minutes?)$/.exec(t)
  if (m) return Number(m[1])
  if (bareIs && NUM.test(t)) return Math.round(Number(t))
  return null
}

/** Values in the cells right of a header on its row, or else in the column below it. */
function tableValues(cells: Cell[], header: RegExp, value: (s: string) => boolean): string[] {
  for (const h of cells.filter((c) => header.test(c.text))) {
    const right = cells.filter((c) => c.page === h.page && sameRow(c, h) && c.x > h.x && value(c.text))
    if (right.length) return right.map((c) => c.text)
    const below = cells
      .filter((c) => {
        const mid = (c.x + c.x2) / 2
        return c.page === h.page && c.y < h.y && h.y - c.y <= 200 && mid >= h.x - 8 && mid <= h.x2 + 8 && value(c.text)
      })
      .sort((a, b) => b.y - a.y)
    if (below.length) return below.map((c) => c.text)
  }
  return []
}

export function readPrintSettings(cells: Cell[]): PdfImportPrintSettings {
  const text = cells.map((c) => c.text).join('\n')
  const out: PdfImportPrintSettings = {}

  const layer =
    /layer height[^0-9\n]{0,25}(\d*\.\d+|\d+)\s*mm/i.exec(text)?.[1] ??
    tableValues(cells, /^layer height/i, (s) => /^\d*\.\d+(\s*\/\s*\d*\.\d+)?$/.test(s))[0]?.split('/')[0]
  if (layer && Number(layer) > 0 && Number(layer) < 2) out.layer_height_mm = Number(layer)

  const infillText = /(\d{1,3})\s*%\s*infill|infill[^0-9%\n]{0,15}(\d{1,3})\s*%/i.exec(text)
  const infill = infillText?.[1] ?? infillText?.[2] ?? tableValues(cells, /^infill/i, (s) => /^\d{1,3}$/.test(s))[0]
  if (infill && Number(infill) <= 100) out.infill_percent = Number(infill)

  if (/without supports|no supports? (needed|required)|supports?\s*[:\-]?\s*(none|no|not (needed|required))\b/i.test(text))
    out.supports = false
  else if (/supports?\s*[:\-]\s*(yes|required|needed)\b|(requires|needs|with) supports/i.test(text)) out.supports = true
  else {
    const yn = tableValues(cells, /^support/i, (s) => /^[YN]$/i.test(s))
    if (yn.length) out.supports = yn.some((v) => /y/i.test(v))
  }

  const material = /\b(PLA\+?|PETG|ABS|TPU|ASA|Nylon)\b/.exec(text)?.[1]
  if (material) out.material = material

  const minutes = tableValues(cells, /total print time/i, (s) => parseDuration(s) != null).map((s) => parseDuration(s)!)
  if (!minutes.length) {
    const free = /print(?:ing)? time\s*[:\-]?\s*(?:about|approx\.?|~)?\s*(\d+\s*h(?:ours?|rs?)?\s*\d+\s*m(?:in)?|\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?|m|min|mins|minutes?)\b|\d{1,3}:\d{2})/i.exec(text)
    const d = free && parseDuration(free[1], null)
    if (d) minutes.push(d)
  }
  // Several columns (sizes, configurations) — plan for the largest.
  const plausible = minutes.filter((m) => m > 0 && m < 100 * 60)
  if (plausible.length) out.print_minutes = Math.max(...plausible)

  const grams = [
    ...tableValues(cells, /total mass|\bmass\b|filament|weight/i, (s) => NUM.test(s)).map(Number),
  ]
  const freeGrams = /filament[^0-9\n]{0,15}(\d+(?:\.\d+)?)\s*g\b|(\d+(?:\.\d+)?)\s*g(?:rams)? of filament/i.exec(text)
  if (!grams.length && freeGrams) grams.push(Number(freeGrams[1] ?? freeGrams[2]))
  const g = grams.filter((n) => n > 0 && n < 5000)
  if (g.length) out.filament_grams = Math.max(...g)

  return out
}

// ---------------------------------------------------------------- facts

export function guessDifficulty(text: string): Difficulty | null {
  const m = /\b(?:difficulty|skill level|level)\s*(?:level)?\s*[:\-]?\s*(beginner|easy|simple|intermediate|moderate|medium|advanced|hard|difficult|expert)\b/i.exec(
    text
  )
  if (!m) return null
  const w = m[1].toLowerCase()
  if (['beginner', 'easy', 'simple'].includes(w)) return 'easy'
  if (['intermediate', 'moderate', 'medium'].includes(w)) return 'medium'
  return 'hard'
}

const RANGE = String.raw`(\d+(?:\.\d+)?)(?:\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|h|minutes?|mins?|m)\b`

/** Hands-on minutes, upper end of a range, snapped up to the editor's options. */
export function guessBuildMinutes(text: string): number | null {
  const res = [
    new RegExp(String.raw`(?:assembly|build|building|making|hands[- ]on)\s+time\s*[:\-]?\s*(?:about|approx(?:imately|\.)?|around|~)?\s*` + RANGE, 'i'),
    new RegExp(String.raw`(?:about|approx(?:imately|\.)?|around|~|takes)\s*` + RANGE + String.raw`\s*(?:of\s+)?(?:assembly|to (?:build|assemble|make)|build)`, 'i'),
  ]
  for (const re of res) {
    const m = re.exec(text)
    if (!m) continue
    const upper = Number(m[2] ?? m[1])
    const minutes = /^h/i.test(m[3]) ? upper * 60 : upper
    if (!(minutes > 0)) continue
    return BUILD_TIME_OPTIONS.find((o) => o >= minutes) ?? BUILD_TIME_OPTIONS[BUILD_TIME_OPTIONS.length - 1]
  }
  return null
}

export function guessAges(text: string): { age_min: number | null; age_max: number | null } {
  const clamp = (n: number) => Math.min(18, Math.max(0, n))
  let m = /\bages?\s*(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b/i.exec(text)
  if (m) return { age_min: clamp(Number(m[1])), age_max: clamp(Number(m[2])) }
  m = /\bages?\s*(\d{1,2})\s*(?:\+|and up\b|and older\b|years? and (?:up|older)\b)/i.exec(text)
  if (m) return { age_min: clamp(Number(m[1])), age_max: null }
  return { age_min: null, age_max: null }
}

const TOY = /\btoys?\b|switch[- ]adapt|adapted (?:toy|for (?:a )?switch)|battery interrupt/gi
const AT = /\bswitch(?:es)?\b(?![- ]adapt)|\bmount(?:s|ing)?\b|3d[- ]print|\bholder\b|assistive|\bdevice\b/gi

export function guessKind(title: string, text: string): { kind: TutorialKind; confidence: PdfImportConfidence } {
  if (title.search(TOY) >= 0) return { kind: 'toy_adaptation', confidence: 'high' }
  if (title.search(AT) >= 0) return { kind: 'assistive_tech', confidence: 'high' }
  const toys = text.match(TOY)?.length ?? 0
  const at = text.match(AT)?.length ?? 0
  if (!toys && !at) return { kind: 'toy_adaptation', confidence: 'none' }
  return toys >= 2 && toys >= at
    ? { kind: 'toy_adaptation', confidence: 'medium' }
    : { kind: 'assistive_tech', confidence: toys ? 'low' : 'medium' }
}

function truncateSentence(s: string, max: number): string {
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('.\n'))
  if (end > max * 0.4) return cut.slice(0, end + 1)
  return cut.slice(0, cut.lastIndexOf(' ')).trim() + '…'
}

// ---------------------------------------------------------------- the draft

const conf = (n: number, high: boolean): PdfImportConfidence => (n === 0 ? 'none' : high ? 'high' : 'medium')

export function parseGuide(items: TextItem[], pageCount: number): PdfImportDraft {
  const warnings: string[] = []
  const allCells = toCells(items)
  const cells = dropNoise(allCells, pageCount)
  const body = bodySize(cells)
  const text = cells.map((c) => c.text).join('\n')

  if (text.replace(/\s/g, '').length < 30) {
    return {
      title: null,
      summary: null,
      kind: 'toy_adaptation',
      difficulty: null,
      build_minutes: null,
      age_min: null,
      age_max: null,
      parts: [],
      tools: [],
      steps: [],
      print_settings: {},
      warnings: [
        'This PDF has almost no readable text — it may be a scan or made of pictures, so nothing could be filled in.',
        PHOTO_WARNING,
      ],
      confidence: { title: 'none', summary: 'none', kind: 'none', parts: 'none', tools: 'none', steps: 'none', print_settings: 'none' },
      page_count: pageCount,
    }
  }

  // Title: the largest text on page 1 (running headers included — the title usually is one).
  const firstPage = allCells.filter((c) => c.page === 1 && /\p{L}{2}/u.test(c.text) && !BOILERPLATE.test(c.text))
  const top = Math.max(...firstPage.map((c) => c.size))
  // Nothing set larger than the body text: take the first line only, as a low-confidence guess.
  const titleCells = firstPage.filter((c) => c.size >= top - 0.5).slice(0, top >= body * 1.2 ? undefined : 1)
  const title = titleCells.length
    ? titleCells
        .filter((c) => titleCells[0].y - c.y <= top * 2.5)
        .map((c) => c.text)
        .join(' ')
        .slice(0, 200)
    : null
  const titleConfidence: PdfImportConfidence = !title ? 'none' : top >= body * 1.4 ? 'high' : 'low'

  const tagged = tagSections(cells, body)
  const hasHeading = (s: Section) => tagged.some((c) => c.heading && c.section === s)

  // Parts and tools.
  const partsRuns = sectionRuns(tagged, 'parts')
  const parts = dedupe(partsRuns.flatMap(readList).map((it) => (it.qty ? { name: cleanName(splitQuantity(it.text).name), quantity: it.qty } : splitQuantity(it.text))))
  const tools = dedupe(sectionRuns(tagged, 'tools').flatMap(readList).map((it) => ({ name: splitQuantity(it.text).name })))
  if (!parts.length) warnings.push(hasHeading('parts') ? 'Found a parts heading but could not read the list under it (it may be a picture).' : 'No parts list found.')
  if (!tools.length) warnings.push(hasHeading('tools') ? 'Found a tools heading but could not read the list under it.' : 'No tools list found.')

  // Steps: explicit "Step N" first, then big numbers beside photos, then the steps section's list.
  let raw = explicitSteps(tagged)
  let stepsConfidence: PdfImportConfidence = 'high'
  if (raw.length < 2) {
    const marked = markerSteps(tagged, body)
    if (marked.length >= 2) raw = marked
  }
  if (raw.length < 2) {
    raw = listSteps(tagged)
    stepsConfidence = raw.length ? 'low' : 'none'
  }
  const empty = raw.filter((s) => !s.body.trim()).map((s) => s.n)
  if (empty.length) {
    warnings.push(
      `Step${empty.length > 1 ? 's' : ''} ${empty.join(', ')} had no readable text — the instructions are probably in the pictures, so ${empty.length > 1 ? 'they were' : 'it was'} left out.`
    )
    if (empty.length > raw.length / 2 && stepsConfidence === 'high') stepsConfidence = 'low'
  }
  let steps = raw
    .filter((s) => s.body.trim())
    .map((s) => {
      let b = s.body
      if (b.length > MAX_STEP_BODY) {
        warnings.push(`Step ${s.n} was longer than ${MAX_STEP_BODY} characters and was cut short.`)
        b = truncateSentence(b, MAX_STEP_BODY)
      }
      const t = s.title?.slice(0, MAX_STEP_TITLE)
      return t ? { title: t, body: b } : { body: b }
    })
  if (steps.length > MAX_STEPS) {
    warnings.push(`Only the first ${MAX_STEPS} steps were kept.`)
    steps = steps.slice(0, MAX_STEPS)
  }
  if (!steps.length) {
    stepsConfidence = 'none'
    if (!empty.length) warnings.push('No numbered steps found.')
  }

  // Summary: the overview section's first paragraph, else the first sentence-like paragraph outside the lists.
  const overview = sectionRuns(tagged, 'overview').map(joinLines).find((p) => p.length >= 40)
  let summary = overview ?? null
  let summaryConfidence: PdfImportConfidence = summary ? 'high' : 'none'
  if (!summary) {
    const loose = tagged.filter((c) => !c.heading && !c.marker && c.section === 'other' && Math.abs(c.size - body) <= 1.5)
    const paragraphs = blocks(loose).map(joinLines)
    summary =
      paragraphs.find((p) => p.length >= 80 && /[a-z]\.(\s|$)/.test(p) && !steps.some((s) => s.body.includes(p))) ?? null
    summaryConfidence = summary ? 'low' : 'none'
  }
  if (summary) summary = truncateSentence(summary, MAX_SUMMARY)
  else warnings.push('No description paragraph found — write a short summary yourself.')

  const print_settings = readPrintSettings(dropNoise(allCells, pageCount, true))
  const printCount = Object.keys(print_settings).length
  const kind = guessKind(title ?? '', text)

  warnings.push(PHOTO_WARNING)

  return {
    title,
    summary,
    kind: kind.kind,
    difficulty: guessDifficulty(text),
    build_minutes: guessBuildMinutes(text),
    ...guessAges(text),
    parts,
    tools,
    steps,
    print_settings,
    warnings,
    confidence: {
      title: titleConfidence,
      summary: summaryConfidence,
      kind: kind.confidence,
      parts: conf(parts.length, hasHeading('parts')),
      tools: conf(tools.length, hasHeading('tools')),
      steps: stepsConfidence,
      print_settings: printCount >= 3 ? 'high' : printCount ? 'medium' : 'none',
    },
    page_count: pageCount,
  }
}
