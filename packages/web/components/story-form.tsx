'use client'
/**
 * Publish a story.
 *
 * The one control here that is not an ordinary field is the consent checkbox,
 * and it is the reason this screen exists at all. Publish stays disabled until
 * it is ticked — but that is the courtesy. The guarantee is 059's check
 * constraint, which refuses a published row without it by any route, including
 * one that never loads this page.
 *
 * The live word count is not a vanity counter: it is the read time a reader
 * will be shown, computed by the same function (readMinutes), so what a leader
 * sees while writing is what appears on the card.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: POST /:id/stories
 * - supabase/migrations/062_stories.sql: the constraint, and the four kinds
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PenNib } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import {
  STORY_KINDS,
  STORY_KIND_LABEL,
  readMinutes,
  type StoryKind,
  type OrgStory,
} from '@splat-connect/types'

export function StoryForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter()
  const [kind, setKind] = useState<StoryKind>('family')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [byline, setByline] = useState(orgName)
  const [pullQuote, setPullQuote] = useState('')
  const [pullQuoteBy, setPullQuoteBy] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null)

  const words = body.trim() ? body.trim().split(/\s+/).filter(Boolean).length : 0

  async function save(status: 'draft' | 'published') {
    setError(null)
    setSaving(status)
    try {
      const story = await browserApiClient.post<OrgStory>(`/api/organizations/${orgId}/stories`, {
        kind,
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        byline: byline.trim(),
        pull_quote: pullQuote.trim() || null,
        pull_quote_by: pullQuoteBy.trim() || null,
        consent_confirmed: consent,
        status,
      })
      // Published goes to the public page so a leader reads what a family
      // reads; a draft goes back to the list, because there is nothing public
      // to look at yet. Same rule as the event form.
      router.push(
        status === 'published' ? `/about/stories/${story.id}` : '/dashboard/organisation/publish',
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
      setSaving(null)
    }
  }

  const ready = title.trim() && summary.trim() && body.trim() && byline.trim()

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mt-6 flex flex-col gap-5">
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink">What kind of story?</legend>
        <div role="radiogroup" aria-label="Story type" className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(STORY_KINDS) as StoryKind[])
            // An announcement speaks for SPLAT and has no organisation behind
            // it — 062 makes it admin-only, so it is not on a leader's form.
            .filter((k) => k !== 'announcement')
            .map((k) => (
              <label
                key={k}
                className={`flex cursor-pointer items-start gap-3 rounded-card border p-3 ${
                  kind === k ? 'border-brand bg-brand-tint' : 'border-line bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="mt-1"
                />
                <span>
                  <span className="block font-bold text-ink">{STORY_KIND_LABEL[k]}</span>
                  <span className="block text-xs text-muted">{STORY_KINDS[k]}</span>
                </span>
              </label>
            ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="Leo's drum, six weeks on"
          className="field"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">One-sentence summary</span>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={300}
          placeholder="What a reader gets if they only read this line."
          className="field"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">The story</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          maxLength={20000}
          aria-describedby="word-count"
          placeholder="Blank line between paragraphs. Around 300–600 words reads well."
          className="field"
        />
        <span id="word-count" className="mt-1.5 block text-xs text-muted">
          {words} words · about {readMinutes(body)} min read
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">Byline (who wrote it)</span>
        <input
          value={byline}
          onChange={(e) => setByline(e.target.value)}
          maxLength={120}
          placeholder={orgName}
          className="field"
        />
      </label>

      <fieldset className="card p-5">
        <legend className="px-1 font-bold text-ink">
          Pull quote <span className="font-semibold text-muted">(optional)</span>
        </legend>
        <p className="mb-3 text-xs text-muted">
          One line from the story, set large. The best ones are the family&apos;s own words.
        </p>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">The quote</span>
            <input
              value={pullQuote}
              onChange={(e) => setPullQuote(e.target.value)}
              maxLength={400}
              className="field"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Who said it</span>
            <input
              value={pullQuoteBy}
              onChange={(e) => setPullQuoteBy(e.target.value)}
              maxLength={120}
              placeholder="Hannah, Leo’s mum"
              className="field"
            />
          </label>
        </div>
        {pullQuote.trim() && !pullQuoteBy.trim() && (
          // 062 refuses this in the database. Said here in a sentence, where
          // the decision is being made.
          <p className="mt-2 text-sm text-muted">
            A quote needs someone to have said it — unattributed, it reads as
            SPLAT&apos;s voice put in a family&apos;s mouth.
          </p>
        )}
      </fieldset>

      <label className="card flex cursor-pointer items-start gap-3 p-5">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block font-bold text-ink">
            Everyone named or pictured has agreed to appear
          </span>
          <span className="block text-sm leading-relaxed text-muted">
            For a child, that means a parent or guardian said yes in writing. First names only
            unless they asked otherwise.
          </span>
        </span>
      </label>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => save('published')}
          disabled={saving !== null || !ready || !consent || (!!pullQuote.trim() && !pullQuoteBy.trim())}
          className="btn btn-primary"
        >
          <PenNib className="h-4 w-4" aria-hidden="true" />
          {saving === 'published' ? 'Publishing…' : 'Publish to Stories'}
        </button>
        <button
          type="button"
          onClick={() => save('draft')}
          disabled={saving !== null}
          className="btn btn-quiet"
        >
          {saving === 'draft' ? 'Saving…' : 'Save as draft'}
        </button>
        <span className="text-sm text-muted">
          Published as <strong className="font-bold text-ink">{orgName}</strong>
        </span>
      </div>
      {!consent && ready && (
        <p className="text-sm text-muted">
          Publishing is held until consent is confirmed. Save it as a draft meanwhile.
        </p>
      )}
    </form>
  )
}
