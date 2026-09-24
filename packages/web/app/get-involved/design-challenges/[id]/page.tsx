/**
 * A single design challenge's public brief, its participants, and — for a
 * signed-in author or participant — the live thread.
 *
 * Fetches GET /api/public/challenges/:id directly: it is anonymous, same
 * pattern as app/toy-library/[id]/page.tsx and app/tutorials/[id]/page.tsx.
 * `notFound()` on anything but a 200 — the endpoint 404s a pending/rejected
 * idea and a nonexistent one alike (see its doc comment in
 * packages/api/src/routes/public.ts), so this page can't tell them apart
 * either, on purpose.
 *
 * The endpoint never returns `messages` — the brief recruits, the
 * conversation stays private even on a public challenge — so the thread
 * itself is fetched by ChallengeThread, authenticated, client-side.
 *
 * Laid out as the board's challenge page: a rail of sections on the left and
 * one panel at a time on the right. The rail is `?tab=` links, not client
 * state, so the page stays a server component and a section can be linked.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /api/public/challenges/:id
 * - packages/api/src/routes/toy-ideas.ts: join / messages / participants
 * - components/challenge-thread.tsx: the client half — join button + live thread
 */
import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import {
  ChatCircleDots,
  Check,
  DotOutline,
  FlagBanner,
  FlagCheckered,
  HandHeart,
  NotePencil,
  Plus,
  ShieldCheck,
  Target,
  UsersThree,
  CheckCircle,
  ChatsCircle,
} from '@phosphor-icons/react/dist/ssr'
import { SaveButton } from '@/components/save-button'
import { STAGE } from '@/components/stage'
import { getSavedIds } from '@/lib/saves'
import { getCapabilities } from '@/lib/capabilities'
import { ChallengeThread } from '@/components/challenge-thread'
import type { ToyIdeaDetail, ContactPref } from '@splat-connect/types'
import { daysSince } from '@/lib/relative-time'
import { initials } from '@splat-connect/types'

const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  clarification: 'Clarification',
  co_design: 'Co-design',
  user_testing: 'User testing',
}

const TABS = [
  { id: 'status', label: 'Status', icon: FlagBanner, hint: 'Where this idea is, and what happens to it next.' },
  { id: 'brief', label: 'The brief', icon: Target, hint: 'What the author is asking for, and why nothing off the shelf does it.' },
  { id: 'makers', label: 'Makers', icon: UsersThree, hint: 'Everyone working on this, and what joining commits you to.' },
  { id: 'thread', label: 'Thread', icon: ChatCircleDots, hint: 'Where the work happens. Makers who join can post.' },
  { id: 'outcome', label: 'Outcome', icon: FlagCheckered, hint: 'What happens when somebody solves it.' },
] as const
type TabId = (typeof TABS)[number]['id']

const OUTCOME_STEPS = [
  ['Idea approved', 'An admin reads it and opens it as a challenge.'],
  ['Makers working', 'People join and the thread becomes the record of what has been tried.'],
  ['Written up as a guide', 'A maker turns the solution into a draft guide. The challenge reads Waiting until it is approved.'],
  ['Guide published', 'The draft goes through the same review as any other guide before a family sees it.'],
] as const

const TINTS = ['var(--tcoral)', 'var(--tmint)', 'var(--tamber)', 'var(--tviolet)', 'var(--b100)']

const date = (iso: string) =>
  new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function ChallengeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab: rawTab } = await searchParams
  const res = await fetch(`${process.env.API_URL}/api/public/challenges/${id}`, { cache: 'no-store' })
  if (!res.ok) notFound()

  const challenge = (await res.json()) as ToyIdeaDetail
  const caps = await getCapabilities()
  const saved = await getSavedIds()

  const base = `/get-involved/design-challenges/${challenge.id}`
  const graduated = challenge.status === 'graduated'
  // A question (078) wears its answered state in place of the lifecycle word,
  // as the board's question page does. It never graduates, so it has no
  // Outcome to show.
  const question = challenge.kind === 'question'
  const answered = question && !!challenge.answer_message_id
  const stage = question
    ? answered
      ? { label: 'Answered', tint: 'var(--tok)', fg: 'var(--tink)', Icon: CheckCircle }
      : { label: 'Open question', tint: 'var(--tviolet)', fg: 'var(--tink)', Icon: ChatsCircle }
    : STAGE[graduated ? 'waiting' : 'live']
  const tabs = question ? TABS.filter((t) => t.id !== 'outcome') : TABS
  const answers = challenge.answer_count ?? 0
  const viewerId = caps?.profile.id ?? null
  const joined =
    viewerId !== null &&
    (viewerId === challenge.author_id || challenge.participants.some((p) => p.profile_id === viewerId))
  const makers = challenge.participants.filter((p) => !p.removed_at)
  const daysOpen = daysSince(challenge.created_at)
  const firstJoin = makers.map((p) => p.joined_at).sort()[0]
  const history: { icon: typeof Plus; t: string; d: string }[] = [
    { icon: Plus, t: 'Idea submitted', d: date(challenge.created_at) },
    { icon: Check, t: 'Approved and opened as a challenge', d: 'Public, and open to makers' },
    ...(firstJoin
      ? [{ icon: UsersThree, t: `${makers.length} ${makers.length === 1 ? 'maker' : 'makers'} joined`, d: `Since ${date(firstJoin)}` }]
      : []),
    ...(graduated ? [{ icon: NotePencil, t: 'A maker started the write-up', d: date(challenge.updated_at) }] : []),
  ]
  if (answered && challenge.answered_at) {
    history.push({ icon: CheckCircle, t: 'The asker marked an answer', d: date(challenge.answered_at) })
  }
  const outcomeAt = graduated ? 2 : 1
  const tab: TabId = tabs.some((t) => t.id === rawTab) ? (rawTab as TabId) : 'status'
  const current = tabs.find((t) => t.id === tab)!

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[.04em]"
              style={{ background: stage.tint, color: stage.fg }}
            >
              <stage.Icon weight="fill" aria-hidden="true" />
              {stage.label}
            </span>
            <span className="text-[13px] font-bold text-muted">
              Submitted {date(challenge.created_at)} ·{' '}
              {challenge.author_name ? `by ${challenge.author_name}` : 'submitted anonymously'}
            </span>
          </span>
          <h1 className="mt-2 font-display text-[clamp(28px,3.2vw,40px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink">
            {challenge.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {/* Not an island here: there is no card to sit on, and you often
              arrive at this page from a shared link with no card in sight. */}
          <SaveButton
            slug="challenges"
            id={challenge.id}
            saved={saved?.challenges.includes(challenge.id) ?? false}
            signedIn={saved !== null}
            withLabel
            className="!flex !h-12 !w-auto items-center gap-2 border border-line px-[18px] text-[15px] font-extrabold shadow-none"
          />
          {graduated ? null : joined ? (
            <span className="btn min-h-12 bg-[var(--tok)] px-[22px] text-[var(--tink)] shadow-[var(--e1)]">
              <CheckCircle weight="bold" aria-hidden="true" /> You have joined
            </span>
          ) : (
            <Link
              href={(viewerId ? `${base}?tab=thread` : `/login?next=${encodeURIComponent(`${base}?tab=thread`)}`) as Route}
              className="btn btn-primary min-h-12 px-[22px] text-[15px]"
              scroll={false}
            >
              <HandHeart weight="bold" aria-hidden="true" /> {question ? 'Join to answer' : 'Join this challenge'}
            </Link>
          )}
        </div>
      </div>

      <div className="mt-[26px] grid items-start gap-7 md:grid-cols-[230px_1fr]">
        <nav aria-label="Challenge sections" className="flex flex-col gap-1 md:sticky md:top-6">
          {tabs.map((t) => {
            const on = t.id === tab
            const badge = t.id === 'makers' && makers.length > 0 ? makers.length : null
            return (
              <Link
                key={t.id}
                href={(t.id === 'status' ? base : `${base}?tab=${t.id}`) as Route}
                aria-current={on ? 'page' : undefined}
                scroll={false}
                className={`flex min-h-11 items-center gap-2.5 rounded-[14px] px-3 text-sm font-bold text-ink hover:bg-[var(--surface2)] ${
                  on ? 'bg-[var(--b100)]' : ''
                }`}
              >
                <t.icon weight="duotone" aria-hidden="true" className="text-[19px]" />
                <span className="flex-1">{t.label}</span>
                {badge !== null && (
                  <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[var(--b100)] px-1.5 text-xs font-extrabold text-[var(--b700)]">
                    {badge}
                  </span>
                )}
              </Link>
            )
          })}
          <dl className="mt-3.5 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2 rounded-[18px] border border-line bg-[var(--surface)] p-4 text-[13px] shadow-[var(--e1)]">
            <dt className="font-bold text-muted">Stage</dt>
            <dd className="m-0 font-extrabold">{stage.label}</dd>
            {question ? (
              <>
                <dt className="font-bold text-muted">Answers</dt>
                <dd className="m-0 font-extrabold">{answers}</dd>
              </>
            ) : (
              <>
                <dt className="font-bold text-muted">Makers</dt>
                <dd className="m-0 font-extrabold">{makers.length} joined</dd>
              </>
            )}
            <dt className="font-bold text-muted">Author</dt>
            <dd className="m-0 font-extrabold">{challenge.author_name ?? 'Anonymous'}</dd>
          </dl>
        </nav>

        <div className="rounded-card border border-line bg-[var(--surface)] p-[26px] shadow-[var(--e2)]">
          <h2 className="mb-1 font-display text-[22px] font-extrabold text-ink">{current.label}</h2>
          <p className="mb-[22px] text-sm text-muted">{current.hint}</p>

          {tab === 'status' && (
            <div className="flex flex-col gap-5">
              <div
                className="flex items-start gap-4 rounded-card border border-line p-[22px]"
                style={{ background: stage.tint }}
              >
                <span
                  aria-hidden="true"
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px] bg-[var(--surface)] text-[var(--tink)] shadow-[var(--e1)]"
                >
                  <stage.Icon weight="duotone" className="text-[30px]" />
                </span>
                <div className="min-w-0 flex-1" style={{ color: stage.fg }}>
                  <p className="font-display text-[22px] font-extrabold">
                    {question
                      ? answered
                        ? 'Answered'
                        : 'Open, and waiting for an answer'
                      : graduated
                        ? 'Somebody solved it'
                        : 'Open, and makers are on it'}
                  </p>
                  <p className="mt-1.5 max-w-[62ch] text-[15px] leading-[1.6] [text-wrap:pretty]">
                    {question
                      ? answered
                        ? 'The person who asked marked one reply as the answer. It is highlighted in the thread; the rest of the conversation stays with it.'
                        : 'No build needed. Anyone who joins can answer in the thread, and the person who asked marks the one that helped.'
                      : graduated
                        ? 'A maker is turning the solution into a guide. The brief stays up, with the guide linked from it once it is approved, so the thread that got there is not lost.'
                        : 'Anyone can read the brief; makers who join can post in the thread. Nothing here is assigned — people take on the parts they can do.'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  question
                    ? [answers, answers === 1 ? 'answer' : 'answers']
                    : [makers.length, makers.length === 1 ? 'maker' : 'makers'],
                  [daysOpen, daysOpen === 1 ? 'day open' : 'days open'],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-[18px] border border-line bg-[var(--canvas)] px-3.5 py-4 text-center">
                    <p className="font-display text-[26px] font-extrabold tabular-nums">{n}</p>
                    <p className="mt-0.5 text-[13px] font-bold text-muted">{label}</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="mb-3.5 font-display text-lg font-extrabold">History</h3>
                <ol className="flex list-none flex-col gap-0.5 p-0">
                  {history.map((e, i) => {
                    const last = i === history.length - 1
                    return (
                      <li key={e.t} className="flex items-start gap-3.5">
                        <span className="flex shrink-0 flex-col items-center gap-0.5 self-stretch">
                          <span
                            aria-hidden="true"
                            className="grid h-[30px] w-[30px] place-items-center rounded-full text-[var(--tink)]"
                            style={{ background: last ? 'var(--b100)' : 'var(--surface2)' }}
                          >
                            <e.icon weight="bold" className="text-[15px]" />
                          </span>
                          <span
                            aria-hidden="true"
                            className="min-h-[18px] w-0.5 flex-1"
                            style={{ background: last ? 'transparent' : 'var(--line)' }}
                          />
                        </span>
                        <span className="min-w-0 pb-4">
                          <span className="block text-[15px] font-extrabold">{e.t}</span>
                          <span className="block text-sm leading-[1.5] text-muted">{e.d}</span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          )}

          {tab === 'brief' && (
            <div className="flex flex-col gap-5">
              <p className="max-w-[62ch] text-[17px] leading-[1.6] text-muted [text-wrap:pretty]">
                {challenge.summary}
              </p>
              {[
                ['What it needs to do', challenge.description],
                ['Intended use', challenge.intended_use],
                ['Who it’s for', challenge.primary_user],
              ].map(([h, body]) => (
                <div key={h}>
                  <h3 className="mb-2 font-display text-lg font-extrabold">{h}</h3>
                  <p className="max-w-[64ch] leading-[1.6] text-ink [text-wrap:pretty]">{body}</p>
                </div>
              ))}
              {challenge.contact_prefs.length > 0 && (
                <div>
                  <h3 className="mb-2 font-display text-lg font-extrabold">The author is happy to help with</h3>
                  <div className="flex flex-wrap gap-2">
                    {challenge.contact_prefs.map((pref) => (
                      <span key={pref} className="chip">
                        {CONTACT_PREF_LABELS[pref]}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'makers' && (
            <div className="flex flex-col gap-4">
              {makers.length === 0 ? (
                <p className="text-[15px] text-muted">Nobody has joined yet.</p>
              ) : (
                <ul className="flex list-none flex-col gap-2.5 p-0">
                  {makers.map((m, i) => (
                    <li
                      key={m.profile_id}
                      className="flex items-center gap-3.5 rounded-[18px] border border-line bg-[var(--canvas)] px-4 py-3.5"
                    >
                      <span
                        aria-hidden="true"
                        className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full text-sm font-extrabold text-[var(--tink)]"
                        style={{ background: TINTS[i % TINTS.length] }}
                      >
                        {initials(m.name, '?')}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-extrabold">{m.name ?? 'Someone'}</span>
                        <span className="block text-[13px] text-muted">Joined {date(m.joined_at)}</span>
                      </span>
                      {m.profile_id === viewerId && (
                        <span className="rounded-full bg-[var(--b100)] px-[11px] py-[3px] text-xs font-extrabold text-[var(--b700)]">
                          You
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-start gap-2.5 rounded-[14px] border border-line bg-[var(--canvas)] px-4 py-3.5 text-[13px] leading-[1.5] text-muted">
                <ShieldCheck weight="duotone" aria-hidden="true" className="shrink-0 text-xl text-[var(--b600)]" />
                Joining shows your name here and lets you post in the thread. The author or another
                maker can report anyone who makes the thread unsafe, and an admin decides.
              </p>
            </div>
          )}

          {tab === 'thread' && (
            <ChallengeThread
              ideaId={challenge.id}
              status={challenge.status as 'challenge' | 'graduated'}
              viewerId={viewerId}
              authorId={challenge.author_id}
              authorName={challenge.author_name}
              participants={challenge.participants}
              question={question}
              answerMessageId={challenge.answer_message_id ?? null}
            />
          )}

          {tab === 'outcome' && (
            <div className="flex flex-col gap-4">
              <ol className="flex list-none flex-col gap-3 p-0">
                {OUTCOME_STEPS.map(([label, note], i) => {
                  const state = i < outcomeAt ? 'done' : i === outcomeAt ? 'now' : 'todo'
                  const Icon = state === 'done' ? Check : DotOutline
                  return (
                    <li key={label} className="flex items-start gap-3.5">
                      <span
                        aria-hidden="true"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
                        style={
                          state === 'done'
                            ? { background: 'var(--b600)', color: 'var(--onbrand)' }
                            : state === 'now'
                              ? { background: 'var(--amber)', color: 'var(--tink)' }
                              : { background: 'var(--surface2)', color: 'var(--muted)' }
                        }
                      >
                        <Icon weight="bold" className="text-base" />
                      </span>
                      <span className="min-w-0 flex-1 pt-1">
                        <span className={`block text-[15px] font-extrabold ${state === 'todo' ? 'text-muted' : 'text-ink'}`}>
                          {label}
                        </span>
                        <span className="mt-0.5 block text-sm leading-[1.5] text-muted">{note}</span>
                      </span>
                    </li>
                  )
                })}
              </ol>
              <p className="rounded-[18px] border border-line bg-[var(--b50)] px-5 py-[18px] text-sm leading-[1.6] text-muted">
                Solved it? Write it up as a guide and this challenge graduates — the brief stays,
                with your guide linked from it. Graduating creates a draft guide, not a published
                one; it still goes through review like any other.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
