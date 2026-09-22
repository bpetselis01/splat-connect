import Link from 'next/link'
import {
  Buildings,
  ChatsCircle,
  CheckCircle,
  PaperPlaneTilt,
  PencilSimple,
} from '@phosphor-icons/react/dist/ssr'
import { FlowSteps, InvolvedIntro, SECONDARY_BTN, TintNote } from '@/components/involved-page'

export const metadata = {
  title: 'Submit a guide — SPLAT Connect',
  description: 'What writing up an adaptation involves, start to finish.',
}

export default function SubmitATutorial() {
  return (
    <div className="max-w-[860px]">
      <InvolvedIntro
        title="Submit a guide"
        lead="What writing up an adaptation involves, start to finish. Nothing goes public until a reviewer reads it."
      />
      <FlowSteps
        steps={[
          { t: 'Draft', d: 'Six sections, visible only to you until you submit.', icon: PencilSimple, tint: 'var(--b100)' },
          { t: 'Choose an organisation', d: 'Optional — ask a service or school to back it.', icon: Buildings, tint: 'var(--tmint)' },
          { t: 'Submit for review', d: 'The draft locks and joins the review queue.', icon: PaperPlaneTilt, tint: 'var(--tamber)' },
          { t: 'Answer the review', d: 'A reviewer names anything missing. Usually one round.', icon: ChatsCircle, tint: 'var(--tviolet)' },
          { t: 'Published', d: 'Public, searchable, and yours to update any time.', icon: CheckCircle, tint: 'var(--tok)' },
        ]}
      />
      <TintNote title="Before you start writing">
        You will need photos of every step as you go — nobody can reconstruct them afterwards.
        Take one photo per action, with the toy the right way up, and keep the originals.
      </TintNote>
      {/* /upload sends a signed-out visitor through sign-in and the
          contributor terms on its own, so one door serves both states. */}
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/upload" className="btn btn-primary px-[26px]">
          Start a guide
        </Link>
        <Link href="/get-involved/contributors" className={SECONDARY_BTN}>
          Read the contributor path
        </Link>
      </div>
    </div>
  )
}
