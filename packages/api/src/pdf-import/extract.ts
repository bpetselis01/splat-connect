/**
 * The PDF-reading half of "Start from a PDF": pdf.js (through unpdf, which
 * ships a Node-ready build) gives positioned text runs; parse.ts does the rest.
 * Images are not read — the draft says so.
 */
import { getDocumentProxy } from 'unpdf'
import type { PdfImportDraft } from '@splat-connect/types'
import { parseGuide, type TextItem } from './parse.js'

/** Past this the draft would be too long to review anyway. */
const MAX_PAGES = 60

export async function readPdfItems(data: Uint8Array): Promise<{ items: TextItem[]; pageCount: number; truncated: boolean }> {
  // verbosity 0: pdf.js otherwise logs font warnings ("TT: undefined function") for ordinary files.
  const pdf = await getDocumentProxy(data, { verbosity: 0 })
  try {
    const pageCount = Math.min(pdf.numPages, MAX_PAGES)
    const items: TextItem[] = []
    for (let page = 1; page <= pageCount; page++) {
      const content = await (await pdf.getPage(page)).getTextContent()
      for (const it of content.items) {
        if (!('str' in it) || !it.str.trim()) continue
        const [a, b, c, d, x, y] = it.transform as number[]
        items.push({ page, str: it.str, x, y, w: it.width, size: Math.hypot(c, d) || Math.hypot(a, b) })
      }
    }
    return { items, pageCount, truncated: pdf.numPages > MAX_PAGES }
  } finally {
    await pdf.loadingTask.destroy()
  }
}

export async function importPdf(data: Uint8Array): Promise<PdfImportDraft> {
  const { items, pageCount, truncated } = await readPdfItems(data)
  const draft = parseGuide(items, pageCount)
  if (truncated) draft.warnings.unshift(`Only the first ${MAX_PAGES} pages were read.`)
  return draft
}
