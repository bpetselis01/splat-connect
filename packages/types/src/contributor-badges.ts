/**
 * The badges on a public contributor profile, derived from counts the
 * profile endpoint already has — nothing is stored, so nothing can be
 * awarded by asking ("Earned by doing, not by asking", as the board puts it).
 *
 * The board's set is First guide / 10 guides / 25 guides / Org leader /
 * 100 builds / Clinic host. Builds are logged by families (091) and summed
 * over the person's published guides. Clinics are not in the data model.
 * "Org leader" is drawn from a guide backed by an organisation (tutorial_orgs
 * accepted), which is public; org_leaders is not. Only earned badges are
 * returned — the board greys unearned ones, but a
 * list of what somebody has NOT done is not a profile.
 */
export interface ContributorBadge {
  id: string
  label: string
}

export interface ContributorBadgeInput {
  guides: number
  /** Builds logged from this person's published guides (091). */
  builds: number
  orgBacked: boolean
  /** profiles.created_at */
  since: string
}

/** The thresholds contributorBadges() awards at; the explainer and the
 *  "next badge" line read these too, so none of them can drift. */
const GUIDE_TIERS = [
  { id: 'first-guide', label: 'First guide', at: 1 },
  { id: 'guides-10', label: '10 guides', at: 10 },
  { id: 'guides-25', label: '25 guides', at: 25 },
] as const
const BUILDS_TIER = { id: 'builds-100', label: '100 builds', at: 100 } as const

export function contributorBadges(
  input: ContributorBadgeInput,
  now: Date = new Date(),
): ContributorBadge[] {
  const out: ContributorBadge[] = []
  for (const t of GUIDE_TIERS) if (input.guides >= t.at) out.push({ id: t.id, label: t.label })
  if (input.orgBacked) out.push({ id: 'org-backed', label: 'Org backed' })
  if (input.builds >= BUILDS_TIER.at) out.push({ id: BUILDS_TIER.id, label: BUILDS_TIER.label })
  const years = Math.floor((now.getTime() - new Date(input.since).getTime()) / 31_557_600_000)
  if (years >= 1) out.push({ id: `years-${years}`, label: years === 1 ? '1 year on SPLAT' : `${years} years on SPLAT` })
  return out
}

/** The nearest count-based badge not yet earned, or null when none is left.
 *  Org backed and years on SPLAT have no count to close in on. */
export function nextBadgeThreshold(
  counts: Pick<ContributorBadgeInput, 'guides' | 'builds'>,
): { label: string; remaining: number; what: 'guide' | 'build' } | null {
  const open = [
    ...GUIDE_TIERS.map((t) => ({ label: t.label, remaining: t.at - counts.guides, what: 'guide' as const })),
    { label: BUILDS_TIER.label, remaining: BUILDS_TIER.at - counts.builds, what: 'build' as const },
  ].filter((c) => c.remaining > 0)
  return open.reduce<(typeof open)[number] | null>((a, c) => (a && a.remaining <= c.remaining ? a : c), null)
}

/** "2 more guides for 10 guides" — null when every count badge is earned. */
export function nextBadgeLine(counts: Pick<ContributorBadgeInput, 'guides' | 'builds'>): string | null {
  const n = nextBadgeThreshold(counts)
  return n && `${n.remaining} more ${n.what}${n.remaining === 1 ? '' : 's'} for ${n.label}`
}

/** One sentence per badge, for the "How badges are earned" explainer. */
export const BADGE_RULES: { label: string; rule: string }[] = [
  ...GUIDE_TIERS.map((t) => ({
    label: t.label,
    rule: t.at === 1 ? 'Publish your first approved guide.' : `Have ${t.at} approved guides published.`,
  })),
  { label: 'Org backed', rule: 'A guide of yours is backed by an organisation.' },
  { label: BUILDS_TIER.label, rule: `Families log ${BUILDS_TIER.at} builds from your published guides.` },
  { label: 'Years on SPLAT', rule: 'Awarded for each full year since you joined.' },
]
