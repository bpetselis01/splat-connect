'use client'
/**
 * The contact form.
 *
 * It was a mailto: link, which meant a safety report reached whichever inbox
 * somebody happened to be watching. Now it lands in a queue where safety jumps
 * ahead of everything else (065, /admin/inbox), and the email address stays on
 * the page beside it — the promise has always been that "email reaches a
 * person", and this is a second door rather than a replacement.
 *
 * No account required, deliberately. Somebody reporting that a battery pack
 * gets warm should not have to sign up first, and requiring it is the
 * difference between hearing about a hazard and not.
 */
import { useState } from 'react'
import {
  PaperPlaneTilt,
  BookOpenText,
  Buildings,
  WarningCircle,
  ChatCircleDots,
  Info,
  Clock,
} from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

// The board's topic pills, less "A toy exchange": contact_messages.topic is
// checked against these four (065), so a fifth needs a migration first.
const TOPICS = [
  {
    value: 'guide',
    label: 'A guide',
    icon: BookOpenText,
    hint: 'Unclear step, wrong part, broken link. Include the guide name. Community notes on the guide itself are faster for small fixes.',
    eta: 'Usually 2 to 5 days',
    prompt: 'Which guide, and which step?',
    ph: 'e.g. Light-up drum, step 4: the photo shows a red wire but the text says black.',
  },
  {
    value: 'organisation',
    label: 'My organisation',
    icon: Buildings,
    hint: 'Registering, adding a leader, or changing your profile. New organisations: who you are, where, and what you do is enough to start.',
    eta: 'Usually 2 to 5 days',
    prompt: 'Organisation name and your role',
    ph: 'e.g. Bayside OT Collective, Melbourne. I am the practice manager and we want to run build days.',
  },
  {
    value: 'safety',
    label: 'Safety report',
    icon: WarningCircle,
    hint: 'Jumps the queue and reaches an administrator immediately. If it is about a specific guide, the Report link on that guide is faster still.',
    eta: 'Same day',
    prompt: 'What, where, and has anyone been hurt?',
    ph: 'e.g. The battery pack on the fairy-lights guide gets hot after ten minutes. Nobody hurt.',
  },
  {
    value: 'other',
    label: 'Something else',
    icon: ChatCircleDots,
    hint: 'Press, research, funding, or anything that does not fit above.',
    eta: 'Usually 2 to 5 days',
    prompt: '',
    ph: '',
  },
] as const

const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const INPUT = 'field bg-[var(--canvas)] text-base'

export function ContactForm({ defaultName = '', defaultEmail = '' }) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]['value']>('guide')
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const t = TOPICS.find((x) => x.value === topic)!

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSending(true)
    try {
      await browserApiClient.post('/api/public/contact', {
        topic,
        name: name.trim(),
        email: email.trim(),
        body: body.trim(),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not send. Try again, or email us.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-card border border-line bg-[var(--tmint)] p-10 text-center text-[var(--tink)]">
        <PaperPlaneTilt size={48} weight="duotone" className="mx-auto" aria-hidden="true" />
        <h2 className="mb-1.5 mt-3 font-display text-[26px] font-extrabold">Sent. Thank you.</h2>
        <p className="mx-auto max-w-[44ch] text-[15px] leading-[1.6]">
          {topic === 'safety'
            ? 'A safety report goes to the top of the queue. If a guide is involved we will take it down while we check it.'
            : 'We reply within two to five days. If it is urgent and about safety, send again with Safety report selected.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setSent(false)
            setBody('')
          }}
          className="btn btn-quiet mt-5"
        >
          Send another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-5 p-7">
      <div>
        <span id="contact-topic" className="mb-[9px] block text-sm font-extrabold text-ink">
          What is this about?
        </span>
        <div role="radiogroup" aria-labelledby="contact-topic" className="flex flex-wrap gap-2">
          {TOPICS.map((x) => {
            const on = x.value === topic
            return (
              <button
                key={x.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTopic(x.value)}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-4 text-sm font-extrabold ${
                  on
                    ? 'border-[var(--b600)] bg-[var(--b600)] text-[var(--onbrand)]'
                    : 'border-line bg-surface text-ink'
                }`}
              >
                <x.icon size={14} weight="bold" aria-hidden="true" />
                {x.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2.5 text-sm leading-[1.5] text-muted">
          <Info size={14} weight="bold" className="mr-[5px] inline text-[var(--b600)]" aria-hidden="true" />
          {t.hint}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            className={`${INPUT} h-[50px]`}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={`${INPUT} h-[50px]`}
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-[7px] flex justify-between text-sm font-extrabold text-ink">
          <span>Message</span>
          <span className="font-semibold text-muted">{t.prompt}</span>
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          maxLength={4000}
          placeholder={t.ph}
          className={INPUT}
        />
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="submit"
          disabled={sending}
          className="btn btn-primary min-h-[52px] px-[26px] text-base"
        >
          <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
          {sending ? 'Sending…' : 'Send message'}
        </button>
        <span className="text-[13px] font-semibold text-muted">
          <Clock size={13} weight="bold" className="mr-1 inline" aria-hidden="true" />
          {t.eta}
        </span>
      </div>
    </form>
  )
}
