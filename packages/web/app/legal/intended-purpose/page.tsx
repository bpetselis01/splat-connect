import Link from 'next/link'
import { ProsePage, PullQuote } from '@/components/prose-page'

// TODO(splat): legal review — this page states Connect's intended purpose for
// the Therapeutic Goods Act 1989 (Cth) intended-purpose test. Do not edit the
// substance without legal review.
export const metadata = { title: 'What SPLAT Connect is (and isn’t) — SPLAT Connect' }

export default function IntendedPurposePage() {
  return (
    <ProsePage
      title="What SPLAT Connect is (and isn&#x2019;t)"
      lastUpdated="1 September 2026"
      intro="SPLAT Connect is a free consumer tool that helps parents and carers find, choose and customise adapted toys and everyday aids for children with disability."
    >
      <PullQuote>
        It is a matching tool, not a measurement. Always talk to your child&apos;s own
        health professionals about their individual needs.
      </PullQuote>

      <section>
        <h2>It is not a medical device</h2>
        <p>
          It is not intended to diagnose, treat, cure, monitor or prevent any medical
          condition, and it is not intended for use in clinical practice.
        </p>
      </section>

      <section>
        <h2>It does not replace your child&apos;s health professionals</h2>
        <p>
          The suggestions it produces are suggestions about toys and everyday aids —
          not clinical advice, not an assessment, and not a treatment plan. Always
          talk to your child&apos;s occupational therapist, physiotherapist or doctor
          about your child&apos;s individual needs.
        </p>
      </section>

      <section>
        <h2>How suggestions are produced</h2>
        <p>
          When you answer questions about how your child uses their hands, we turn
          those answers into an internal fit score and use it to rank guides and
          devices that other families and contributors have found useful. It is a
          matching tool, not a measurement. You can ask us how a suggestion was
          reached, and you can ask a person to look at it —{' '}
          <Link href="/contact">contact us</Link>.
        </p>
      </section>

      <section>
        <h2>The devices themselves</h2>
        <p>
          Adapted toys and 3D-printed aids from SPLAT are consumer aids to support
          play and everyday activities. They are not therapeutic or orthotic devices,
          and are not intended to correct, immobilise or medically support any part
          of the body.
        </p>
      </section>
    </ProsePage>
  )
}
