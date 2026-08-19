import Link from 'next/link'
import { ProsePage } from '@/components/prose-page'

export const metadata = { title: 'Privacy policy — SPLAT Connect' }

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy policy"
      lastUpdated="19 August 2026"
      intro="SPLAT Connect is used by families describing their children's needs. We collect as little as the platform can function on, and we say plainly what happens to it."
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your account.</strong> An email address and a display name. The
            email address identifies your account and is where we send confirmations
            and notifications. Your display name appears publicly next to guides you
            are credited on.
          </li>
          <li>
            <strong>Child profile information.</strong> If you create a child profile,
            we store the name or nickname you enter, and the abilities and preferences
            you record so guides can be matched to them. This is the most sensitive
            data on the platform. It is visible only to your account. It is never
            published, never shown on a public page, and never shared with
            contributors or organisations.
          </li>
          <li>
            <strong>Toys and guides you publish.</strong> Titles, descriptions, parts
            lists, photographs and files you upload. These are public by design.
          </li>
          <li>
            <strong>Pickup addresses.</strong> When you accept a toy exchange or
            donation, the address you provide is recorded on that transaction so the
            other party can collect or deliver. It is visible to the other party in
            that single transaction and to nobody else.
          </li>
          <li>
            <strong>Interest registrations.</strong> If you ask to be told when a
            feature launches, we store your email address against that feature and
            nothing else.
          </li>
        </ul>
      </section>

      <section>
        <h2>What we do not do</h2>
        <ul>
          <li>We do not sell or rent personal information.</li>
          <li>We do not run advertising, and we do not share data with advertisers.</li>
          <li>
            We do not publish child profile data, in any aggregated or anonymised
            form, on any public page.
          </li>
        </ul>
      </section>

      <section>
        <h2>Public by design</h2>
        <p>
          Some information is public because the platform would not work otherwise:
          your display name on guides you are credited on, guides and toys you
          publish, and your contributor profile. You can remove your contributor
          profile and your name from the public impact pages at any time from your
          dashboard — this does not remove per-guide credit, which stays attached to
          the work.
        </p>
      </section>

      <section>
        <h2>Where it is stored</h2>
        <p>
          Data is held in Supabase (PostgreSQL and object storage). Access is
          restricted at the database level by row-level security, so one account
          cannot read another account&apos;s private records even if application code
          were to ask for them.
        </p>
      </section>

      <section>
        <h2>Children</h2>
        <p>
          Accounts are for adults. Child profiles are created and managed by a parent
          or carer from their own account; children do not have accounts of their own.
          We ask for the minimum needed to match a guide to a child, and we recommend
          using a first name or nickname rather than a full legal name.
        </p>
      </section>

      <section>
        <h2>Getting your data, or getting it deleted</h2>
        <p>
          You can delete a child profile, a toy, or a draft guide yourself at any time
          from your dashboard. To request a copy of everything associated with your
          account, or deletion of the account entirely,{' '}
          <Link href="/contact">contact us</Link>. Deleting an
          account removes your child profiles, your unpublished work and your pickup
          addresses. Published guides that other people have contributed to remain,
          with your name removed unless you ask otherwise.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          When this policy changes materially we will update the date above and notify
          account holders by email rather than changing it quietly.
        </p>
      </section>
    </ProsePage>
  )
}
