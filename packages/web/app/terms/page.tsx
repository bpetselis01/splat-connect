import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Terms of use — SPLAT Connect' }

export default function TermsPage() {
  return (
    <ProsePage
      title="Terms of use"
      lastUpdated="19 August 2026"
      intro="These terms cover using this site. If you publish guides there are additional contributor terms, and if you lead an organisation there are organisation leader terms."
    >
      <section>
        <h2>What SPLAT Connect is</h2>
        <p>
          A free library of instructions for adapting commercially available toys so
          that children with disabilities can operate them, plus a way for people and
          organisations to pass on toys they have adapted. We publish and moderate the
          library. We do not manufacture, sell, or supply toys, parts or devices.
        </p>
      </section>

      <section>
        <h2>Guides are instructions, not products</h2>
        <p>
          Every guide is written by a volunteer and reviewed before publication.
          Review means someone competent read it and stood behind it; it is not
          certification, and it is not a substitute for your own judgement. You are
          responsible for the work you do and for deciding whether the result is safe
          for the child who will use it. Please read the <Link href="/safety">safety
          page</Link> before you start.
        </p>
      </section>

      <section>
        <h2>Adapting a toy voids its warranty</h2>
        <p>
          Opening a toy to fit a switch will void the manufacturer&apos;s warranty and
          may breach its terms of sale. That is a decision for you to make about
          property you own.
        </p>
      </section>

      <section>
        <h2>Toy exchanges and donations happen between people</h2>
        <p>
          When you arrange to give or receive a toy through this site, the arrangement
          is between you and the other party. SPLAT provides the introduction, the
          messaging thread and the handover confirmation. We do not inspect toys, hold
          payment, or guarantee that anyone turns up. Meet somewhere sensible, and use
          the platform&apos;s confirmation codes rather than agreeing offline.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <ul>
          <li>Give accurate information, and keep your sign-in details to yourself.</li>
          <li>One account per person.</li>
          <li>
            Do not upload anything you do not have the right to share, and do not
            upload photographs of other people&apos;s children.
          </li>
          <li>
            We may suspend an account that puts children at risk, misrepresents an
            organisation, or repeatedly breaches the <Link href="/code-of-conduct">code
            of conduct</Link>.
          </li>
        </ul>
      </section>

      <section>
        <h2>Content you publish</h2>
        <p>
          You keep ownership of what you write and upload. By publishing it here you
          give SPLAT permission to host it, display it, and let others use it to adapt
          toys. Licensing specifics for guides and design files are set out in the
          <Link href="/legal/contributor-terms"> contributor terms</Link>.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          This is a free service run by a small team. We do not promise uptime, and
          features may change or be withdrawn. Keep your own copy of anything you
          would be sorry to lose.
        </p>
      </section>

      <section>
        <h2>Questions</h2>
        <p>
          <Link href="/contact">Contact us</Link> if anything here is unclear.
        </p>
      </section>
    </ProsePage>
  )
}
