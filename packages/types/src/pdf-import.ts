// "Start from a PDF": what POST /api/tutorials/import-pdf reads out of a
// guide's PDF, and the one sequence web and mobile both run to turn that
// draft into a real tutorial. The reading is deterministic text heuristics
// (packages/api/src/pdf-import) — a best guess the author checks, never a
// finished guide.
import type { Difficulty, TutorialKind } from './index'

export type PdfImportConfidence = 'high' | 'medium' | 'low' | 'none'

export interface PdfImportPrintSettings {
  layer_height_mm?: number
  infill_percent?: number
  supports?: boolean
  material?: string
  print_minutes?: number
  filament_grams?: number
}

export interface PdfImportDraft {
  title: string | null
  /** The first descriptive paragraph, at most 500 characters. */
  summary: string | null
  kind: TutorialKind
  difficulty: Difficulty | null
  /** Snapped up to the editor's BUILD_TIME_OPTIONS. */
  build_minutes: number | null
  age_min: number | null
  age_max: number | null
  parts: { name: string; quantity: number }[]
  tools: { name: string }[]
  steps: { title?: string; body: string }[]
  print_settings: PdfImportPrintSettings
  /** What could not be read, in words the author sees. */
  warnings: string[]
  confidence: Record<
    'title' | 'summary' | 'kind' | 'parts' | 'tools' | 'steps' | 'print_settings',
    PdfImportConfidence
  >
  page_count: number
}

/** "Print settings from the PDF: 0.2 mm layers, 20% infill, …" — null when none were found. */
export function printSettingsNote(p: PdfImportPrintSettings): string | null {
  const bits = [
    p.layer_height_mm != null ? `${p.layer_height_mm} mm layers` : null,
    p.infill_percent != null ? `${p.infill_percent}% infill` : null,
    p.supports != null ? (p.supports ? 'supports needed' : 'no supports') : null,
    p.material ? p.material : null,
    p.print_minutes != null ? `about ${p.print_minutes} min printing` : null,
    p.filament_grams != null ? `about ${p.filament_grams} g of filament` : null,
  ].filter(Boolean)
  return bits.length ? `Print settings from the PDF: ${bits.join(', ')}.` : null
}

/** The review checklist both apps show: what the draft will carry into the editor. */
export function pdfDraftChecklist(draft: PdfImportDraft): { label: string; found: string | null }[] {
  const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null)
  return [
    { label: 'Description', found: draft.summary ? 'First paragraph' : null },
    { label: 'Parts', found: count(draft.parts.length, 'part', 'parts') },
    { label: 'Tools', found: count(draft.tools.length, 'tool', 'tools') },
    { label: 'Steps', found: count(draft.steps.length, 'step', 'steps') },
    { label: 'Print settings', found: printSettingsNote(draft.print_settings) ? 'Added to the description as a note' : null },
    { label: 'Build time', found: draft.build_minutes ? `${draft.build_minutes} min` : null },
  ]
}

/** The calls the sequence needs; both apps' clients already have this shape. */
export interface PdfDraftApi {
  get<T>(path: string): Promise<T>
  post<T>(path: string, body: unknown): Promise<T>
  patch<T>(path: string, body: unknown): Promise<T>
  put<T>(path: string, body: unknown): Promise<T>
}

export interface PdfDraftResult {
  /** Sections that could not be saved; the draft exists regardless. */
  failed: ('pdf' | 'details' | 'parts' | 'tools' | 'steps')[]
  /** PUT /steps answered 404 — the steps endpoint is not deployed yet. */
  stepsUnavailable: boolean
}

function is404(err: unknown): boolean {
  if ((err as { status?: unknown })?.status === 404) return true
  return err instanceof Error && /status 404\b/.test(err.message)
}

/**
 * Creates the tutorial from a reviewed draft. Only the create and the
 * contributor link can fail the whole thing (they throw, exactly as the blank
 * flow's do); everything after is best effort and reported in `failed`, since
 * the editor shows every section and the author checks them all anyway.
 *
 * Print settings go into the description as a note: STL rows carry their own
 * print settings, but an STL row only exists once a file is uploaded.
 */
export async function createGuideFromPdfDraft(
  api: PdfDraftApi,
  id: string,
  draft: PdfImportDraft,
  uploadPdf: (tutorialId: string) => Promise<string>
): Promise<PdfDraftResult> {
  const note = printSettingsNote(draft.print_settings)
  const description = [draft.summary, note].filter(Boolean).join('\n\n') || null

  await api.post('/api/tutorials', {
    id,
    title: draft.title?.trim() || 'Untitled guide',
    description,
    difficulty: draft.difficulty ?? 'easy',
    kind: draft.kind,
  })
  await api.post(`/api/contributors/me/tutorials/${id}`, {})

  const failed: PdfDraftResult['failed'] = []
  let stepsUnavailable = false

  // The PDF upload needs the contributor row, and its path is what the PATCH
  // stores, so the two run in order.
  let pdfPath: string | null = null
  try {
    pdfPath = await uploadPdf(id)
  } catch {
    failed.push('pdf')
  }

  const details: Record<string, unknown> = {}
  if (pdfPath) details.tutorial_pdf_url = pdfPath
  if (draft.build_minutes != null) details.build_minutes = draft.build_minutes
  if (draft.age_min != null) details.age_min = draft.age_min
  if (draft.age_max != null) details.age_max = draft.age_max
  if (Object.keys(details).length) {
    try {
      const current = await api.get<{ updated_at: string }>(`/api/tutorials/${id}`)
      await api.patch(`/api/tutorials/${id}`, { ...details, updated_at: current.updated_at })
    } catch {
      failed.push('details')
    }
  }

  if (draft.parts.length) {
    try {
      await api.post(`/api/tutorials/${id}/parts`, {
        parts: draft.parts.map((p) => ({ name: p.name, quantity: p.quantity, is_optional: false, buy_links: [] })),
      })
    } catch {
      failed.push('parts')
    }
  }
  if (draft.tools.length) {
    try {
      await api.post(`/api/tutorials/${id}/tools`, {
        tools: draft.tools.map((t) => ({ name: t.name, is_optional: false, buy_links: [] })),
      })
    } catch {
      failed.push('tools')
    }
  }
  if (draft.steps.length) {
    try {
      await api.put(`/api/tutorials/${id}/steps`, { steps: draft.steps })
    } catch (err) {
      if (is404(err)) stepsUnavailable = true
      else failed.push('steps')
    }
  }

  return { failed, stepsUnavailable }
}
