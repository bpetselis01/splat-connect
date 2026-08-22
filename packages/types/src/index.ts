// The MACS/BFMF estimator behind both mobile's ability-screen.tsx quiz and the
// web child-profile-form.tsx quiz. Runtime values, not just types — this
// package is consumed as raw TypeScript, so that is safe.
export * from './estimate-ability'

export type Role = 'admin' | 'contributor'

export interface ChildProfile {
  id: string
  parent_id: string
  // Optional: a parent may add a child without naming one. The UI falls back to
  // "Child N" by position — see packages/web/lib/child-label.ts.
  name: string | null
  age: number | null
  // Ability Profile
  primary_diagnosis: string | null
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
  archived_at: string | null
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
  offered_toy_name: string | null
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

/**
 * A flag against a participant or the idea's author, filed by the idea's
 * author or a current participant (041). Never selectable by anon or
 * authenticated — read through the service role (admin) only, so the
 * reported person can never see reason/resolution_note.
 */
export interface ToyIdeaReport {
  id: string
  idea_id: string
  reported_profile_id: string
  reported_by: string
  reason: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
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

export interface Tutorial {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  status: TutorialStatus
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
  file_url: string
}

// A tutorial with all its related information: the parts needed, tools needed,
// 3D files, and the people who created it.
// Note: tutorial_contributors REQUIRES the profiles field (makes it non-optional)
// so you always have the contributor's full info when viewing a complete tutorial
export interface TutorialWithDetails extends Tutorial {
  parts: Part[]
  tools: Tool[]
  stl_files: StlFile[]
  tutorial_contributors: (TutorialContributor & { profiles: Profile })[]
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
