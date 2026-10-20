'use client'
/**
 * Ask first (makers-ask-first): the private thread between one maker and the
 * family before anyone claims. The family picks the maker by ?maker=; a maker
 * sees their own. Server-rendered data, refreshed after each send.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BuildQuestions } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function BuildQuestionsThread({ data, viewerId, makerId, isAdmin = false }: { data: BuildQuestions; viewerId: string; makerId: string | null; isAdmin?: boolean }) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const thread = data.family ? data.threads.find((t) => t.maker_id === (makerId ?? data.threads[0]?.maker_id)) : data.threads[0]
  const other = data.family ? thread?.maker_name ?? 'A maker' : `Family in ${data.requester_suburb ?? 'your area'}`

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post(
        `/api/toy-transactions/${data.transaction_id}/questions`,
        data.family ? { body, maker_id: thread!.maker_id } : { body }
      )
      setDraft('')
      router.refresh()
    } catch {
      setError('Could not send that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    setBusy(true)
    try {
      await browserApiClient.post(`/api/toy-transactions/${data.transaction_id}/claim`, {})
      router.push(`/dashboard/exchanges/build/${data.transaction_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through. Try once more.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card p-5" style={{ background: 'var(--tmint)', color: 'var(--tink)' }}>
        <p className="text-xs font-extrabold uppercase tracking-[.08em]">Asking first</p>
        <p className="mt-1 font-display text-xl font-extrabold">Not claimed yet</p>
        <p className="mt-1 text-sm leading-[1.5]">Ask about the parts or the switch. Claiming is one tap when you are ready.</p>
      </div>
      <h1 className="font-display text-2xl font-extrabold text-ink">{data.tutorial_title}</h1>

      {data.family && data.threads.length > 1 && (
        <nav aria-label="Makers who asked" className="flex flex-wrap gap-2">
          {data.threads.map((t) => (
            <Link
              key={t.maker_id}
              href={`?maker=${t.maker_id}`}
              aria-current={t.maker_id === thread?.maker_id ? 'page' : undefined}
              className={`chip ${t.maker_id === thread?.maker_id ? 'bg-[var(--b100)]' : ''}`}
            >
              {t.maker_name}
            </Link>
          ))}
        </nav>
      )}

      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {(thread?.messages ?? []).map((m) => (
          <li key={m.id} className={`max-w-[80%] rounded-[18px] px-4 py-3 text-[15px] ${m.sender_id === viewerId ? 'self-end bg-[var(--b100)]' : 'bg-[var(--surface2)]'}`}>
            {m.sender_id !== viewerId && <span className="block text-xs font-extrabold text-muted">{other}</span>}
            {m.body}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      {data.open && (!data.family || thread) && (
        <form onSubmit={send} className="flex items-start gap-2.5">
          <textarea aria-label="Message" placeholder="Message" rows={2} maxLength={1000} value={draft} onChange={(e) => setDraft(e.target.value)} className="field flex-1" />
          <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary min-h-11 px-[18px]">
            Send
          </button>
        </form>
      )}
      {data.open && !data.family && !isAdmin && (
        <button type="button" disabled={busy} onClick={claim} className="btn btn-primary min-h-12 self-start px-[22px]">
          I&apos;ll build this
        </button>
      )}
    </div>
  )
}
