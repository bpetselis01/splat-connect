import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Code of conduct — SPLAT Connect' }

export default function CodeOfConductPage() {
  return (
    <ProsePage
      title="Code of conduct"
      lastUpdated="19 August 2026"
      intro="This platform exists because people give their time to children they will mostly never meet. That deserves a space where everyone involved is treated well."
    >
      <section>
        <h2>What we expect</h2>
        <ul>
          <li>
            <strong>Assume good faith.</strong> A guide with a mistake in it was
            written by a volunteer at their kitchen table. Say what is wrong, kindly.
          </li>
          <li>
            <strong>Respect how people describe themselves and their children.</strong>
            Follow the language a family uses about their own child, not the language
            you would choose.
          </li>
          <li>
            <strong>Keep private things private.</strong> Addresses, photographs and
            details about a child that you learn through an exchange stay between you
            and that family.
          </li>
          <li>
            <strong>Be straight about what you can do.</strong> If you claim a build
            and cannot finish it, say so early. Nobody minds. Silence is what hurts.
          </li>
        </ul>
      </section>

      <section>
        <h2>What is not acceptable</h2>
        <ul>
          <li>
            Harassment, or demeaning language about disability, race, gender,
            sexuality, religion or age.
          </li>
          <li>
            Contacting a family outside the platform without their agreement, or
            pressuring anyone into an exchange.
          </li>
          <li>
            Publishing photographs of a child who is not yours, or identifying details
            about a child.
          </li>
          <li>
            Using the platform to sell, advertise, or solicit donations for yourself.
          </li>
          <li>
            Claiming an organisation&apos;s backing, or a qualification, that you do
            not have.
          </li>
          <li>
            Knowingly publishing an adaptation you believe to be unsafe.
          </li>
        </ul>
      </section>

      <section>
        <h2>Reporting</h2>
        <p>
          <Link href="/contact">Contact us</Link> with what happened and where. Reports
          go to the SPLAT team, not to the person you are reporting. We will tell you
          what we decided.
        </p>
      </section>

      <section>
        <h2>What we do about it</h2>
        <p>
          Depending on what happened: a private word, removal of content, suspension of
          an account, or removal of an organisation&apos;s ability to back work.
          Anything involving risk to a child is acted on immediately and, where
          appropriate, referred to the relevant authorities.
        </p>
      </section>
    </ProsePage>
  )
}
