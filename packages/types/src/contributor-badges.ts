/**
 * The badges on a public contributor profile, derived from counts the
 * profile endpoint already has — nothing is stored, so nothing can be
 * awarded by asking ("Earned by doing, not by asking", as the board puts it).
 *
 * The board's own set is First guide / 10 guides / 25 guides / Org leader /
 * 100 builds / Clinic host. Builds and clinics are not in the data model, and
 * the closest honest number to "built" is a thank (066), so the thanks tiers
 * stand in for the builds tier. "Org leader" is drawn from a guide backed by
 * an organisation (tutorial_orgs accepted), which is public; org_leaders is
 * not. Only earned badges are returned — the board greys unearned ones, but a
 * list of what somebody has NOT done is not a profile.
 */
export interface ContributorBadge {
  id: string
  label: string
}

export interface ContributorBadgeInput {
  guides: number
  thanks: number
  orgBacked: boolean
  /** profiles.created_at */
  since: string
}

export function contributorBadges(
  input: ContributorBadgeInput,
  now: Date = new Date(),
): ContributorBadge[] {
  const out: ContributorBadge[] = []
  if (input.guides >= 1) out.push({ id: 'first-guide', label: 'First guide' })
  if (input.guides >= 10) out.push({ id: 'guides-10', label: '10 guides' })
  if (input.guides >= 25) out.push({ id: 'guides-25', label: '25 guides' })
  if (input.orgBacked) out.push({ id: 'org-backed', label: 'Org backed' })
  if (input.thanks >= 10) out.push({ id: 'thanks-10', label: '10 thanks' })
  if (input.thanks >= 100) out.push({ id: 'thanks-100', label: '100 thanks' })
  const years = Math.floor((now.getTime() - new Date(input.since).getTime()) / 31_557_600_000)
  if (years >= 1) out.push({ id: `years-${years}`, label: years === 1 ? '1 year on SPLAT' : `${years} years on SPLAT` })
  return out
}
