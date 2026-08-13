'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Toy } from '@splat-connect/types'

export function NewToyForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [condition, setCondition] = useState(5)
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const toy = await browserApiClient.post<Toy>('/api/toys', {
        name,
        condition,
        description: description || null,
      })
      // Straight on to Photos: the Add page shows the same three pills, so
      // landing back on Details would look like the save had not taken.
      router.push(`/dashboard/toys/${toy.id}?step=photos`)
    } catch {
      setError('Could not create this toy. Please try again.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-4">
      <div>
        <label htmlFor="new-toy-name" className="field-label">Name</label>
        <input
          id="new-toy-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="field"
        />
      </div>

      <div>
        <label htmlFor="new-toy-condition" className="field-label">Condition (1–10)</label>
        <input
          id="new-toy-condition"
          type="number"
          min={1}
          max={10}
          value={condition}
          onChange={(e) => setCondition(Number(e.target.value))}
          className="field"
        />
      </div>

      <div>
        <label htmlFor="new-toy-description" className="field-label">Description</label>
        <textarea
          id="new-toy-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
