import Link from 'next/link'
import { ProsePage, PullQuote } from '@/components/prose-page'

export const metadata = { title: 'Privacy policy — SPLAT Connect' }

export default function PrivacyPage() {
  return (
    <ProsePage
      title="Privacy policy"
      lastUpdated="1 September 2026"
      intro="SPLAT Connect is used by families describing their children's needs. We collect as little as the platform can function on, and we say plainly what happens to it."
    >
      <PullQuote>
        We never sell anything about you, and we never will. That is the short version.
      </PullQuote>
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
        <h2>Health information, and why the rules apply to us</h2>
        <p>
          Some of what you tell us about your child — how they use their hands, and
          any clinical scores you choose to share — is health information under
          Australian privacy law. Organisations our size are often exempt from the
          Privacy Act 1988. We don&apos;t rely on that exemption. Because we hold
          health information about children, we treat ourselves as fully bound by the
          Act and the Australian Privacy Principles.
        </p>
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
        {/* TODO(splat): the pickup-address period is a commitment, not yet
            automation — no scheduled job clears it. Account deletion itself is
            immediate (083_account_deletion.sql). */}
        <h2>How long we keep things</h2>
        <ul>
          <li>Your account and child profiles: while your account is open. Deleting your account removes them straight away.</li>
          <li>Pickup addresses: 12 months after the exchange is completed, or straight away if you delete your account.</li>
          <li>
            Published guides: indefinitely, because families rely on them. When you delete
            your account they are credited to &ldquo;A former contributor&rdquo;, unless you
            choose to keep your name.
          </li>
          <li>
            Other members&apos; records of exchanges and messages with you: kept for them,
            shown as &ldquo;Deleted member&rdquo; once your account is gone.
          </li>
          <li>Records we&apos;re required by law to keep, such as exchange costs: 7 years, without your name.</li>
        </ul>
      </section>

      <section>
        <h2>Where it is stored</h2>
        <p>
          Data is held in Supabase (PostgreSQL and object storage). Access is
          restricted at the database level by row-level security, so one account
          cannot read another account&apos;s private records even if application code
          were to ask for them.
        </p>
        <p>
          The database and stored files are hosted in Sydney, Australia. If any of
          your information is stored or handled outside Australia we&apos;ll
          name the country here, and we take reasonable steps to make sure it&apos;s
          handled to Australian standards. We stay responsible for it either way.
        </p>
      </section>

      <section>
        <h2>Automated suggestions</h2>
        <p>
          Your answers are turned into suggestions automatically. It&apos;s a matching
          process, not a clinical judgement — see{' '}
          <Link href="/legal/intended-purpose">what SPLAT Connect is (and isn&apos;t)</Link>.
          You can ask us how a suggestion was reached, and you can ask a person to
          review it.
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
        <p>
          If your child is old enough to understand, please ask them before you create
          their profile. It&apos;s their information too, and if they&apos;d rather you
          didn&apos;t, that&apos;s a good enough reason not to.
        </p>
      </section>

      <section>
        <h2>Getting a copy, fixing it, or complaining</h2>
        <p>
          You can delete a child profile, a toy, or a draft guide yourself at any time
          from your dashboard, and you can delete your whole account yourself too: in
          the app under Account, or on the web (see{' '}
          <Link href="/delete-account">how to delete your account</Link>). It takes
          effect straight away and removes your profile, child profiles, drafts, saved
          items, photos and pickup address. To get a copy of what we hold about you or
          your child, or to correct it, <Link href="/contact">contact us</Link>.
          We&apos;ll respond within 30 days and we don&apos;t charge.
        </p>
        <p>
          If you&apos;re unhappy with how we&apos;ve handled your information, tell us
          first — we&apos;ll investigate and come back to you within 30 days. If
          you&apos;re still unhappy you can complain to the Office of the Australian
          Information Commissioner at oaic.gov.au or 1300 363 992.
        </p>
      </section>

      <section>
        <h2>If something goes wrong</h2>
        <p>
          If information is exposed in a way that&apos;s likely to cause you serious
          harm, we&apos;ll tell you and we&apos;ll notify the Office of the Australian
          Information Commissioner, as the Notifiable Data Breaches scheme requires.
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
