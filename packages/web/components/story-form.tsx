'use client'
/**
 * Publish a story, or edit one already saved.
 *
 * The one control here that is not an ordinary field is the consent checkbox,
 * and it is the reason this screen exists at all. Publish stays disabled until
 * it is ticked — but that is the courtesy. The guarantee is 059's check
 * constraint, which refuses a published row without it by any route, including
 * one that never loads this page.
 *
 * On an edit the box starts unticked whatever was saved: the edit may name
 * somebody new, and the tick is a promise about everyone named now.
 *
 * The live word count is not a vanity counter: it is the read time a reader
 * will be shown, computed by the same function (readMinutes), so what a leader
 * sees while writing is what appears on the card.
 *
 * Related files:
 * - packages/api/src/routes/organizations.ts: POST /:id/stories, PATCH
 *   /:orgId/stories/:id
 * - supabase/migrations/062_stories.sql: the constraint, and the four kinds
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Buildings, Check, Heart, Megaphone, Newspaper, Wrench } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import { browserApiClient } from '@/lib/browser-api-client'
import {
  STORY_KINDS,
  STORY_KIND_LABEL,
  readMinutes,
  type StoryKind,
  type OrgStory,
} from '@splat-connect/types'

const KIND_ICON: Record<StoryKind, Icon> = {
  family: Heart,
  maker: Wrench,
  org_update: Buildings,
  announcement: Megaphone,
}

export function StoryForm({
  orgId,
  orgName,
  story,
}: {
  orgId: string
  orgName: string
  /** Absent when publishing a new one. */
  story?: OrgStory
}) {
  const router = useRouter()
  const [kind, setKind] = useState<StoryKind>(story?.kind ?? 'family')
  const [title, setTitle] = useState(story?.title ?? '')
  const [summary, setSummary] = useState(story?.summary ?? '')
  const [body, setBody] = useState(story?.body ?? '')
  const [byline, setByline] = useState(story?.byline ?? orgName)
  const [pullQuote, setPullQuote] = useState(story?.pull_quote ?? '')
  const [pullQuoteBy, setPullQuoteBy] = useState(story?.pull_quote_by ?? '')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<'draft' | 'published' | null>(null)
  // Same rule as the event form: a published story saves in place.
  const live = story?.status === 'published'

  const words = body.trim() ? body.trim().split(/\s+/).filter(Boolean).length : 0

  async function save(status: 'draft' | 'published') {
    setError(null)
    setSaving(status)
    try {
      const fields = {
        kind,
        title: title.trim(),
        summary: summary.trim(),
        body: body.trim(),
        byline: byline.trim(),
        pull_quote: pullQuote.trim() || null,
        pull_quote_by: pullQuoteBy.trim() || null,
        consent_confirmed: consent,
        status,
      }
      const saved = story
        ? await browserApiClient.patch<OrgStory>(
            `/api/organizations/${orgId}/stories/${story.id}`,
            fields,
          )
        : await browserApiClient.post<OrgStory>(`/api/organizations/${orgId}/stories`, fields)
      // Published goes to the public page so a leader reads what a family
      // reads; a draft goes back to the list, because there is nothing public
      // to look at yet. Same rule as the event form.
      router.push(
        status === 'published' ? `/about/stories/${saved.id}` : '/dashboard/organisation/publish',
      )
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
      setSaving(null)
    }
  }

  const ready = title.trim() && summary.trim() && body.trim() && byline.trim()

  const canPublish =
    saving === null && !!ready && consent && !(pullQuote.trim() && !pullQuoteBy.trim())

  return (
    <form onSubmit={(e) => e.preventDefault()} className="form-card">
      <fieldset>
        <legend className="form-label mb-2">What kind of story?</legend>
        <div role="radiogroup" aria-label="Story type" className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(STORY_KINDS) as StoryKind[])
            // An announcement speaks for SPLAT and has no organisation behind
            // it — 062 makes it admin-only, so it is not on a leader's form.
            .filter((k) => k !== 'announcement')
            .map((k) => {
              const KindIcon = KIND_ICON[k]
              return (
                <label key={k} className="choice-card">
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === k}
                    onChange={() => setKind(k)}
                    className="sr-only"
                  />
                  <KindIcon weight="duotone" aria-hidden="true" className="choice-card__icon" />
                  <span>
                    <span className="choice-card__label">{STORY_KIND_LABEL[k]}</span>
                    <span className="choice-card__sub">{STORY_KINDS[k]}</span>
                  </span>
                </label>
              )
            })}
        </div>
      </fieldset>

      <label className="block">
        <span className="form-label">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          placeholder="Leo's drum, six weeks on"
          className="field"
        />
      </label>

      <label className="block">
        <span className="form-label">One-sentence summary</span>
        <input
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          maxLength={300}
          placeholder="What a reader gets if they only read this line."
          className="field"
        />
      </label>

      <label className="block">
        <span className="form-label">The story</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          maxLength={20000}
          aria-describedby="word-count"
          placeholder="Blank line between paragraphs. Around 300–600 words reads well."
          className="field leading-[1.6]"
        />
        <span id="word-count" className="mt-1.5 block text-right text-[13px] text-muted">
          {words} words · about {readMinutes(body)} min read
        </span>
      </label>

      <label className="block">
        <span className="form-label">
          Byline <span>(who wrote it)</span>
        </span>
        <input
          value={byline}
          onChange={(e) => setByline(e.target.value)}
          maxLength={120}
          placeholder={orgName}
          className="field"
        />
      </label>

      <fieldset className="form-well">
        <legend className="sr-only">Pull quote (optional)</legend>
        <p aria-hidden="true" className="form-well__kicker">
          Pull quote <span>— optional. One line from the story, set large. The best ones are the family&apos;s own words.</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <label className="block">
            <span className="form-label">The quote</span>
            <input
              value={pullQuote}
              onChange={(e) => setPullQuote(e.target.value)}
              maxLength={400}
              className="field"
            />
          </label>
          <label className="block">
            <span className="form-label">Who said it</span>
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
          <p className="text-sm text-muted">
            A quote needs someone to have said it — unattributed, it reads as
            SPLAT&apos;s voice put in a family&apos;s mouth.
          </p>
        )}
      </fieldset>

      <label
        className={`flex cursor-pointer items-start gap-3.5 rounded-[18px] border-2 px-[18px] py-4 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] ${
          consent ? 'border-[var(--b600)] bg-[var(--b50)]' : 'border-line bg-surface'
        }`}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={`grid h-[26px] w-[26px] flex-none place-items-center rounded-[14px] border-2 text-[var(--onbrand)] ${
            consent ? 'border-[var(--b600)] bg-[var(--b600)]' : 'border-line bg-surface'
          }`}
        >
          <Check weight="bold" />
        </span>
        <span>
          <span className="block text-[15px] font-extrabold text-ink">
            Everyone named or pictured has agreed to appear
          </span>
          <span className="mt-0.5 block text-[13px] leading-[1.45] text-muted">
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

      <div className="form-foot">
        <button
          type="button"
          onClick={() => save('published')}
          disabled={!canPublish}
          className="btn btn-primary px-[26px]"
        >
          <Newspaper weight="bold" aria-hidden="true" />
          {live
            ? saving ? 'Saving…' : 'Save changes'
            : saving === 'published' ? 'Publishing…' : 'Publish to Stories'}
        </button>
        {!live && (
          <button
            type="button"
            onClick={() => save('draft')}
            disabled={saving !== null}
            className="btn btn-quiet min-h-[52px]"
          >
            {saving === 'draft' ? 'Saving…' : 'Save as draft'}
          </button>
        )}
        <span className="text-[13px] text-muted">
          Published as <strong className="text-ink">{orgName}</strong>
        </span>
      </div>
      {!consent && ready && (
        <p className="-mt-3 text-sm text-muted">
          {live
            ? 'Saving is held until consent is confirmed for everyone named now.'
            : 'Publishing is held until consent is confirmed. Save it as a draft meanwhile.'}
        </p>
      )}
    </form>
  )
}
