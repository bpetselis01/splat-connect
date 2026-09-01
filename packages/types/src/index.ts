// The internal fit-profile derivation behind both mobile's ability-screen.tsx
// quiz and the web child-survey-form.tsx quiz. Runtime values, not just types —
// this package is consumed as raw TypeScript, so that is safe.
export * from './derive-fit-profile'
export * from './nav-model'

export type Role = 'admin' | 'contributor'

export interface ChildProfile {
  id: string
  parent_id: string
  // Optional: a parent may add a child without naming one. The UI falls back to
  // "Child N" by position — see packages/web/lib/child-label.ts.
  name: string | null
  age: number | null
  // Ability Profile
  macs_level: string | null
  macs_source: 'manual' | 'estimated'
  hand_involvement: 'bilateral' | 'unilateral' | null
  assist_hand: 'left' | 'right' | null
  bfmf_score: string | null
  bfmf_source: 'manual' | 'estimated'
  // Everyday Needs
  challenges: string[]
  challenge_other: string | null
  grip_type: string | null
  env_context: string | null
  // Customization Metrics
  palm_width_mm: number | null
  wrist_circ_mm: number | null
  needs_arm_attachment: boolean
  forearm_length_mm: number | null
  hand_dominance: string | null
  sensory_preferences: string[]
  created_at: string
  updated_at: string
}

export type OfferType = 'donation' | 'exchange' | 'both'

export interface Toy {
  id: string
  /** Null when an organisation holds it. Exactly one of this and
   *  `owner_org_id` is set — 033's `toys_one_owner` constraint. */
  owner_id: string | null
  owner_org_id: string | null
  /** Units in stock. Always 1 for a person's toy, which 033's
   *  `toys_person_single_unit` constraint enforces rather than merely
   *  assumes. An organisation's may reach 0 without the row going away. */
  quantity: number
  name: string
  description: string | null
  condition: number
  switch_adapted: boolean
  cover_photo_url: string | null
  switch_photo_urls: string[]
  status: 'draft' | 'published'
  offer_type: OfferType | null
  created_at: string
  updated_at: string
}

// GET /api/public/toys and /api/public/toys/:id embed the owner's name.
// Nullable to match profiles(name)'s embed semantics, though in practice
// every toy has an owner.
// Exactly one of the two embeds is present, mirroring the XOR on the row: a
// toy is held by a person or by an organisation.
export type ToyWithOwner = Toy & {
  profiles: { name: string } | null
  organizations: { name: string } | null
}

/** Who a browsing visitor is being offered this toy by. */
export function toyHolderName(toy: Pick<ToyWithOwner, 'profiles' | 'organizations'>): string | null {
  return toy.organizations?.name ?? toy.profiles?.name ?? null
}

export type ToyTransactionType = 'donation' | 'exchange'
export type ToyTransactionStatus = 'requested' | 'accepted' | 'rejected' | 'withdrawn' | 'completed'

export interface ToyTransaction {
  id: string
  toy_id: string
  offered_toy_id: string | null
  type: ToyTransactionType
  status: ToyTransactionStatus
  requester_id: string
  /** The giving side. Null when an organisation is giving, in which case any of
   *  its leaders acts here — see `isOwnerSide`. Exactly one of this and
   *  `owner_org_id` is set. */
  owner_id: string | null
  owner_org_id: string | null
  owner_code: string | null
  requester_code: string | null
  owner_confirmed_at: string | null
  requester_confirmed_at: string | null
  pickup_line1: string | null
  pickup_suburb: string | null
  pickup_state: string | null
  pickup_postcode: string | null
  /** Copied from the organisation at accept time, so the requester reads it off
   *  their own transaction row rather than off a table they cannot select. */
  pickup_instructions: string | null
  created_at: string
  updated_at: string
}

/**
 * Whether the viewer is the giving side of a transaction.
 *
 * The three places that used to ask `owner_id === viewerId` are each correct for
 * a person and silently wrong for an organisation, where `owner_id` is null and
 * the answer is "no" for a leader who is very much the owner side. The worst of
 * the three is the handoff code: it fails with no error at all, as two people
 * stand in a room reciting a number that does not match.
 */
export function isOwnerSide(
  tx: Pick<ToyTransaction, 'owner_id' | 'owner_org_id'>,
  viewerId: string,
  ledOrgIds: readonly string[] = []
): boolean {
  if (tx.owner_org_id) return ledOrgIds.includes(tx.owner_org_id)
  return tx.owner_id === viewerId
}

// The four pickup fields as a required unit. The owner supplies these when
// accepting a request — either copied from their saved profile default or
// typed fresh — so unlike the nullable columns on ToyTransaction and the
// optional ones on Profile, every field here is present.
export interface PickupAddress {
  pickup_line1: string
  pickup_suburb: string
  pickup_state: string
  pickup_postcode: string
}

// `blocked_by_rival_accept` is computed per read, not stored: true when this
// request is still open but a sibling request on the same toy is already
// accepted, so the owner cannot accept this one until that handoff completes
// or is withdrawn.
export interface ToyTransactionSummary extends ToyTransaction {
  toy_name: string
  /** Null when the toy has none. Readable by both parties for good: 025's
   *  "Transaction parties can view each other's toy" policy outlives the
   *  handoff, which is what lets a giver still see what they gave. */
  toy_cover_photo_url: string | null
  offered_toy_name: string | null
  offered_toy_cover_photo_url: string | null
  other_party_name: string
  /** The organisation the viewer is answering for, when they are its leader.
   *  Null for a personal handoff and for the family on the other side. */
  acting_for_org_name: string | null
  blocked_by_rival_accept: boolean
  /** Newest message in the thread, for the list preview. Null before any exists. */
  last_message: ToyTransactionMessagePreview | null
}

export type ToyTransactionMessagePreview = Pick<
  ToyTransactionMessage,
  'body' | 'sender_id' | 'kind' | 'created_at'
>

/**
 * Whether a transaction is waiting on one particular person. Only two states
 * qualify — an incoming request they have not answered, and an accepted handoff
 * still missing their confirmation. Everything else is finished or waiting on
 * the other party.
 *
 * Shared because the API counts these for the Exchanges badge while the web list
 * marks the same cards "waiting on you": two copies would let the number disagree
 * with the rows it claims to count.
 *
 * Declared here rather than in its own module for the same reason as
 * AGREEMENT_VERSIONS: the API runs this package as raw TypeScript under Node's
 * ESM loader, which does not surface `export * from './x'` re-exports to it. A
 * value the API imports has to live in this file.
 *
 * `blocked_by_rival_accept` requests are excluded: the owner cannot accept one
 * while another handoff on the same toy is in flight, and that handoff is itself
 * counted. Including both would show one real obligation as two.
 */
export function needsAction(
  tx: Pick<
    ToyTransaction,
    | 'status'
    | 'type'
    | 'owner_id'
    | 'owner_org_id'
    | 'owner_confirmed_at'
    | 'requester_confirmed_at'
  > & { blocked_by_rival_accept?: boolean },
  viewerId: string,
  // The orgs the viewer leads. Without it an org request waiting on a leader
  // never reaches the badge, and they are told nothing is waiting on them while
  // a family waits for an answer. Defaulted so every person-to-person caller is
  // unchanged.
  ledOrgIds: readonly string[] = []
): boolean {
  const isOwner = isOwnerSide(tx, viewerId, ledOrgIds)

  if (tx.status === 'requested') return isOwner && !tx.blocked_by_rival_accept

  if (tx.status === 'accepted') {
    // Donations are confirmed by the owner alone; exchanges need both parties.
    const confirms = tx.type === 'exchange' || isOwner
    const alreadyConfirmed = isOwner ? tx.owner_confirmed_at : tx.requester_confirmed_at
    return confirms && alreadyConfirmed === null
  }

  return false
}

/** The copy the Exchanges badge is counting, shown on the card itself. */
export function actionLabel(tx: Pick<ToyTransaction, 'status'>): string {
  return tx.status === 'requested'
    ? 'Waiting on you — accept or decline'
    : 'Waiting on you — confirm the handoff'
}

/**
 * One toy this viewer no longer has, because they handed it over.
 *
 * `at` is the completion time (updated_at on a completed row), not when the
 * request was made — the date a person remembers is the day they met.
 */
export interface GivenAwayToy {
  transaction_id: string
  toy_id: string
  name: string
  cover_photo_url: string | null
  other_party_name: string
  type: ToyTransactionType
  /** On an exchange, what came back the other way. Null on a donation. */
  received_name: string | null
  at: string
}

/**
 * What the viewer gave away, newest first.
 *
 * The exact inverse of `received_toy` (see ReceivedToy above): the requester
 * takes toy_id and, on an exchange, the owner takes offered_toy_id — so the
 * GIVER of toy_id is the owner side, and the giver of offered_toy_id is the
 * requester. A requester on a donation gave nothing and gets no row.
 *
 * Shared rather than written twice because both clients render this section
 * and a disagreement between them is a person told they gave away a different
 * set of toys depending on which screen they opened — the same reasoning that
 * put isOwnerSide and needsAction here.
 *
 * Organisation stock is deliberately excluded. isOwnerSide answers true for a
 * leader, but a unit leaving org inventory is not something that leader
 * personally gave away, and it belongs on the organisation's own screen.
 */
export function givenAway(
  transactions: readonly ToyTransactionSummary[],
  viewerId: string,
  ledOrgIds: readonly string[] = []
): GivenAwayToy[] {
  const rows: GivenAwayToy[] = []

  for (const tx of transactions) {
    if (tx.status !== 'completed') continue
    if (tx.owner_org_id) continue

    const base = {
      transaction_id: tx.id,
      other_party_name: tx.other_party_name,
      type: tx.type,
      at: tx.updated_at,
    }

    if (isOwnerSide(tx, viewerId, ledOrgIds)) {
      rows.push({
        ...base,
        toy_id: tx.toy_id,
        name: tx.toy_name,
        cover_photo_url: tx.toy_cover_photo_url,
        received_name: tx.offered_toy_name,
      })
    } else if (tx.requester_id === viewerId && tx.offered_toy_id) {
      // Their half of a swap. Guarded on offered_toy_id rather than on
      // type === 'exchange': a row typed as an exchange that never got a toy
      // attached has nothing of theirs that changed hands.
      rows.push({
        ...base,
        toy_id: tx.offered_toy_id,
        name: tx.offered_toy_name ?? '',
        cover_photo_url: tx.offered_toy_cover_photo_url,
        received_name: tx.toy_name,
      })
    }
  }

  return rows.sort((a, b) => b.at.localeCompare(a.at))
}

export type ToyTransactionMessageKind = 'system' | 'user'

export interface ToyTransactionMessage {
  id: string
  transaction_id: string
  sender_id: string
  kind: ToyTransactionMessageKind
  body: string
  created_at: string
}

// The toy THIS viewer walked away with, present only once the handoff is
// complete. Computed per read like the codes are, because who received what
// depends on who is asking: the requester takes toy_id, and on an exchange the
// owner takes offered_toy_id. Null when the viewer received nothing — the giver
// on a donation, or any open transaction.
export type ReceivedToy = { id: string; name: string; status: Toy['status'] }

export interface ToyTransactionDetail extends ToyTransaction {
  toy_name: string
  offered_toy_name: string | null
  owner_name: string
  requester_name: string
  blocked_by_rival_accept: boolean
  received_toy: ReceivedToy | null
  messages: ToyTransactionMessage[]
}

export type ToyIdeaStatus = 'pending' | 'challenge' | 'rejected' | 'graduated'

/** How involved the author wants to be if their idea becomes a challenge. */
export const CONTACT_PREFS = ['clarification', 'co_design', 'user_testing'] as const
export type ContactPref = (typeof CONTACT_PREFS)[number]

export interface ToyIdea {
  id: string
  author_id: string
  title: string
  summary: string
  description: string
  intended_use: string
  primary_user: string
  contact_prefs: ContactPref[]
  status: ToyIdeaStatus
  review_note: string | null
  tutorial_id: string | null
  created_at: string
  updated_at: string
}

export interface ToyIdeaParticipant {
  idea_id: string
  profile_id: string
  joined_at: string
  /** Set when a report removes this person from the challenge — filed by the
   *  idea's author or a current participant (041/042); a removed row is kept,
   *  not deleted. Cleared only by an admin reinstating them. */
  removed_at: string | null
  /** The reporter who caused the removal; null again once an admin reinstates. */
  removed_by: string | null
  /** Joined from profiles at read time for display. */
  name?: string | null
}

export interface ToyIdeaMessage {
  id: string
  idea_id: string
  sender_id: string
  kind: 'system' | 'user'
  body: string
  created_at: string
}

export interface ToyIdeaDetail extends ToyIdea {
  author_name: string | null
  participants: ToyIdeaParticipant[]
  /** Absent for viewers who may not read the thread. */
  messages?: ToyIdeaMessage[]
}

/**
 * The structural minimum ExchangeChat needs to render a thread. Both
 * ToyTransactionMessage and ToyIdeaMessage satisfy it, which is why the
 * component takes this instead of either concrete type.
 */
export interface ThreadMessage {
  id: string
  sender_id: string
  kind: 'system' | 'user'
  body: string
  created_at: string
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export type TutorialStatus = 'draft' | 'pending' | 'approved' | 'rejected'
export type ContributorRole = 'primary' | 'collaborator'

export type OrgStatus = 'active' | 'suspended'
export type TutorialOrgStatus = 'pending' | 'accepted' | 'declined'
export type AgreementType = 'contributor_terms' | 'org_leader_terms'

// The version string recorded against an acceptance. 'v0-todo' is deliberately
// non-binding: the real terms have not been written (they need a lawyer — see
// the spec's §6). Any acceptance recorded at this version is void and its rows
// should be discarded when real terms land.
export const AGREEMENT_VERSIONS: Record<AgreementType, string> = {
  contributor_terms: 'v0-todo',
  org_leader_terms: 'v0-todo',
}

export interface Organization {
  id: string
  name: string
  description: string | null
  status: OrgStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface OrgLeader {
  id: string
  org_id: string
  user_id: string
  created_at: string
  // Populated when the query joins either side.
  profiles?: Profile
  organizations?: Organization
}

/** One organisation's answer to one project. The author creates it as
 *  'pending'; only a leader of that organisation may answer. */
/**
 * What one leader may do with one project, derived from (backing, tutorial)
 * state — never from which route was opened. Lifted here from web's
 * components/project-actions.tsx when mobile's review detail became the second
 * consumer: two copies would let the clients offer a leader different actions
 * on the same project.
 */
export type LeaderAction = 'back' | 'decline' | 'approve' | 'reject'
export type AdminAction = 'approve' | 'reject' | 'unpublish'

export function leaderActions(
  backing: TutorialOrgStatus | null,
  tutorial: TutorialStatus
): LeaderAction[] {
  if (backing === 'pending') return ['back', 'decline']
  if (backing === 'accepted' && tutorial === 'pending') return ['approve', 'reject']
  return []
}

export function adminActions(tutorial: TutorialStatus): AdminAction[] {
  if (tutorial === 'pending') return ['approve', 'reject']
  // The reactive control decision 14 promised and never wired up.
  if (tutorial === 'approved') return ['unpublish']
  return []
}

export interface TutorialOrg {
  id: string
  tutorial_id: string
  org_id: string
  status: TutorialOrgStatus
  requested_at: string
  responded_at: string | null
  responded_by: string | null
  organizations?: Organization
}

export type CollaboratorInviteStatus = 'pending' | 'accepted' | 'declined'

/** One invite to co-author a tutorial. The primary contributor creates it as
 *  'pending'; only the invited profile may answer. */
export interface TutorialCollaboratorInvite {
  id: string
  tutorial_id: string
  invited_profile_id: string
  invited_by: string | null
  status: CollaboratorInviteStatus
  requested_at: string
  responded_at: string | null
  profiles?: Profile
}

export type NotificationType =
  | 'collaborator_invited'
  | 'collaborator_accepted'
  | 'collaborator_declined'
  | 'collaborator_removed'
  | 'collaborator_left'
  | 'backing_requested'
  | 'tutorial_submitted'
  | 'tutorial_approved'
  | 'tutorial_rejected'
  | 'toy_request'
  | 'toy_accepted'
  | 'toy_rejected'
  | 'toy_withdrawn'
  | 'toy_message'
  | 'idea_approved'
  | 'idea_rejected'
  | 'challenge_joined'
  | 'challenge_left'
  | 'challenge_removed'
  | 'idea_graduated'

/** Which My SPLAT card a notification's badge belongs to. */
export type NotificationBucket = 'tutorials' | 'exchanges' | 'challenges'

/**
 * Notification type → the hub card that counts it.
 *
 * Declared here rather than in the web app because the API groups by it and
 * the hub renders by it; two copies would drift the first time a type is added.
 *
 * `satisfies Record<NotificationType, NotificationBucket>` is load-bearing: a
 * twenty-first NotificationType becomes a compile error on this object rather
 * than a badge that silently never counts it.
 *
 * backing_requested and tutorial_submitted are the only two types whose
 * recipient is not the person the subject belongs to — they go to the leaders
 * who have to act, or to admins when no organisation is backing the work. They
 * still bucket as 'tutorials': the My SPLAT card that counts them is the one
 * about guides either way.
 *
 * Note there is no 'toys' bucket. Every toy_* type is an event on a
 * transaction, not on a toy, so they all belong to My exchanges — a toy
 * sitting on a shelf generates nothing.
 */
const NOTIFICATION_BUCKET = {
  collaborator_invited: 'tutorials',
  collaborator_accepted: 'tutorials',
  collaborator_declined: 'tutorials',
  collaborator_removed: 'tutorials',
  collaborator_left: 'tutorials',
  backing_requested: 'tutorials',
  tutorial_submitted: 'tutorials',
  tutorial_approved: 'tutorials',
  tutorial_rejected: 'tutorials',
  toy_request: 'exchanges',
  toy_accepted: 'exchanges',
  toy_rejected: 'exchanges',
  toy_withdrawn: 'exchanges',
  toy_message: 'exchanges',
  idea_approved: 'challenges',
  idea_rejected: 'challenges',
  idea_graduated: 'challenges',
  challenge_joined: 'challenges',
  challenge_left: 'challenges',
  challenge_removed: 'challenges',
} satisfies Record<NotificationType, NotificationBucket>

/** Every notification type, for iteration at runtime — the union alone is compile-time only. */
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_BUCKET) as NotificationType[]

export function notificationBucket(type: NotificationType): NotificationBucket {
  return NOTIFICATION_BUCKET[type]
}

/** The types in one bucket, for a grouped update. */
export function typesInBucket(bucket: NotificationBucket): NotificationType[] {
  return NOTIFICATION_TYPES.filter((t) => NOTIFICATION_BUCKET[t] === bucket)
}

/** The shape GET /api/notifications/me/unread-counts returns. */
export interface UnreadCounts {
  tutorials: number
  exchanges: number
  challenges: number
  total: number
}

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  tutorial_id?: string | null
  tutorial_title?: string | null
  toy_transaction_id?: string | null
  toy_name?: string | null
  idea_id?: string | null
  actor_name: string
  read_at: string | null
  created_at: string
}

export interface UserAgreement {
  id: string
  user_id: string
  agreement_type: AgreementType
  version: string
  accepted_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  pickup_line1?: string | null
  pickup_suburb?: string | null
  pickup_state?: string | null
  pickup_postcode?: string | null
  public_showcase: boolean
  created_at: string
}

// GET /api/admin/contributors. `total` is the exact count of matching rows,
// independent of how many `accounts` actually carries — see admin.ts for why
// the two can differ.
export interface AdminAccountsResponse {
  accounts: Profile[]
  total: number
}

/** Which walk a tutorial is on. The two differ by exactly one step — an
 *  assistive-tech build has STL files and needs at least one; a toy adaptation
 *  never shows the step — so this is a column rather than a second pipeline. */
export type TutorialKind = 'toy_adaptation' | 'assistive_tech'
/** The one place the display names live. */
export const KIND_LABEL: Record<TutorialKind, string> = {
  toy_adaptation: 'Toy adaptation',
  assistive_tech: 'Assistive tech',
}

export interface Tutorial {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  kind: TutorialKind
  status: TutorialStatus
  /** Storage object path in `tutorial-pdfs` (`<id>/tutorial.pdf`), not a URL — served via /files/tutorial-pdfs/<path>. Null until uploaded. */
  tutorial_pdf_url: string | null
  toy_photo_url: string | null
  rejection_note: string | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  // Snapshot of the org at submit time; null routes to the platform queue.
  reviewed_by: string | null
  reviewed_for_org_id: string | null
  // Populated when the query joins the backing rows (badges, leader queues).
  tutorial_orgs?: TutorialOrg[]
}

// Links a tutorial to a person. The profiles field is optional here
// but will be required when used inside TutorialWithDetails
export interface TutorialContributor {
  tutorial_id: string
  profile_id: string
  role: ContributorRole
  added_at: string
  // Optional: the actual person's profile info (name, email, etc.)
  profiles?: Profile
}

export interface BuyLink {
  label: string
  url: string
}

export interface Part {
  id: string
  tutorial_id: string
  name: string
  quantity: number
  is_optional: boolean
  buy_links: BuyLink[]
}

export interface Tool {
  id: string
  tutorial_id: string
  name: string
  is_optional: boolean
  buy_links: BuyLink[]
}

export interface StlFile {
  id: string
  tutorial_id: string
  filename: string
  /** Storage object path in `stl-files` (`<tutorial id>/<filename>`), not a URL — served via /files/stl-files/<path>. */
  file_url: string
}

/** One row of tutorial_recommendations with its target embedded. `status`
 *  rides along on the contributor-facing payload so the editor can badge a
 *  target that is not yet public; the public detail route drops such rows
 *  entirely, the way it drops backing that was never accepted. */
export interface Recommendation {
  position: number
  tutorials: Pick<Tutorial, 'id' | 'title' | 'kind' | 'difficulty' | 'toy_photo_url' | 'status'>
}

// A tutorial with all its related information: the parts needed, tools needed,
// 3D files, and the people who created it.
// Note: tutorial_contributors REQUIRES the profiles field (makes it non-optional)
// so you always have the contributor's full info when viewing a complete tutorial
export interface TutorialWithDetails extends Tutorial {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_recommendations: Recommendation[]
  tutorial_contributors: (TutorialContributor & { profiles: Profile })[]
  /** Optional because only the contributor-facing GET /api/tutorials/:id embeds
   *  it — the public detail route has no business exposing who was asked and
   *  said no. An accepted invite's person also holds a tutorial_contributors
   *  row above; components/team-state.tsx drops the duplicate. */
  tutorial_collaborator_invites?: (TutorialCollaboratorInvite & { profiles: Profile })[]
}

// UploadDraft lived here: the in-progress state of the six-step upload wizard,
// mirrored into sessionStorage so a reload did not cost six steps of typing.
// The wizard is gone — a tutorial is now created as a real row on its first
// save and edited from then on, so there is no pre-submission shape to model.

export interface ImpactEntity {
  id: string
  name: string
  tutorials: number
  toysShared: number
  toysDelivered: number
}

export interface ImpactOrgEntity extends ImpactEntity {
  projectsBacked: number
}

export interface ImpactRecent {
  kind: 'person' | 'org'
  id: string
  name: string
  at: string
}

export interface ImpactSummary {
  totals: {
    tutorials: number
    toysShared: number
    toysDelivered: number
    contributors: number
    organisations: number
  }
  recent: ImpactRecent[]
  contributors: ImpactEntity[]
  organisations: ImpactOrgEntity[]
}

export interface ContributorProfile {
  id: string
  name: string
  tutorials: Tutorial[]
  toysShared: Toy[]
  toysDelivered: Toy[]
}

export interface OrgPublicProfile {
  id: string
  name: string
  status: string
  tutorialsBacked: Tutorial[]
  tutorialsApproved: Tutorial[]
  toysShared: Toy[]
  toysDelivered: Toy[]
}

/**
 * What a save can point at.
 *
 * All five exist from day one so switching organisations and printable parts on
 * later is a code change rather than a migration. Only the three in SAVE_SLUGS
 * are live — see that constant.
 */
export type SaveEntityType =
  | 'tutorial'
  | 'toy'
  | 'challenge'
  | 'organisation'
  | 'printable_part'

/**
 * The live save types, keyed by their URL segment.
 *
 * This is the single place that decides which types work. The API 404s on a
 * slug that is not a key here, and so does /dashboard/saved/[type] — one
 * missing key produces both behaviours, which is why it lives here rather than
 * being written twice and drifting.
 *
 * Plural in the URL, singular in the enum: a column value describing one row
 * should be singular, and a route listing many should not be.
 */
export const SAVE_SLUGS = {
  tutorials: 'tutorial',
  toys: 'toy',
  challenges: 'challenge',
} as const satisfies Record<string, SaveEntityType>

export type SaveSlug = keyof typeof SAVE_SLUGS

/** GET /api/saves/ids — every saved id the caller has, grouped by slug. */
export type SavedIds = Record<SaveSlug, string[]>
