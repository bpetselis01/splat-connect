'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
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
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<UploadDraft>(EMPTY_DRAFT)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tutorialId] = useState(() => crypto.randomUUID())
  const [tutorialInserted, setTutorialInserted] = useState(false)

  async function uploadFile(
    bucket: string,
    file: File,
    pathSuffix: string
  ): Promise<string> {
    const path = `${tutorialId}/${pathSuffix}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile('tutorial-pdfs', file, 'tutorial.pdf')
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
      const ext = file.name.split('.').pop()
      const url = await uploadFile('toy-photos', file, `photo.${ext}`)
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
          const url = await uploadFile('stl-files', file, `stl/${file.name}`)
          return { filename: file.name, file_url: url }
        })
      )
      setDraft((d) => ({ ...d, stl_files: [...d.stl_files, ...uploaded] }))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit() {
    if (!canSubmit(draft)) return
    setSubmitting(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (tutorialInserted) {
        const { error } = await supabase.from('tutorials').update({
          title: draft.title,
          description: draft.description || null,
          difficulty: draft.difficulty,
          tutorial_pdf_url: draft.tutorial_pdf_url,
          toy_photo_url: draft.toy_photo_url,
        }).eq('id', tutorialId)
        if (error) throw new Error(`Draft update: ${error.message}`)
      } else {
        const { error } = await supabase.from('tutorials').insert({
          id: tutorialId,
          title: draft.title,
          description: draft.description || null,
          difficulty: draft.difficulty,
          status: 'draft',
          tutorial_pdf_url: draft.tutorial_pdf_url,
          toy_photo_url: draft.toy_photo_url,
        })
        if (error) throw new Error(`Insert: ${error.message}`)
        setTutorialInserted(true)
      }

      // ignoreDuplicates handles retries — contributors have no DELETE policy so
      // delete+re-insert would hit a duplicate key on the second attempt
      const { error: tcError } = await supabase.from('tutorial_contributors').upsert({
        tutorial_id: tutorialId,
        profile_id: user.id,
        role: 'primary',
      }, { ignoreDuplicates: true })
      if (tcError) throw new Error(`Contributor: ${tcError.message}`)

      // Clean up parts/tools from a previous failed attempt before re-inserting
      await supabase.from('parts').delete().eq('tutorial_id', tutorialId)
      await supabase.from('tools').delete().eq('tutorial_id', tutorialId)

      if (draft.parts.length > 0) {
        const { error: partsError } = await supabase.from('parts').insert(
          draft.parts.map((p) => ({
            tutorial_id: tutorialId,
            name: p.name,
            quantity: p.quantity,
            is_optional: p.is_optional,
            buy_links: p.buy_links,
          }))
        )
        if (partsError) throw new Error(`Parts: ${partsError.message}`)
      }

      if (draft.tools.length > 0) {
        const { error: toolsError } = await supabase.from('tools').insert(
          draft.tools.map((t) => ({
            tutorial_id: tutorialId,
            name: t.name,
            is_optional: t.is_optional,
            buy_links: t.buy_links,
          }))
        )
        if (toolsError) throw new Error(`Tools: ${toolsError.message}`)
      }

      if (draft.stl_files.length > 0) {
        const { error: stlError } = await supabase.from('stl_files').insert(
          draft.stl_files.map((f) => ({
            tutorial_id: tutorialId,
            filename: f.filename,
            file_url: f.file_url,
          }))
        )
        if (stlError) throw new Error(`STL files: ${stlError.message}`)
      }

      // Promote to pending now that all related data is inserted
      const { error: updateError } = await supabase
        .from('tutorials')
        .update({ status: 'pending' })
        .eq('id', tutorialId)
      if (updateError) throw new Error(updateError.message)

      router.refresh()
      router.push('/my-tutorials')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
      setSubmitting(false)
    }
  }

  const canAdvance = canAdvanceFromStep(step, draft)

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload a tutorial</h1>

      {/* Step indicator */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i + 1 < step
                ? 'bg-green-500'
                : i + 1 === step
                ? 'bg-[#1e3a5f]'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Step {step} of {STEPS.length}: <strong>{STEPS[step - 1]}</strong>
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Toy name *</label>
            <input
              type="text"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Fisher-Price Piano"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Brief description of the adaptation"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Difficulty *</label>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDraft((s) => ({ ...s, difficulty: d }))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize border transition-colors ${
                    draft.difficulty === d
                      ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Files */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Tutorial PDF *</label>
            <FileDropZone
              name="tutorial_pdf"
              accept=".pdf"
              label="Tutorial PDF"
              onChange={handlePdfUpload}
              currentFileLabel={draft.tutorial_pdf_url ? 'PDF uploaded ✓' : undefined}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Photo of finished toy *</label>
            <FileDropZone
              name="toy_photo"
              accept="image/*"
              label="Photo of Finished Toy"
              onChange={handlePhotoUpload}
              currentFileLabel={draft.toy_photo_url ? 'Photo uploaded ✓' : undefined}
            />
          </div>
          {uploading && <p className="text-blue-600 text-sm">Uploading…</p>}
        </div>
      )}

      {/* Step 3: Parts */}
      {step === 3 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Add at least one part (materials needed).</p>
          {draft.parts.map((part, i) => (
            <div key={i} className="bg-white border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Part name *"
                  className="flex-1 border rounded px-2 py-1 text-sm"
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
                  className="w-16 border rounded px-2 py-1 text-sm"
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
                  className="text-red-500 text-sm px-2"
                >
                  ✕
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
                  className="rounded"
                />
                Optional (not required)
              </label>
              <div>
                <p className="text-xs text-gray-500 mb-1">Buy links</p>
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
            className="border-2 border-dashed rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            + Add part
          </button>
        </div>
      )}

      {/* Step 4: Tools */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Add at least one tool required for the adaptation.</p>
          {draft.tools.map((tool, i) => (
            <div key={i} className="bg-white border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tool name *"
                  className="flex-1 border rounded px-2 py-1 text-sm"
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
                  className="text-red-500 text-sm px-2"
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
                  className="rounded"
                />
                Optional (not required)
              </label>
              <div>
                <p className="text-xs text-gray-500 mb-1">Buy links</p>
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
            className="border-2 border-dashed rounded-lg py-2 text-sm text-gray-500 hover:bg-gray-50"
          >
            + Add tool
          </button>
        </div>
      )}

      {/* Step 5: STL files */}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Upload STL files if this adaptation requires 3D-printed parts. Optional.
          </p>
          <FileDropZone
            name="stl_files"
            accept=".stl"
            multiple
            label="STL Files"
            onChange={handleStlUpload}
          />
          {uploading && <p className="text-blue-600 text-sm">Uploading…</p>}
          {draft.stl_files.length > 0 && (
            <div className="flex flex-col gap-1">
              {draft.stl_files.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm bg-white border rounded px-3 py-1.5"
                >
                  <span>{f.filename}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        stl_files: d.stl_files.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-red-500 text-xs"
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
          <div className="bg-white border rounded-lg p-4 flex flex-col gap-2">
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
          <p className="text-gray-500 text-xs">
            Your tutorial will be reviewed by the SPLAT admin before it appears publicly.
          </p>
          <button
            type="button"
            disabled={!canSubmit(draft) || submitting}
            onClick={handleSubmit}
            className="bg-orange-500 text-white rounded-lg py-2.5 font-semibold hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-30"
        >
          ← Back
        </button>
        {step < STEPS.length && (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance || uploading}
            className="px-4 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#16304f] disabled:opacity-50"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  )
}
