/**
 * POST /api/tutorials/import-pdf — "Start from a PDF". Reads a guide's PDF
 * and answers with a draft (title, parts, tools, steps, print settings, and
 * what could not be read). Writes nothing: the client shows the draft, the
 * author confirms, and the ordinary create/parts/tools/steps routes save it.
 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { importPdf } from '../pdf-import/extract.js'
import type { AuthVariables } from '../middleware/auth.js'

export const MAX_PDF_BYTES = 20 * 1024 * 1024

const pdfImport = new Hono<{ Variables: AuthVariables }>()

pdfImport.post(
  '/import-pdf',
  // Checked on the stream, before the multipart body is buffered. The slack is the multipart framing.
  bodyLimit({
    maxSize: MAX_PDF_BYTES + 64 * 1024,
    onError: (c) => c.json({ error: 'That PDF is over 20 MB.' }, 413),
  }),
  async (c) => {
    const form = await c.req.formData().catch(() => null)
    const file = form?.get('file')
    if (!(file instanceof File)) return c.json({ error: 'Attach the PDF as `file`.' }, 400)
    if (file.size > MAX_PDF_BYTES) return c.json({ error: 'That PDF is over 20 MB.' }, 413)

    const bytes = new Uint8Array(await file.arrayBuffer())
    // The bytes decide, not the declared type: phones often send application/octet-stream.
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
      return c.json({ error: 'That file is not a PDF.' }, 415)
    }

    try {
      return c.json(await importPdf(bytes))
    } catch {
      return c.json({ error: 'Could not read this PDF. It may be damaged or password-protected.' }, 422)
    }
  }
)

export default pdfImport
