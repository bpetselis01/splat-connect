/**
 * The conversation half of an exchange thread: messages, and the composer that
 * adds to them. Split out of toy-transaction-thread.tsx, which now owns only the
 * transaction's state machine and the sidebar that drives it.
 *
 * Consecutive messages from one sender are grouped so a run reads as one turn
 * rather than a stack of identical boxes, and the avatar and attribution appear
 * once per group instead of once per line.
 */
'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { ToyTransactionMessage } from '@splat-connect/types'

/*
 * ponytail: locale and timezone are pinned rather than read from the browser.
 * These strings are rendered during SSR too, and an Intl default that differs
 * between the server and the client is a hydration mismatch on every timestamp.
 * The app already assumes Australian addresses (state + postcode on pickup), so
 * one Australian timezone is a smaller lie than a mismatched clock. If the
 * product ever ships outside AEST, render the stamps client-side after mount.
 */
const LOCALE = 'en-AU'
const TZ = 'Australia/Melbourne'
const timeFormat = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TZ,
})
const dayFormat = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: TZ,
})
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ })

type Group = {
  senderId: string
  kind: ToyTransactionMessage['kind']
  messages: ToyTransactionMessage[]
  /** First group of its calendar day, so it carries the date separator. */
  opensDay: boolean
}

/**
 * Consecutive messages from one sender, of one kind, become a single turn.
 *
 * Day boundaries are resolved here rather than while rendering: deciding them
 * inside the map would mean carrying a running value across iterations, which is
 * a render-time mutation React's compiler rejects outright.
 */
function groupMessages(messages: ToyTransactionMessage[]): Group[] {
  const groups: Group[] = []
  let lastDayKey = ''

  for (const m of messages) {
    const dayKey = dayKeyFormat.format(new Date(m.created_at))
    const last = groups[groups.length - 1]
    if (last && last.senderId === m.sender_id && last.kind === m.kind && dayKey === lastDayKey) {
      last.messages.push(m)
      continue
    }
    groups.push({
      senderId: m.sender_id,
      kind: m.kind,
      messages: [m],
      opensDay: dayKey !== lastDayKey,
    })
    lastDayKey = dayKey
  }

  return groups
}

export function ExchangeChat({
  messages,
  viewerId,
  otherPartyName,
  nameFor,
  canSend,
  busy,
  onSend,
}: {
  messages: ToyTransactionMessage[]
  viewerId: string
  /** Labels the composer, so it is clear who a message is going to. */
  otherPartyName: string
  nameFor: (senderId: string) => string
  canSend: boolean
  busy: boolean
  onSend: (body: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const logRef = useRef<HTMLDivElement>(null)

  // A chat that opens at the top of the history shows the least useful message
  // first. Jump to the newest on load and whenever one arrives.
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [messages.length])

  async function send() {
    if (!draft.trim()) return
    const body = draft
    setDraft('')
    await onSend(body)
  }

  const groups = groupMessages(messages)

  return (
    <div className="card chat-panel">
      {/*
       * role="log" + aria-live: alignment and bubble colour are the only things
       * separating your messages from theirs on screen, and neither reaches a
       * screen reader. The per-group "X said" below is the accessible half of
       * that distinction.
       */}
      <div ref={logRef} className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {groups.map((group) => {
          const first = group.messages[0]
          const daymark = group.opensDay ? (
            <p key={`day-${first.id}`} className="chat-daymark">
              {dayFormat.format(new Date(first.created_at))}
            </p>
          ) : null

          if (group.kind === 'system') {
            return (
              <Fragment key={first.id}>
                {daymark}
                {group.messages.map((m) => (
                  <p key={m.id} className="chat-system">
                    {m.body}
                  </p>
                ))}
              </Fragment>
            )
          }

          const mine = group.senderId === viewerId
          const name = nameFor(group.senderId)
          const last = group.messages[group.messages.length - 1]

          return (
            <Fragment key={first.id}>
              {daymark}
              <div className={`chat-row${mine ? ' chat-row-mine' : ''}`}>
                <span aria-hidden="true" className={`chat-avatar${mine ? ' chat-avatar-ghost' : ''}`}>
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <div className="chat-stack">
                  {/* The visible name is decoration for a screen reader — it
                      would read "Ash" and then "Ash said". One attribution,
                      spoken once, and the visual label hidden from it. */}
                  <span className="sr-only">{mine ? 'You said' : `${name} said`}</span>
                  {!mine && (
                    <span aria-hidden="true" className="chat-who">
                      {name}
                    </span>
                  )}
                  {group.messages.map((m) => (
                    <p key={m.id} className={`chat-bubble ${mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
                      {m.body}
                    </p>
                  ))}
                  <time className="chat-stamp" dateTime={last.created_at}>
                    {timeFormat.format(new Date(last.created_at))}
                  </time>
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      {canSend && (
        <div className="chat-composer">
          <label htmlFor="message" className="sr-only">
            Message {otherPartyName}
          </label>
          <textarea
            id="message"
            className="field flex-1"
            rows={1}
            placeholder={`Message ${otherPartyName}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="button" disabled={busy || !draft.trim()} onClick={send} className="btn btn-accent">
            Send
          </button>
        </div>
      )}
    </div>
  )
}
