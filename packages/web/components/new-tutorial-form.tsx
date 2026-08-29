'use client'
/**
 * Creates the tutorial row and hands straight over to the editor, replacing
 * the six-step wizard this page used to run. Everything the wizard collected
 * after step 1 — files, parts, tools, STL, backing, submit — already exists as
 * a step on the edit page, so the wizard was a second implementation of all of
 * it plus a sessionStorage draft to survive the walk.
 *
 * The id is generated here rather than by the database, which is what makes
 * POST /api/tutorials retry-safe: the route turns a duplicate-key error back
 * into a success for the same id.
 */
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Difficulty } from '@splat-connect/types'

export function NewTutorialForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const id = crypto.randomUUID()
      await browserApiClient.post('/api/tutorials', {
        id,
        title,
        description: description || null,
        difficulty,
      })
      await browserApiClient.post(`/api/contributors/me/tutorials/${id}`, {})
      // Straight on to Files: this page shows the same pills, so landing back
      // on Details would look like the save had not taken.
      //
      // created=1 is what makes the handover audible. Both pages draw the same
      // eight pills and the same panel, so a silent redirect reads as being
      // thrown somewhere else rather than as a step completed; EditStepper
      // turns this into a toast and drops it from the URL.
      router.push(`/tutorials/${id}/edit?step=files&created=1` as Route<string>)
    } catch {
      setError('Could not create this tutorial. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-4">
      <div>
        <label htmlFor="new-tutorial-title" className="field-label">Title</label>
        <input
          id="new-tutorial-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="field"
        />
      </div>

      <div>
        <label htmlFor="new-tutorial-difficulty" className="field-label">Difficulty</label>
        <select
          id="new-tutorial-difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          className="field"
        >
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div>
        <label htmlFor="new-tutorial-description" className="field-label">Description</label>
        <textarea
          id="new-tutorial-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="field"
        />
      </div>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn btn-accent self-start">
        {busy ? 'Creating…' : 'Create'}
      </button>
    </form>
  )
}
