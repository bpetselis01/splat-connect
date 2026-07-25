/**
 * Tutorial Upload (Create) Page
 * 
 * Multi-step wizard for creating a new tutorial (6 steps).
 * Only accessible to approved contributors.
 * 
 * Step breakdown:
 * 1. Details: Title, description, difficulty level
 * 2. Files: Upload tutorial PDF and toy photo
 * 3. Parts: Add materials needed (name, qty, buy links)
 * 4. Tools: Add tools needed (name, buy links)
 * 5. STL Files: Add 3D model files (optional)
 * 6. Review: Preview all data and submit for review
 * 
 * Data flow:
 * - Step 1 Next: POST /api/tutorials (draft) + POST contributor link
 * - Step 2 Next: PATCH tutorial with PDF + photo URLs
 * - Step 3 Next: POST /api/tutorials/:id/parts (replace-all)
 * - Step 4 Next: POST /api/tutorials/:id/tools (replace-all)
 * - Step 5 Next: POST /api/tutorials/:id/stl-files (replace-all, if any)
 * - Step 6 Submit: PATCH status draft→pending, redirect to /my-tutorials
 * 
 * Related files:
 * - lib/validation.ts: Step validation logic
 * - components/file-drop-zone.tsx: File upload UI
 * - components/buy-links-input.tsx: Material links form
 * - routes/tutorials.ts: API endpoints
 * - types/index.ts: UploadDraft type
 */
'use client'
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { canAdvanceFromStep, canSubmit } from '@/lib/validation'
import { FileDropZone } from '@/components/file-drop-zone'
import { BuyLinksInput } from '@/components/buy-links-input'
import type { UploadDraft, Difficulty, BuyLink } from '@splat-connect/types'

const STEPS = [
  'Details',
  'Files',
  'Parts',
  'Tools',
  'STL Files',
  'Review & Submit',
]

const EMPTY_DRAFT: UploadDraft = {
  title: '',
  description: '',
  difficulty: '',
  tutorial_pdf_url: null,
  toy_photo_url: null,
  parts: [],
  tools: [],
  stl_files: [],
}

export default function UploadPage() {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<UploadDraft>(EMPTY_DRAFT)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tutorialId] = useState(() => crypto.randomUUID())
  // draftSaved: true once the tutorial row exists in Supabase (created at Step 1 Next).
  // Used to switch from POST (first save) to PATCH (subsequent saves from Step 1).
  const [draftSaved, setDraftSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  async function uploadFile(endpoint: string, file: File): Promise<{ url: string; filename?: string }> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('tutorialId', tutorialId)
    return browserApiClient.postFormData(endpoint, fd)
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadFile('/api/upload/pdf', file)
      setDraft((d) => ({ ...d, tutorial_pdf_url: url }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadFile('/api/upload/photo', file)
      setDraft((d) => ({ ...d, toy_photo_url: url }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleStlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          const { url, filename } = await uploadFile('/api/upload/stl', file)
          return { filename: filename ?? file.name, file_url: url }
        })
      )
      setDraft((d) => ({ ...d, stl_files: [...d.stl_files, ...uploaded] }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Saves the current step's data to Supabase, then advances to the next step.
  // Each step persists only its own fields so the draft is built up incrementally.
  async function handleNext() {
    setSaving(true)
    setError(null)
    try {
      if (step === 1) {
        if (!draftSaved) {
          // First time through Step 1: create the draft row and link the contributor.
          await browserApiClient.post('/api/tutorials', {
            id: tutorialId,
            title: draft.title,
            description: draft.description || null,
            difficulty: draft.difficulty,
          })
          await browserApiClient.post(`/api/contributors/me/tutorials/${tutorialId}`, {})
          setDraftSaved(true)
        } else {
          // User went back to Step 1 and re-advanced: update the existing draft.
          await browserApiClient.patch(`/api/tutorials/${tutorialId}`, {
            title: draft.title,
            description: draft.description || null,
            difficulty: draft.difficulty,
          })
        }
      } else if (step === 2) {
        await browserApiClient.patch(`/api/tutorials/${tutorialId}`, {
          tutorial_pdf_url: draft.tutorial_pdf_url,
          toy_photo_url: draft.toy_photo_url,
        })
      } else if (step === 3) {
        await browserApiClient.post(`/api/tutorials/${tutorialId}/parts`, {
          parts: draft.parts,
        })
      } else if (step === 4) {
        await browserApiClient.post(`/api/tutorials/${tutorialId}/tools`, {
          tools: draft.tools,
        })
      } else if (step === 5 && draft.stl_files.length > 0) {
        await browserApiClient.post(`/api/tutorials/${tutorialId}/stl-files`, {
          stl_files: draft.stl_files,
        })
      }
      setStep((s) => s + 1)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    if (!canSubmit(draft)) return
    setSubmitting(true)
    setError(null)
    try {
      // All data already saved per-step — just transition the draft to pending for review.
      await browserApiClient.patch(`/api/tutorials/${tutorialId}`, { status: 'pending' })
      window.location.href = '/my-tutorials'
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  const canAdvance = canAdvanceFromStep(step, draft)

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-ink">Upload a tutorial</h1>

      {/* Step indicator — decorative; the line below it is the accessible status */}
      <div aria-hidden="true" className="mb-3 flex gap-1">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              i + 1 < step
                ? 'bg-mint'
                : i + 1 === step
                ? 'bg-brand-dark'
                : 'bg-line'
            }`}
          />
        ))}
      </div>
      <p aria-live="polite" className="mb-5 text-sm text-muted">
        Step {step} of {STEPS.length}:{' '}
        <strong className="text-ink">{STEPS[step - 1]}</strong>
      </p>

      {error && (
        <p role="alert" className="alert alert-danger mb-4">
          {error}
        </p>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="upload-title" className="field-label">Toy name *</label>
            <input
              id="upload-title"
              type="text"
              className="field"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Fisher-Price Piano"
            />
          </div>
          <div>
            <label htmlFor="upload-description" className="field-label">Description</label>
            <textarea
              id="upload-description"
              className="field"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Brief description of the adaptation"
            />
          </div>
          <fieldset>
            <legend className="field-label">Difficulty *</legend>
            <div className="flex flex-wrap gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={draft.difficulty === d}
                  onClick={() => setDraft((s) => ({ ...s, difficulty: d }))}
                  className="chip capitalize"
                >
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {/* Step 2: Files */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="field-label">Tutorial PDF *</label>
            <FileDropZone
              name="tutorial_pdf"
              accept=".pdf"
              label="Tutorial PDF"
              onChange={handlePdfUpload}
              currentFileLabel={draft.tutorial_pdf_url ? 'PDF uploaded ✓' : undefined}
            />
          </div>
          <div>
            <label className="field-label">Photo of finished toy *</label>
            <FileDropZone
              name="toy_photo"
              accept="image/*"
              label="Photo of Finished Toy"
              onChange={handlePhotoUpload}
              currentFileLabel={draft.toy_photo_url ? 'Photo uploaded ✓' : undefined}
            />
          </div>
          {uploading && <p className="text-sm font-semibold text-brand-dark">Uploading…</p>}
        </div>
      )}

      {/* Step 3: Parts */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Add at least one part (materials needed).</p>
          {draft.parts.map((part, i) => (
            <div key={i} className="card flex flex-col gap-2 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Part name *"
                  className="field field-sm flex-1"
                  value={part.name}
                  onChange={(e) =>
                    setDraft((d) => {
                      const parts = [...d.parts]
                      parts[i] = { ...parts[i], name: e.target.value }
                      return { ...d, parts }
                    })
                  }
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  aria-label="Quantity"
                  className="field field-sm w-20 shrink-0"
                  value={part.quantity}
                  onChange={(e) =>
                    setDraft((d) => {
                      const parts = [...d.parts]
                      parts[i] = { ...parts[i], quantity: parseInt(e.target.value) || 1 }
                      return { ...d, parts }
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Remove part"
                  onClick={() =>
                    setDraft((d) => ({ ...d, parts: d.parts.filter((_, j) => j !== i) }))
                  }
                  className="shrink-0 rounded-full px-2 text-sm text-danger transition-colors hover:bg-apricot-soft"
                >
                  ✕
                </button>
              </div>
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={part.is_optional}
                  onChange={(e) =>
                    setDraft((d) => {
                      const parts = [...d.parts]
                      parts[i] = { ...parts[i], is_optional: e.target.checked }
                      return { ...d, parts }
                    })
                  }
                  className="field-check"
                />
                Optional (not required)
              </label>
              <div>
                <p className="mb-1 text-xs font-bold text-muted">Buy links</p>
                <BuyLinksInput
                  initialLinks={part.buy_links}
                  onChange={(links: BuyLink[]) =>
                    setDraft((d) => {
                      const parts = [...d.parts]
                      parts[i] = { ...parts[i], buy_links: links }
                      return { ...d, parts }
                    })
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                parts: [
                  ...d.parts,
                  { name: '', quantity: 1, is_optional: false, buy_links: [] },
                ],
              }))
            }
            className="rounded-2xl border-2 border-dashed border-line py-3 text-sm font-bold text-brand-deep transition-colors hover:border-brand-soft hover:bg-sunken"
          >
            + Add part
          </button>
        </div>
      )}

      {/* Step 4: Tools */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">Add at least one tool required for the adaptation.</p>
          {draft.tools.map((tool, i) => (
            <div key={i} className="card flex flex-col gap-2 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tool name *"
                  className="field field-sm flex-1"
                  value={tool.name}
                  onChange={(e) =>
                    setDraft((d) => {
                      const tools = [...d.tools]
                      tools[i] = { ...tools[i], name: e.target.value }
                      return { ...d, tools }
                    })
                  }
                />
                <button
                  type="button"
                  aria-label="Remove tool"
                  onClick={() =>
                    setDraft((d) => ({ ...d, tools: d.tools.filter((_, j) => j !== i) }))
                  }
                  className="shrink-0 rounded-full px-2 text-sm text-danger transition-colors hover:bg-apricot-soft"
                >
                  ✕
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={tool.is_optional}
                  onChange={(e) =>
                    setDraft((d) => {
                      const tools = [...d.tools]
                      tools[i] = { ...tools[i], is_optional: e.target.checked }
                      return { ...d, tools }
                    })
                  }
                  className="field-check"
                />
                Optional (not required)
              </label>
              <div>
                <p className="mb-1 text-xs font-bold text-muted">Buy links</p>
                <BuyLinksInput
                  initialLinks={tool.buy_links}
                  onChange={(links: BuyLink[]) =>
                    setDraft((d) => {
                      const tools = [...d.tools]
                      tools[i] = { ...tools[i], buy_links: links }
                      return { ...d, tools }
                    })
                  }
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                tools: [...d.tools, { name: '', is_optional: false, buy_links: [] }],
              }))
            }
            className="rounded-2xl border-2 border-dashed border-line py-3 text-sm font-bold text-brand-deep transition-colors hover:border-brand-soft hover:bg-sunken"
          >
            + Add tool
          </button>
        </div>
      )}

      {/* Step 5: STL files */}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-relaxed text-muted">
            Upload STL files if this adaptation requires 3D-printed parts. Optional.
          </p>
          <FileDropZone
            name="stl_files"
            accept=".stl"
            multiple
            label="STL Files"
            onChange={handleStlUpload}
          />
          {uploading && <p className="text-sm font-semibold text-brand-dark">Uploading…</p>}
          {draft.stl_files.length > 0 && (
            <div className="flex flex-col gap-1">
              {draft.stl_files.map((f, i) => (
                <div
                  key={i}
                  className="card-flat flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                >
                  <span className="truncate">{f.filename}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        stl_files: d.stl_files.filter((_, j) => j !== i),
                      }))
                    }
                    className="shrink-0 text-xs font-bold text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 6: Review */}
      {step === 6 && (
        <div className="flex flex-col gap-4 text-sm">
          <div className="card flex flex-col gap-2 p-5">
            <p>
              <strong>Title:</strong> {draft.title}
            </p>
            <p>
              <strong>Difficulty:</strong> {draft.difficulty}
            </p>
            {draft.description && (
              <p>
                <strong>Description:</strong> {draft.description}
              </p>
            )}
            <p>
              <strong>PDF:</strong> {draft.tutorial_pdf_url ? '✓ Uploaded' : '✗ Missing'}
            </p>
            <p>
              <strong>Photo:</strong> {draft.toy_photo_url ? '✓ Uploaded' : '✗ Missing'}
            </p>
            <p>
              <strong>Parts:</strong> {draft.parts.length}
            </p>
            <p>
              <strong>Tools:</strong> {draft.tools.length}
            </p>
            <p>
              <strong>STL files:</strong> {draft.stl_files.length}
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Your tutorial will be reviewed by the SPLAT admin before it appears publicly.
          </p>
          <button
            type="button"
            disabled={!canSubmit(draft) || submitting}
            onClick={handleSubmit}
            className="btn btn-accent btn-block"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="btn btn-quiet"
        >
          ← Back
        </button>
        {step < STEPS.length && (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance || uploading || saving}
            className="btn btn-primary"
          >
            {saving ? 'Saving…' : 'Next →'}
          </button>
        )}
      </div>
    </div>
  )
}
