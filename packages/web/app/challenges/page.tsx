/**
 * Design challenges — a visual stub.
 *
 * The idea: a parent posts what their child needs, an engineer or maker picks it
 * up. This page shows what that would look like; nothing behind it is wired.
 *
 * Deliberately no table, no API and no fetch. The sample board below is a local
 * const so that when the real spec lands, the placeholder is one deletion rather
 * than an unpicking. The data model, the claim flow and whatever moderation a
 * board like this needs are all still open questions.
 *
 * Both calls to action open NotLiveDialog rather than doing nothing quietly.
 *
 * Related files:
 * - components/not-live-dialog.tsx: the honest dead end behind both CTAs
 * - lib/nav-model.ts: the rail row pointing here
 */
import { NotLiveDialog } from '@/components/not-live-dialog'
import { Reveal } from '@/components/reveal'
import { fadeIn } from '@/lib/motion'
import { Lightbulb } from '@/components/icons'

type Challenge = {
  id: string
  need: string
  context: string
  postedBy: string
  status: 'open' | 'claimed'
  claimedBy?: string
}

/** Sample content, not seed data. Replace wholesale when the feature is specced. */
const SAMPLE: Challenge[] = [
  {
    id: 'a',
    need: 'A switch-adapted bubble machine she can trigger with her head',
    context:
      'Ivy is four and uses a headrest switch. Everything off the shelf needs a two-handed grip.',
    postedBy: 'A parent in Geelong',
    status: 'open',
  },
  {
    id: 'b',
    need: 'A mount that holds a tablet on a wheelchair tray without blocking the joystick',
    context:
      'The clamps we have found either wobble or sit right where he steers from.',
    postedBy: 'A parent in Ballarat',
    status: 'claimed',
    claimedBy: 'An engineer at Riverside Therapy',
  },
  {
    id: 'c',
    need: 'A louder, slower-moving toy for a child who tires quickly',
    context:
      'Most adapted toys move fast and quietly. Reversing both would keep him with it longer.',
    postedBy: 'An occupational therapist',
    status: 'open',
  },
]

export default function ChallengesPage() {
  return (
    <div>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Design challenges</h1>
        <p className="mt-3 leading-relaxed text-muted">
          What families are still looking for. A parent describes what their child
          needs; someone with the skills to build it takes it on.
        </p>
        <div className="mt-6">
          <NotLiveDialog
            label="Post a challenge"
            className="btn btn-accent"
            heading="Posting is not open yet"
            body="The challenge board is a preview — there is nowhere to save a post to yet. The tutorial library is live and ready to use in the meantime."
          />
        </div>
      </div>

      {/* Sample board. Not a grid of identical cards: an open challenge is
          something to act on and a claimed one is a status, so they read
          differently. */}
      <Reveal variants={fadeIn} className="mt-10 flex flex-col gap-4">
        {SAMPLE.map((c) => (
          <article
            key={c.id}
            className={`card p-5 ${c.status === 'claimed' ? 'opacity-80' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                      c.status === 'open'
                        ? 'bg-apricot-soft text-apricot-deep'
                        : 'bg-mint-soft text-mint-deep'
                    }`}
                  >
                    <Lightbulb className="h-4 w-4" />
                  </span>
                  <span
                    className={`badge ${
                      c.status === 'open'
                        ? 'bg-apricot-soft text-apricot-deep'
                        : 'bg-mint-soft text-mint-deep'
                    }`}
                  >
                    {c.status === 'open' ? 'OPEN' : 'TAKEN UP'}
                  </span>
                </div>
                <h2 className="mt-3 font-bold text-ink">{c.need}</h2>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
                  {c.context}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Posted by {c.postedBy}
                  {c.claimedBy && ` · Taken up by ${c.claimedBy}`}
                </p>
              </div>

              {c.status === 'open' && (
                <NotLiveDialog
                  label="Take up this challenge"
                  className="btn btn-soft btn-sm shrink-0"
                  heading="Claiming is not open yet"
                  body="This board is a preview, so there is no challenge to claim behind it yet. If you already build adapted toys, publishing a tutorial is the thing that helps today."
                />
              )}
            </div>
          </article>
        ))}
      </Reveal>

      <p className="mt-10 max-w-prose text-sm leading-relaxed text-muted">
        These are examples of the kind of thing families ask for, not real posts.
      </p>
    </div>
  )
}
