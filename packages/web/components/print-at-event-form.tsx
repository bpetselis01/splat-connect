'use client'
/**
 * Ask an event's host to print a guide's parts before the day.
 *
 * Guides come from the person's saves, then the parts of the one they pick.
 * POST /api/toy-transactions/print-at-event files the same kind of request as
 * a job sent to a printer, so it appears under My events and in the host's
 * part queue. The server's sentences (no parts ticked, no room left, a request
 * already open) are shown as written.
 *
 * Related files:
 * - packages/api/src/routes/toy-transactions.ts: POST /print-at-event
 * - app/get-involved/events/[id]/page.tsx: the only place this is drawn
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Printer } from '@phosphor-icons/react/dist/ssr'
import { apiMessage, type StlFile, type Tutorial } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

type Saved = Pick<Tutorial, 'id' | 'title'>
type Guide = Tutorial & { stl_files: StlFile[] }

export function PrintAtEventForm({ eventId, maxSets }: { eventId: string; maxSets: number }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<Saved[] | null>(null)
  const [guideId, setGuideId] = useState('')
  const [guide, setGuide] = useState<Guide | null>(null)
  const [parts, setParts] = useState<string[]>([])
  const [sets, setSets] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!open || saved) return
    browserApiClient
      .get<Saved[]>('/api/saves/tutorials')
      .then(setSaved)
      .catch((e) => setError(apiMessage(e, 'Could not load your saved guides.')))
  }, [open, saved])

  async function pick(id: string) {
    setGuideId(id)
    setGuide(null)
    if (!id) return
    try {
      const g = await browserApiClient.get<Guide>(`/api/public/tutorials/${id}`)
      setGuide(g)
      setParts(g.stl_files.map((f) => f.id))
    } catch (e) {
      setError(apiMessage(e, 'Could not load that guide.'))
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await browserApiClient.post('/api/toy-transactions/print-at-event', {
        event_id: eventId,
        tutorial_id: guideId,
        stl_file_ids: parts,
        part_sets: sets,
        note: note.trim() || undefined,
      })
      setSent(true)
    } catch (err) {
      setError(apiMessage(err, 'That did not send. Try once more.'))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <p role="status" className="rounded-[14px] bg-[var(--tmint)] px-4 py-3 text-sm text-[var(--tink)]">
        Sent. The host will confirm in{' '}
        <Link href="/dashboard/events" className="font-extrabold underline">
          My events
        </Link>
        .
      </p>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn min-h-11 w-fit border-line bg-[var(--surface)] px-[18px] text-sm text-ink">
        <Printer weight="bold" aria-hidden="true" />
        Print parts here
      </button>
    )
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-[var(--surface2)] p-4">
      {saved && saved.length === 0 ? (
        <p className="text-sm text-muted">
          Save a guide first. This picks from the guides you have saved.{' '}
          <Link href="/library" className="font-extrabold underline">
            Browse guides
          </Link>
        </p>
      ) : (
        <>
          <label className="block">
            <span className="mb-[7px] block text-sm font-extrabold text-ink">Guide</span>
            <select value={guideId} onChange={(e) => void pick(e.target.value)} className="field" required>
              <option value="">Pick a saved guide</option>
              {(saved ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>

          {guide && (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1 text-sm font-extrabold text-ink">Parts</legend>
                {guide.stl_files.map((f) => (
                  <label key={f.id} className="flex items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={parts.includes(f.id)}
                      onChange={(e) => setParts((cur) => (e.target.checked ? [...cur, f.id] : cur.filter((x) => x !== f.id)))}
                      className="h-[18px] w-[18px] accent-[var(--b600)]"
                    />
                    {f.filename}
                  </label>
                ))}
              </fieldset>
              <label className="block">
                <span className="mb-[7px] block text-sm font-extrabold text-ink">Sets (the host has room for up to {maxSets})</span>
                <input type="number" min={1} max={maxSets} value={sets} onChange={(e) => setSets(Number(e.target.value))} className="field !w-[110px]" />
              </label>
              <label className="block">
                <span className="mb-[7px] block text-sm font-extrabold text-ink">Note to the host (optional)</span>
                <textarea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
              </label>
            </>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {saved && saved.length > 0 && (
        <button type="submit" disabled={busy || !guide} className="btn btn-primary min-h-11 w-fit px-5 text-sm">
          {busy ? 'Sending…' : 'Send request'}
        </button>
      )}
    </form>
  )
}
