'use client'
import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'
import type { Organization, Toy } from '@splat-connect/types'

export function NewToyForm({ ledOrgs = [] }: { ledOrgs?: Organization[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [condition, setCondition] = useState(5)
  const [description, setDescription] = useState('')
  // Empty string means "mine". A leader adding a personal toy is the ordinary
  // case and stays the default, so leadership never quietly redirects a toy
  // away from the person who added it.
  const [orgId, setOrgId] = useState('')
  const [quantity, setQuantity] = useState(1)
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
        ...(orgId ? { owner_org_id: orgId, quantity } : {}),
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

      {/* Only a leader ever sees this. For everyone else there is one possible
          answer, and a select with one option is a question not worth asking. */}
      {ledOrgs.length > 0 && (
        <div>
          <label htmlFor="new-toy-owner" className="field-label">Who holds this toy</label>
          <select
            id="new-toy-owner"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="field"
          >
            <option value="">Me</option>
            {ledOrgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Stock only means something for an organisation: a person holds one
          object, which is a rule the database enforces rather than assumes. */}
      {orgId && (
        <div>
          <label htmlFor="new-toy-quantity" className="field-label">How many do you hold</label>
          <input
            id="new-toy-quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="field"
          />
          <p className="mt-1 text-xs text-muted">
            Five of the same bear is one listing with a count of five, not five listings.
          </p>
        </div>
      )}

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
