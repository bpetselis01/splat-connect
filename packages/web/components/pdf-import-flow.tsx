'use client'
/**
 * "Start from a PDF" on /upload: the author picks their guide's PDF, the API
 * reads it (POST /api/tutorials/import-pdf — text heuristics, no AI), and
 * this shows what was found before anything is saved. "Create draft" then
 * runs createGuideFromPdfDraft, which also stores the PDF as the guide's PDF
 * so it is not uploaded twice, and lands in the editor with a banner.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { ArrowRight, CheckCircle, FilePdf, MinusCircle } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { apiErrorDetail } from '@/lib/api-core'
import { createGuideFromPdfDraft, printSettingsNote, KIND_LABEL } from '@splat-connect/types'
import type { PdfImportDraft, TutorialKind } from '@splat-connect/types'

const MAX_BYTES = 20 * 1024 * 1024

/** The checklist rows: what the draft will carry into the editor. */
export function foundSections(draft: PdfImportDraft): { label: string; found: string | null }[] {
  const count = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : null)
  return [
    { label: 'Description', found: draft.summary ? 'First paragraph' : null },
    { label: 'Parts', found: count(draft.parts.length, 'part', 'parts') },
    { label: 'Tools', found: count(draft.tools.length, 'tool', 'tools') },
    { label: 'Steps', found: count(draft.steps.length, 'step', 'steps') },
    {
      label: 'Print settings',
      found: printSettingsNote(draft.print_settings) ? 'Added to the description as a note' : null,
    },
    { label: 'Build time', found: draft.build_minutes ? `${draft.build_minutes} min` : null },
  ]
}

/** Where the editor opens, with what the banner needs to say. */
export function editorUrl(id: string, r: { failed: string[]; stepsUnavailable: boolean }): string {
  const q = new URLSearchParams({ step: 'files', created: '1', from: 'pdf' })
  if (r.stepsUnavailable) q.set('steps', 'later')
  if (r.failed.length) q.set('missed', r.failed.join(','))
  return `/tutorials/${id}/edit?${q}`
}

export function PdfImportFlow() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [draft, setDraft] = useState<PdfImportDraft | null>(null)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TutorialKind>('toy_adaptation')
  const [busy, setBusy] = useState<'reading' | 'creating' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function read(picked: File) {
    setError(null)
    if (picked.type && picked.type !== 'application/pdf') return setError('Choose a PDF file.')
    if (picked.size > MAX_BYTES) return setError('That PDF is over 20 MB.')
    setFile(picked)
    setBusy('reading')
    try {
      const fd = new FormData()
      fd.append('file', picked)
      const d = await browserApiClient.postFormData<PdfImportDraft>('/api/tutorials/import-pdf', fd)
      setDraft(d)
      setTitle(d.title ?? '')
      setKind(d.kind)
    } catch (err) {
      setError(apiErrorDetail(err) ?? 'Could not read this PDF. Please try again.')
      setFile(null)
    } finally {
      setBusy(null)
    }
  }

  async function create() {
    if (!draft || !file) return
    setBusy('creating')
    setError(null)
    const id = crypto.randomUUID()
    try {
      const result = await createGuideFromPdfDraft(browserApiClient, id, { ...draft, title, kind }, async (tutorialId) => {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('tutorialId', tutorialId)
        return (await browserApiClient.postFormData<{ url: string }>('/api/upload/pdf', fd)).url
      })
      router.push(editorUrl(id, result) as Route<string>)
    } catch {
      setError('Could not create this tutorial. Please try again.')
      setBusy(null)
    }
  }

  if (!draft) {
    return (
      <div className="upload-card">
        <div>
          <label htmlFor="pdf-import-file" className="upload-card__label">
            Your guide as a PDF
          </label>
          <label
            htmlFor="pdf-import-file"
            className="upload-cover"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) void read(f)
            }}
          >
            <span className="flex flex-col items-center gap-2 text-[13px] font-bold text-muted">
              <FilePdf size={26} aria-hidden="true" />
              {busy === 'reading' ? `Reading ${file?.name ?? 'the PDF'}…` : 'Drop the PDF here, or click to choose it'}
            </span>
          </label>
          <input
            id="pdf-import-file"
            type="file"
            accept="application/pdf"
            disabled={busy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void read(f)
            }}
            className="sr-only"
          />
          <p className="mt-2 text-[13px] text-muted">
            We read the PDF&apos;s text and fill in what we can — title, parts, tools, steps and print
            settings. It is a best guess from the text, not a finished guide, and photos inside the PDF
            are not copied. Up to 20 MB.
          </p>
        </div>
        {error && (
          <p role="alert" className="alert alert-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  const sections = foundSections(draft)
  return (
    <div className="upload-card">
      <div>
        <p className="upload-card__label">What we found in {file?.name}</p>
        <ul className="flex flex-col gap-1.5" aria-label="What was found">
          {sections.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-[14px]">
              {s.found ? (
                <CheckCircle size={18} weight="fill" className="flex-none text-success" aria-hidden="true" />
              ) : (
                <MinusCircle size={18} className="flex-none text-muted" aria-hidden="true" />
              )}
              <span className="font-bold">{s.label}</span>
              <span className="text-muted">— {s.found ?? 'not found'}</span>
            </li>
          ))}
        </ul>
      </div>

      {draft.warnings.length > 0 && (
        <div className="alert alert-warning">
          <p className="font-bold">What could not be read</p>
          <ul className="mt-1 list-disc pl-5">
            {draft.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="pdf-import-title" className="upload-card__label">Title</label>
        <input
          id="pdf-import-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="field upload-card__field"
        />
      </div>

      <div>
        <span className="upload-card__label" id="pdf-import-kind">
          What kind of guide is this?
        </span>
        <div role="radiogroup" aria-labelledby="pdf-import-kind" className="flex flex-wrap gap-2">
          {(['toy_adaptation', 'assistive_tech'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className="kind-card"
            >
              <span className="text-[14px] font-extrabold">{KIND_LABEL[k]}</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">Our guess from the PDF&apos;s words — change it if it is wrong.</p>
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={create} disabled={busy !== null || !title.trim()} className="btn btn-primary">
          {busy === 'creating' ? 'Creating…' : 'Create draft'}
          {busy !== 'creating' && <ArrowRight size={18} weight="bold" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(null)
            setFile(null)
          }}
          disabled={busy !== null}
          className="btn btn-quiet"
        >
          Choose a different PDF
        </button>
      </div>
      <p className="text-[13px] text-muted">
        The PDF is saved as the guide&apos;s downloadable PDF too, so you will not upload it twice.
      </p>
    </div>
  )
}
