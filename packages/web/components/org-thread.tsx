'use client'

/**
 * A conversation between one person and an organisation (077), from either
 * side. The chat itself is ExchangeChat's board variant; this adds only who is
 * on which side.
 *
 * Every leader answers as the organisation, so on the family's screen a
 * leader's message is signed "Rachel · Northbank" — the family is writing to
 * the org, and should see that the org answered. On a leader's screen other
 * leaders keep their own names, so a colleague's reply is not mistaken for
 * theirs.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OrgThread } from '@splat-connect/types'
import { ExchangeChat, ChatHead } from '@/components/exchange-chat'
import { browserApiClient } from '@/lib/browser-api-client'
import { apiErrorDetail } from '@splat-connect/types'

export function OrgThreadView({
  thread,
  viewerId,
  side,
  orgName,
  sendPath,
}: {
  /** null before the first message: the composer alone. */
  thread: OrgThread | null
  viewerId: string
  side: 'family' | 'org'
  orgName: string
  /** Where a new message is POSTed — the 'mine' route until a thread exists. */
  sendPath: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messages = thread?.messages ?? []

  const names = new Map(
    messages.map((m) => [m.sender_id, side === 'family' && m.from_org ? `${m.sender_name} · ${orgName}` : m.sender_name])
  )

  async function send(body: string) {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post(sendPath, { body })
      router.refresh()
    } catch (err) {
      setError(apiErrorDetail(err) ?? 'That did not send. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const other = side === 'family' ? orgName : (thread?.person_name ?? 'this family')

  return (
    <div className="flex flex-col gap-3">
      <ExchangeChat
        variant="board"
        head={
          <ChatHead
            name={other}
            sub={side === 'family' ? 'Every leader here reads this' : `Writing to ${orgName}`}
          />
        }
        messages={messages.map((m) => ({ id: m.id, sender_id: m.sender_id, kind: 'user', body: m.body, created_at: m.created_at }))}
        viewerId={viewerId}
        otherPartyName={other}
        nameFor={(id) => names.get(id) ?? 'Someone'}
        canSend
        busy={busy}
        onSend={send}
      />
      {messages.length === 0 && (
        <p className="text-sm text-muted">
          Say who you are and what you are hoping for. Any of {orgName}&rsquo;s leaders can answer.
        </p>
      )}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
    </div>
  )
}
