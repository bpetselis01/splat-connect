import Link from 'next/link'
import { Bell, Eye, Lightbulb, PuzzlePiece } from '@phosphor-icons/react/dist/ssr'
import { IdeaForm } from '@/components/idea-form'
import { getCapabilities } from '@/lib/capabilities'
import {
  FlowSteps,
  FreeForever,
  InvolvedIntro,
  SECONDARY_BTN,
  TintNote,
} from '@/components/involved-page'

export const metadata = {
  title: 'Submit an idea — SPLAT Connect',
  description: 'Suggest a toy worth adapting, even if you cannot build it yourself.',
}

const LEAD =
  'Suggest a toy worth adapting, even if you cannot build it. An admin reads every idea; the good ones become open design challenges that anyone can pick up.'

/**
 * REPLACE BEFORE LAUNCH. This is a draft of what SPLAT will and will not
 * take on as a design challenge — a safety judgement the project owner has
 * not signed off yet. Keep it in sync with whatever they actually decide;
 * do not treat it as final, and do not add exclusions of your own invention.
 */
const SCOPE_EXCLUSIONS = [
  "Nothing load-bearing — it must never need to hold a child's weight or safety.",
  'Battery-powered only — nothing wired into the mains.',
  'Nothing that could be swallowed.',
  'Nothing medical.',
  "Nothing beyond what a volunteer can build with their own tools.",
]

// Not on the board, which has no scope list at all; kept because it is a
// safety line, and drawn as the board's own tinted note so it reads as one.
function Exclusions() {
  return (
    <TintNote title="What we can't take on" tint="var(--tviolet)">
      <p>
        This list is still being confirmed, so treat it as a guide rather than the final word.
        If you are unsure whether an idea fits, submit it anyway and we will tell you.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {SCOPE_EXCLUSIONS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </TintNote>
  )
}

export default async function SubmitAnIdea() {
  // getCapabilities is cached and the root layout already ran it, so this is
  // free — and only its truthiness matters here.
  const signedIn = !!(await getCapabilities())

  if (signedIn) {
    return (
      <div className="max-w-[720px]">
        <InvolvedIntro title="Submit an idea" lead={LEAD} />
        <Exclusions />
        <IdeaForm />
      </div>
    )
  }

  return (
    <div className="max-w-[860px]">
      <InvolvedIntro title="Submit an idea" lead={LEAD} />
      <FlowSteps
        steps={[
          { t: 'Describe the toy and the child', d: 'A title, a sentence, and who it is for. Anonymous if you prefer.', icon: Lightbulb, tint: 'var(--b100)' },
          { t: 'An admin reads it', d: 'Every idea is read by a person. Duplicates get merged, never dropped.', icon: Eye, tint: 'var(--tamber)' },
          { t: 'It becomes a design challenge', d: 'Good ideas go public as an open problem for makers to solve.', icon: PuzzlePiece, tint: 'var(--tviolet)' },
          { t: 'You stay in the loop', d: 'Follow it from My SPLAT and hear first when it becomes a guide.', icon: Bell, tint: 'var(--tmint)' },
        ]}
      />
      <TintNote title="You do not need to be technical">
        The best ideas come from the people who see the child every day — parents, teachers,
        therapists. Say what the toy should do and who it is for. Makers work out the how.
      </TintNote>
      <Exclusions />
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href="/login?next=/get-involved/submit-an-idea" className="btn btn-primary px-[26px]">
          Sign in to submit an idea
        </Link>
        <Link href="/get-involved/design-challenges" className={SECONDARY_BTN}>
          See open design challenges
        </Link>
      </div>
      <FreeForever />
    </div>
  )
}
