import {
  Buildings,
  ClipboardText,
  Flag,
  Hammer,
  Handshake,
  Lightbulb,
  MagnifyingGlass,
  NotePencil,
  Printer,
  Tray,
  UserPlus,
  UsersThree,
  Warning,
} from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@splat-connect/types'
import type {
  Tutorial,
  AdminAccountsResponse,
  Organization,
  ToyIdea,
  OrganizationRequest,
} from '@splat-connect/types'

type Counted = Array<Record<string, unknown>>

export default async function AdminPage() {
  const [tutorials, accounts, organizations, spotCheck, ideas, orgRequests] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending'),
    apiClient.get<AdminAccountsResponse>('/api/admin/contributors'),
    apiClient.get<Organization[]>('/api/organizations'),
    apiClient.get<Tutorial[]>('/api/admin/spot-check'),
    apiClient.get<ToyIdea[]>('/api/admin/ideas'),
    // Degrades to empty rather than taking the dashboard down: an admin who
    // came here to answer a report does not care that one count is missing.
    apiClient
      .get<OrganizationRequest[]>('/api/admin/organization-requests')
      .catch(() => [] as OrganizationRequest[]),
  ])

  // The 065 queues, all degrading to empty for the same reason as the
  // organisation requests above: an admin who came here to answer a safety
  // report does not care that one count is missing.
  const [inbox, memberReports, buildRequests, printJobs] = await Promise.all([
    apiClient.get<Counted>('/api/admin/inbox').catch(() => [] as Counted),
    apiClient.get<Counted>('/api/admin/member-reports').catch(() => [] as Counted),
    apiClient.get<Counted>('/api/admin/build-requests').catch(() => [] as Counted),
    apiClient.get<Counted>('/api/admin/print-jobs').catch(() => [] as Counted),
  ])

  const pendingTutorials = tutorials.length
  const totalContributors = accounts.total
  const pendingIdeas = ideas.filter((i) => i.status === 'pending').length
  const pendingOrgRequests = orgRequests.filter((r) => r.status === 'pending').length

  const pendingReports = memberReports.filter((r) => r.status !== 'resolved').length
  const stalledPrints = printJobs.filter((j) => j.stalled).length
  const nudgeBuilds = buildRequests.filter((b) => b.unclaimed_too_long || b.claimed_and_silent).length

  // The board's order and tints. A warning count draws in its colour only when
  // it is non-zero: a red 0 would be an alarm about nothing.
  const cards = [
    {
      label: 'Site content',
      count: 4,
      href: '/admin/content' as const,
      icon: NotePencil,
      tint: 'var(--tmint)',
      hint: 'Home numbers, team and partners, Learn, legal',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials,
      href: '/admin/review' as const,
      icon: ClipboardText,
      tint: 'var(--tamber)',
      hint: 'Approve or send back submitted guides',
    },
    {
      label: 'Reports from members',
      count: pendingReports,
      href: '/admin/reports' as const,
      icon: Flag,
      tint: 'var(--tcoral)',
      numColor: pendingReports ? 'var(--bad)' : undefined,
      hint: 'Private problem reports — safety first, then oldest',
    },
    {
      label: 'Design challenges awaiting review',
      count: pendingIdeas,
      href: '/admin/ideas' as const,
      icon: Lightbulb,
      tint: 'var(--tviolet)',
      hint: 'Publish or reject submitted ideas',
    },
    {
      label: 'Spot-check',
      count: spotCheck.length,
      href: '/admin/spot-check' as const,
      icon: MagnifyingGlass,
      tint: 'var(--b100)',
      hint: 'Audit guides org leaders approved',
    },
    {
      label: 'Print jobs stalled',
      count: stalledPrints,
      href: '/admin/print-jobs' as const,
      icon: Printer,
      tint: 'var(--tviolet)',
      numColor: stalledPrints ? 'var(--warn)' : undefined,
      hint: 'Accepted but not moved in ten days',
    },
    {
      label: 'Build requests needing a nudge',
      count: nudgeBuilds,
      href: '/admin/build-requests' as const,
      icon: Hammer,
      tint: 'var(--tamber)',
      numColor: nudgeBuilds ? 'var(--warn)' : undefined,
      hint: 'Unclaimed two weeks, or claimed and silent',
    },
    {
      label: 'Inbox',
      count: inbox.filter((m) => m.status === 'open').length,
      href: '/admin/inbox' as const,
      icon: Tray,
      tint: 'var(--tmint)',
      hint: 'Contact-form messages, safety first',
    },
    {
      label: 'Accounts',
      count: totalContributors,
      href: '/admin/contributors' as const,
      icon: UsersThree,
      tint: 'var(--tmint)',
      hint: 'Review and remove accounts',
    },
    {
      label: 'Organisations',
      count: organizations.length,
      href: '/admin/organizations' as const,
      icon: Buildings,
      tint: 'var(--tcoral)',
      hint: 'Create organisations, appoint leaders, suspend',
    },
    // Not on the board, which predates the request queue. Kept: it is the only
    // way into /admin/organization-requests.
    {
      label: 'Organisation requests',
      count: pendingOrgRequests,
      href: '/admin/organization-requests' as const,
      icon: Handshake,
      tint: 'var(--b100)',
      hint: 'Approve one and the organisation is created with its first leader',
    },
  ]

  // Recent activity, assembled from the queues already fetched above — there is
  // no audit log. Each queue contributes its arrivals; the six newest win.
  const newAccounts = accounts.accounts.filter((a) => withinAWeek(a.created_at))
  const feed: Array<{ key: string; at: string; icon: Icon; body: string }> = [
    ...tutorials.map((t) => ({
      key: `t${t.id}`,
      at: t.created_at,
      icon: ClipboardText,
      body: `"${t.title}" submitted for review`,
    })),
    ...ideas.map((i) => ({
      key: `i${i.id}`,
      at: i.created_at,
      icon: Lightbulb,
      body: `New idea submitted — "${i.title}"`,
    })),
    ...orgRequests.map((r) => ({
      key: `o${r.id}`,
      at: r.created_at,
      icon: Buildings,
      body: `${r.org_name} asked to join as an organisation`,
    })),
    ...memberReports.map((r) => ({
      key: `r${String(r.id)}`,
      at: String(r.created_at),
      icon: r.category === 'safety' ? Warning : Flag,
      body: `${r.category === 'safety' ? 'Safety report' : 'Report'} on "${String(r.subject_label ?? 'a page')}"`,
    })),
    ...inbox.map((m) => ({
      key: `m${String(m.id)}`,
      at: String(m.created_at),
      icon: Tray,
      body: `Message from ${String(m.name ?? 'someone')}`,
    })),
    ...(newAccounts.length
      ? [
          {
            key: 'accounts',
            at: newAccounts[0].created_at,
            icon: UserPlus,
            body: `${newAccounts.length} new account${newAccounts.length === 1 ? '' : 's'} created`,
          },
        ]
      : []),
  ]
    .filter((f) => !Number.isNaN(new Date(f.at).getTime()))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)

  return (
    <div className="max-w-[1120px]">
      <h1 className="title-hub text-[clamp(30px,3.4vw,44px)]">Admin dashboard</h1>
      <p className="mt-2.5 mb-[30px] max-w-[58ch] text-base text-muted">
        Six queues. Anything with a number on it is waiting for a person.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card card-link p-[26px]">
            <div className="flex items-start gap-4">
              {/* A duotone glyph on the tint, not an emoji: an emoji renders
                  in the reader's system font, carries none of the palette, and
                  is a different drawing on every operating system. */}
              <span
                aria-hidden="true"
                className="grid h-14 w-14 shrink-0 place-items-center rounded-[18px]"
                style={{ background: c.tint, color: 'var(--tink)' }}
              >
                <c.icon size={30} weight="duotone" />
              </span>
              <div>
                <p
                  className="font-display text-[38px] leading-none font-extrabold tabular-nums"
                  style={{ color: c.numColor ?? 'var(--ink)' }}
                >
                  {c.count}
                </p>
                <p className="mt-1 font-display text-[17px] font-extrabold">{c.label}</p>
                <p className="mt-[3px] text-sm text-muted">{c.hint}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {feed.length > 0 && (
        <>
          <h2 className="mt-11 mb-4 font-display text-2xl font-extrabold">Recent activity</h2>
          <ul className="flex flex-col gap-2.5">
            {feed.map((f) => (
              <li
                key={f.key}
                className="flex items-center gap-3.5 rounded-[18px] border-[length:var(--bw)] border-line bg-surface px-5 py-4"
                style={{ boxShadow: 'var(--e1)' }}
              >
                <f.icon size={22} weight="duotone" aria-hidden="true" className="shrink-0 text-[var(--b600)]" />
                <span className="flex-1 text-[15px]">{f.body}</span>
                <span className="shrink-0 font-mono text-xs font-medium text-muted">{stamp(f.at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// Module scope: reading the clock inside the component is impure render.
function withinAWeek(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 7 * 864e5
}

// `2 Sep 14:02` — the board's feed stamp, in Sydney time like every other date.
function stamp(iso: string): string {
  const time = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
  return `${shortDate(iso)} ${time}`
}
