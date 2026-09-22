// The internal fit-profile derivation behind both mobile's ability-screen.tsx
// quiz and the web child-survey-form.tsx quiz. Runtime values, not just types —
// this package is consumed as raw TypeScript, so that is safe.
export * from './derive-fit-profile'
export * from './nav-model'
// Named, not `export *`: the api runs this package through tsx as CommonJS,
// and Node's CJS export lexer cannot see esbuild's `__reExport` — the two
// lines above export nothing at runtime there. Named re-exports do.
export { contributorBadges } from './contributor-badges'
export type { ContributorBadge, ContributorBadgeInput } from './contributor-badges'
import type { ContributorBadge } from './contributor-badges'

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

/**
 * How many photos a toy or a guide may carry. One number for four enforcers —
 * the api's 400, both editors' "Add photo" button, and 053's check constraint
 * on each table — so the cap cannot say five in one place and six in another.
 */
export const MAX_PHOTOS = 5

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
  /** Up to MAX_PHOTOS, in display order. The first is the cover. */
  photo_urls: string[]
  /** Which of photo_urls shows the accessibility switch. A switch-adapted toy
   *  cannot be published until one is named; the database enforces that this
   *  is a member of photo_urls. */
  switch_photo_url: string | null
  /** Generated from photo_urls[1] by the database (053). Read-only — a write
   *  naming this column is rejected, so set photo_urls instead. */
  cover_photo_url: string | null
  status: 'draft' | 'published'
  offer_type: OfferType | null
  created_at: string
  updated_at: string
  /** PostgREST computed fields (073), the owner's "How it is doing" tiles.
   *  Present only when a select names them — GET /api/toys does, nothing
   *  public ever does. */
  save_count?: number
  request_count?: number
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

/**
 * What the transaction is about.
 *
 * `build` is 057 and `print` is 058: a family asking a maker to build them an
 * adapted toy from a published guide, and a family asking somebody's printer
 * for the printed parts of one. Each is the same record as a donation or an
 * exchange — two parties, a thread, an accept, two handover codes — with a
 * different subject and its own middle, so they live on the same table rather
 * than forking all of that to gain a different subject line.
 */
export type ToyTransactionType = 'donation' | 'exchange' | 'build' | 'print'
export type ToyTransactionStatus = 'requested' | 'accepted' | 'rejected' | 'withdrawn' | 'completed'

/**
 * A cost two parties agreed between themselves on an exchange. 055.
 *
 * SPLAT never handles the money — the dashboard panel says so in as many words
 * — so this is a record rather than a payment. `settled_at` means somebody said
 * it was paid and `settled_by` says which of them, which is the most the
 * platform can honestly claim to know. Either party may settle, because either
 * may be the one who was paid.
 */
export interface ExchangeCost {
  id: string
  transaction_id: string
  /** In the words the two of them used. Rendered verbatim. */
  description: string
  /**
   * Integer cents, always positive. Never a float — a rounding error in a
   * number two families agreed between them is an argument, not a display bug.
   * A refund is the line being settled or removed, not a negative amount.
   */
  amount_cents: number
  payer_id: string
  payee_id: string
  /**
   * Whether the payer is being asked for this. False means the payee absorbed
   * it: the line still shows, at $0.00 to the payer, because the point is that
   * they are not being asked. Only claimed lines count toward a total.
   */
  claiming: boolean
  settled_at: string | null
  settled_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

/** Cents to the string the panel shows. Money formatting in exactly one place. */
export function formatCents(cents: number, currency = 'AUD', locale = 'en-AU'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100)
}

/**
 * How one exchange was settled. 056, one row per transaction.
 *
 * Separate from `exchange_costs` because these are properties of the settlement
 * rather than of a line: which of the two wrote the note, the receipt, and how
 * the money actually moved. Kept off `toy_transactions`, which otherwise knows
 * nothing about money.
 */
export interface ExchangeSettlement {
  transaction_id: string
  /** Rendered as a quote with a byline, which is why the author is stored. */
  note: string | null
  note_by: string | null
  /** A storage path in the private `exchange-receipts` bucket, never a URL. */
  receipt_path: string | null
  /** Free text: the artboard shows only "Bank transfer", and the rest of the
   *  vocabulary is not known yet. Narrow it when it is. */
  method: string | null
  updated_at: string
  updated_by: string
}

export interface ToyTransaction {
  id: string
  /** Null on a build: there is no toy yet, the maker makes one (057). */
  toy_id: string | null
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
  /** The guide being built. Set on a build and null otherwise (057). */
  tutorial_id: string | null
  /** What the family asked for, in their words. Builds only. */
  build_brief: string | null
  /** How far the family can travel to meet a maker. The Makers wanted board
   *  filters on it, and it is the FAMILY's limit — a maker's own range is
   *  never stored (064). */
  travel_km: number | null
  urgency: string | null
  /** "Leo, 3" — free text, not a child_profiles reference. A child profile
   *  carries clinical scores and measurements, and none of that belongs on a
   *  public board (064). */
  child_label: string | null
  /** Suburb only. "Family in Newtown" is the whole of what the board shows. */
  requester_suburb: string | null
  /** Whether the family already owns the toy, which changes what a maker is
   *  agreeing to: buy one, or adapt theirs. */
  family_has_toy: boolean
  /** A storage path in the private `build-shots` bucket, never a URL. Set once
   *  the maker posts a photo of the finished build working. */
  working_photo_url: string | null
  /** When the family accepted that shot. The handover cannot start before it. */
  work_approved_at: string | null
  /** The machine a print job is on. Set on a print sent to a printer, and null
   *  on one a build day's host is printing — exactly one of this and
   *  `event_id` is set on a print, and both are null on every other type. */
  printer_id: string | null
  /** The build day whose host is printing these, when that is who was asked
   *  rather than a machine (061). */
  event_id: string | null
  /** How many sets of parts. Set only on an event's print request: sets are an
   *  event's unit of work, and a printer takes the job whole. */
  part_sets: number | null
  /** What the requester said about the print. The printer sees this and their
   *  suburb, and nothing else about them. */
  print_note: string | null
  printing_started_at: string | null
  /** Ready to collect. Never set without `ready_photo_url` — the constraint is
   *  in 058, and the point is that nobody travels for a part on somebody's
   *  word alone. */
  ready_at: string | null
  ready_photo_url: string | null
  /** Why a request was declined. Stored rather than left to the thread: a
   *  reason that exists only as a chat message cannot be shown on the list row
   *  that needs it. */
  decline_reason: string | null
  created_at: string
  updated_at: string
}

/**
 * A 3D printer somebody offers to other families. 058.
 *
 * Bed size and materials are the fit check a print request runs before it is
 * offered to a machine. Availability is two separate facts on purpose: the
 * toggle is the deliberate act, the capacity is the honest one, and a machine
 * with three jobs on it is full whatever the toggle says.
 */
export interface Printer {
  id: string
  /** A person's machine or an organisation's, never both — the same XOR 033
   *  gave toys. */
  owner_id: string | null
  owner_org_id: string | null
  name: string
  materials: string[]
  /** Millimetres. */
  bed_x: number
  bed_y: number
  bed_z: number
  /** Suburb and state only. The street address is the pickup point and is
   *  copied onto the job at accept, exactly as 028 does for a toy handover. */
  suburb: string | null
  state: string | null
  accepting: boolean
  capacity: number
  notes: string | null
  /** Integer cents per gram a family is asked to cover (070). NULL is the
   *  off state: free, parts only. SPLAT records the figure and never moves it. */
  filament_cents_per_g: number | null
  /** The "why these costs" a requester reads word for word. */
  rate_note: string | null
  created_at: string
  updated_at: string
}

export interface PrinterWithOwner extends Printer {
  owner_name: string | null
  org_name: string | null
  /** Accepted jobs on this machine right now, against its capacity. */
  open_jobs: number
}

/** The materials a printer can declare. Presentational, so it lives here
 *  rather than in a check constraint (037's rule about `contact_prefs`). */
export const PRINT_MATERIALS = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'Nylon'] as const
export type PrintMaterial = (typeof PRINT_MATERIALS)[number]

/**
 * Which step of a print job a record is at, derived from what the row stores.
 *
 * As with `buildStep`, 058 added no status members: `printing` and `ready` as
 * statuses would mean every `status = 'accepted'` predicate in the API stops
 * matching a job that is on the bed.
 */
export type PrintStep = 'asked' | 'accepted' | 'printing' | 'ready' | 'closed'

export function printStep(
  tx: Pick<ToyTransaction, 'status' | 'printing_started_at' | 'ready_at'>
): PrintStep {
  if (tx.status === 'completed') return 'closed'
  if (tx.status !== 'accepted') return 'asked'
  if (!tx.printing_started_at) return 'accepted'
  if (!tx.ready_at) return 'printing'
  return 'ready'
}

/**
 * Which step of a build a record is at, derived from what the row stores.
 *
 * 057 deliberately added no status members: `built` and `approved` as statuses
 * would mean every `status = 'accepted'` predicate in the API silently stops
 * matching a live build. The extra stage is two timestamps instead, and this is
 * the one place that reads them.
 */
export type BuildStep = 'asked' | 'claimed' | 'shot' | 'approved' | 'handover' | 'closed'

export function buildStep(
  tx: Pick<
    ToyTransaction,
    'status' | 'working_photo_url' | 'work_approved_at' | 'owner_confirmed_at' | 'requester_confirmed_at'
  >
): BuildStep {
  if (tx.status === 'completed') return 'closed'
  if (tx.status === 'requested') return 'asked'
  // rejected and withdrawn stop where they stopped; the rail decides where that
  // was, and it is not a step of its own.
  if (tx.status !== 'accepted') return 'asked'
  if (!tx.working_photo_url) return 'claimed'
  if (!tx.work_approved_at) return 'shot'
  return 'handover'
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
  /** The guide being built, on a build (057). Null on a donation or exchange. */
  tutorial_title: string | null
  /** Null when the toy has none. Readable by both parties for good: 025's
   *  "Transaction parties can view each other's toy" policy outlives the
   *  handoff, which is what lets a giver still see what they gave. */
  toy_cover_photo_url: string | null
  offered_toy_name: string | null
  offered_toy_cover_photo_url: string | null
  other_party_name: string
  /** The family who asked. Same value as `other_party_name` when the viewer is
   *  the owner side, and named for what it is so a queue that only ever shows
   *  one direction does not have to explain itself. */
  requester_name: string | null
  /** The organisation the viewer is answering for, when they are its leader.
   *  Null for a personal handoff and for the family on the other side. */
  acting_for_org_name: string | null
  blocked_by_rival_accept: boolean
  /** Newest message in the thread, for the list preview. Null before any exists. */
  last_message: ToyTransactionMessagePreview | null
  /** The parts a print job asks for (068), for the printer's queue card. Only
   *  a print carries any; every other kind sends an empty list. */
  print_files?: PrintJobFile[]
}

/**
 * What the record is about, in the words a person would use for it.
 *
 * A build's subject is the guide, not a toy — `toy_name` is empty on one. Every
 * list row, card title and page heading asks the same question, so it is
 * answered once here rather than with a ternary at each of them.
 */
export function subjectName(
  tx: Pick<ToyTransactionSummary, 'type' | 'toy_name' | 'tutorial_title'>
): string {
  if (tx.type === 'build') return tx.tutorial_title ?? 'A build'
  if (tx.type === 'print') return tx.tutorial_title ? `${tx.tutorial_title} — parts` : 'A print job'
  return tx.toy_name
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
    | 'working_photo_url'
    | 'work_approved_at'
    | 'printing_started_at'
    | 'ready_at'
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
    /*
     * A build has a stage before the handover, and it alternates sides: the
     * maker owes a working shot, then the family owes an approval. Falling
     * through to the confirm rule would tell both of them to confirm a handover
     * that cannot happen yet.
     */
    if (tx.type === 'build') {
      if (!tx.working_photo_url) return isOwner
      if (!tx.work_approved_at) return !isOwner
    }
    /*
     * A print job's middle is both owed by the printer: start it, then say it
     * is ready with a photo. Only once it is ready does collecting it become
     * something the requester can do.
     */
    if (tx.type === 'print' && !tx.ready_at) return isOwner
    // Donations are confirmed by the owner alone; exchanges and builds need
    // both parties.
    const confirms = tx.type !== 'donation' || isOwner
    const alreadyConfirmed = isOwner ? tx.owner_confirmed_at : tx.requester_confirmed_at
    return confirms && alreadyConfirmed === null
  }

  return false
}

/** The copy the Exchanges badge is counting, shown on the card itself. */
export function actionLabel(
  tx: Pick<
    ToyTransaction,
    'status' | 'type' | 'working_photo_url' | 'work_approved_at' | 'printing_started_at' | 'ready_at'
  >,
  isOwner = false
): string {
  if (tx.status === 'requested') {
    if (tx.type === 'build') return 'Waiting on you — take it on or decline'
    if (tx.type === 'print') return 'Waiting on you — take the job or decline'
    return 'Waiting on you — accept or decline'
  }
  if (tx.type === 'print' && isOwner && !tx.printing_started_at) {
    return 'Waiting on you — start the print'
  }
  if (tx.type === 'print' && isOwner && !tx.ready_at) {
    return 'Waiting on you — mark it ready'
  }
  if (tx.type === 'build' && !tx.working_photo_url && isOwner) {
    return 'Waiting on you — post the working shot'
  }
  if (tx.type === 'build' && tx.working_photo_url && !tx.work_approved_at && !isOwner) {
    return 'Waiting on you — approve the working shot'
  }
  return 'Waiting on you — confirm the handoff'
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
    // A build has no toy row (057): the maker made the thing, so there is
    // nothing in anyone's library that stopped being theirs. It belongs on the
    // exchange record, not on "toys I gave away".
    if (!tx.toy_id) continue

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
  /** The guide being built, on a build (057). Null on a donation or exchange. */
  tutorial_title: string | null
  /** The machine a print job is on, and where it is. Null on every other kind. */
  printer: Pick<Printer, 'id' | 'name' | 'suburb' | 'state' | 'materials'> | null
  /** The parts a print job asks for (058), flattened out of the join. */
  print_files: PrintJobFile[]
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

/** How far along a design is, declared by its author and worn as a badge.
 *  Only 'complete' items appear in the default public library listing — the
 *  practical control that stops an untested design reaching a child. */
export type TutorialMaturity = 'concept' | 'prototype' | 'in_progress' | 'complete'

export const MATURITY_LABEL: Record<TutorialMaturity, string> = {
  concept: 'Concept',
  prototype: 'Prototype',
  in_progress: 'In progress',
  complete: 'Complete',
}

/** The safety checklist a contributor affirms before a tutorial can be
 *  submitted for review, and the reviewer checks against. One copy, shown on
 *  web and mobile submission and on the admin review screen. */
export const SAFETY_CHECKLIST: readonly string[] = [
  'Any button or coin cell sits behind a compartment that needs a tool to open',
  'No small parts that could choke a child of the intended age',
  'No sharp edges or pinch points',
  'Materials are non-toxic and cleanable — children mouth these',
  'No mains voltage anywhere in the design',
  'Cords and straps checked for strangulation risk',
]
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
  /** 059. Everything below is what the public profile draws and the profile
   *  editor writes. All of it is public by design — the street address stays on
   *  the pickup columns, which 033 deliberately keeps off the public grant. */
  about?: string | null
  suburb?: string | null
  state?: string | null
  capabilities?: string[]
  contact_email?: string | null
  contact_phone?: string | null
  website_url?: string | null
  /** The rates families are quoted, in the organisation's own words. Free text
   *  because a structured price list would be a claim SPLAT cannot stand behind. */
  rate_note?: string | null
  recycling_materials?: string[]
  recycling_note?: string | null
}

/** What an organisation does, shown as chips. Presentational, so it lives here
 *  rather than in a check constraint (037's rule about `contact_prefs`). */
export const ORG_CAPABILITIES = [
  'Backs guides',
  'Holds toys',
  'Builds adaptations',
  'Has a printer',
  'Takes recycling',
  'Runs build days',
] as const
export type OrgCapability = (typeof ORG_CAPABILITIES)[number]

export type OrgPublishStatus = 'draft' | 'published'

/** The four kinds the publish form offers as radios, with the sentence each
 *  one carries there. 061. */
export const EVENT_KINDS = {
  build_day: 'Toys adapted on the day',
  workshop: 'Teach one thing, in person or online',
  open_day: 'Come and see the library or the space',
  print_day: 'Clear the print queue together',
} as const
export type EventKind = keyof typeof EVENT_KINDS

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  build_day: 'Build day',
  workshop: 'Workshop',
  open_day: 'Open day',
  print_day: 'Print day',
}

/** The state filter on /get-involved/events, and the publish form's dropdown. */
export const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const
export type AuState = (typeof AU_STATES)[number]

/** What a host can have out on the benches. 061. */
export const EVENT_TOOLS = [
  'Soldering irons',
  'Drill',
  'Hot glue',
  'Multimeter',
  'Screwdrivers',
  '3D printer on site',
] as const

/** 059, widened by 061. An event an organisation has published. No review, so
 *  the leader terms carry the risk — which is why the editor restates them at
 *  the foot. */
export interface OrgEvent {
  id: string
  org_id: string
  kind: EventKind
  title: string
  summary: string | null
  starts_at: string
  ends_at: string | null
  format: 'in_person' | 'online'
  /** Venue and street, as the publish form labels it. Set on an in-person
   *  event; null on an online one. The constraint is 059's. */
  location: string | null
  /** Their own columns rather than parsed back out of `location`, because the
   *  public list filters on state. Same split printers use. */
  suburb: string | null
  state: AuState | null
  /** Set on an online event; never public until somebody has RSVPed. */
  online_url: string | null
  audience: string | null
  description: string | null
  what_to_bring: string | null
  tools: string[]
  /** Null means no limit — the form's "Seats (blank = no limit)". */
  capacity: number | null
  prints_parts: boolean
  part_sets_max: number | null
  accessibility_note: string | null
  /** 069. What the host asks a family to cover, in cents. Null or 0 is free
   *  and the public pages draw no cost block at all. SPLAT never takes the
   *  payment; the register form says so before anyone confirms. */
  cost_cents: number | null
  /** The breakdown, in the host's own words. ≤500 chars. */
  cost_note: string | null
  photo_urls: string[]
  status: OrgPublishStatus
  /** Two separate withdrawals. Closing registrations leaves the event on the
   *  public list with its date intact; cancelling takes it off. */
  registrations_closed_at: string | null
  cancelled_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

/** The five answer shapes the publish form offers. 061. */
export const ANSWER_TYPES = {
  short: 'Short answer',
  paragraph: 'Paragraph',
  number: 'Number',
  choice: 'Choose one',
  boolean: 'Yes / no',
} as const
export type AnswerType = keyof typeof ANSWER_TYPES

/**
 * A question the organiser added to an event's registration form.
 *
 * Name and email are NOT rows here — they are columns on the registration,
 * because every event asks them and a question that cannot be removed is not a
 * question.
 */
export interface OrgEventQuestion {
  id: string
  event_id: string
  position: number
  prompt: string
  answer_type: AnswerType
  required: boolean
  /** Only 'choice' uses these. */
  options: string[]
}

/**
 * Somebody coming to an event.
 *
 * `name` and `email` are copied onto the row rather than read off the profile:
 * a family books under whichever name the host should call out on the day.
 * `answers` is keyed by question id.
 *
 * Never public. The artboard: "Answers are shown to leaders only."
 */
export interface OrgEventRegistration {
  id: string
  event_id: string
  user_id: string
  name: string
  email: string
  answers: Record<string, string | number | boolean>
  created_at: string
  cancelled_at: string | null
}

/** One row on /get-involved/events, with the numbers the card shows. */
export interface EventListItem extends OrgEvent {
  org_name: string
  going_count: number
  /** Null when the event has no capacity. */
  seats_left: number | null
  /** Whether the viewer has said they are going. Always false for a guest. */
  viewer_going: boolean
  /** Whether the event asks anything beyond name and email, which decides
   *  whether "I'm going" can be one tap or has to open the form. */
  has_questions: boolean
}

/**
 * The four the publish form offers, with the sentence each carries there.
 *
 * 059's vocabulary was delivery / build_day / partnership / other, which
 * described what HAPPENED. 062 replaced it with these, which describe WHOSE
 * VOICE it is — what a reader actually chooses by. A delivery and a build day
 * both read as a family story when the family is the one telling it.
 */
export const STORY_KINDS = {
  family: 'What changed for one child, in the family’s words',
  maker: 'What you built, what you learned',
  org_update: 'A milestone, a new service, a thank-you',
  announcement: 'Something families should know about',
} as const
export type StoryKind = keyof typeof STORY_KINDS

export const STORY_KIND_LABEL: Record<StoryKind, string> = {
  family: 'Family story',
  maker: 'Maker story',
  org_update: 'Organisation update',
  // Not "Announcement": the list filters by who is speaking, and what a reader
  // wants to know about this one is that it is the platform rather than a
  // therapy service.
  announcement: 'From SPLAT',
}

/** 059, widened by 062. A story an organisation — or SPLAT — has published. */
export interface OrgStory {
  id: string
  /** Null on an announcement, which speaks for SPLAT and has no organisation
   *  behind it. A story with no org must be an announcement (062). */
  org_id: string | null
  kind: StoryKind
  title: string
  summary: string
  body: string
  byline: string
  /** Publishing is refused without it — a check constraint, not a checkbox. */
  consent_confirmed: boolean
  photo_urls: string[]
  /** The one slot at the top of /about/stories. Not a rank. */
  featured: boolean
  pull_quote: string | null
  /** Never null when there is a quote: an unattributed one reads as the
   *  platform's voice put in a family's mouth (062). */
  pull_quote_by: string | null
  /** The one link back into the product. */
  link_tutorial_id: string | null
  status: OrgPublishStatus
  /** When it went public, which is not when the row was written. */
  published_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

/** One row on /about/stories, with what the card shows beyond the story. */
export interface StoryListItem extends OrgStory {
  org_name: string | null
  /** Rounded up from the body's word count at 200 wpm. Never stored: it is a
   *  property of the text, and a stored copy is one more thing to drift. */
  read_minutes: number
}

/**
 * Reading time in whole minutes, at 200 words a minute, never less than one.
 *
 * Two callers — the public card and the publish form's live counter — so it is
 * here rather than in either of them, and the number a leader sees while
 * writing is the number a reader is shown.
 */
export function readMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

/**
 * The seven lines a contributor ticks before a drop-off, and the version they
 * ticked.
 *
 * Versioned rather than free-standing because a contributor who declared "no
 * composites, nothing painted" in September has not agreed to whatever the list
 * says in March — and a dispute at the door is exactly the moment somebody
 * needs to know which wording was on screen. Bump the version whenever a line
 * changes; 063 stores it on the row.
 *
 * All seven are required. The reason is on the public page and worth repeating
 * wherever this is rendered: one contaminated bag can ruin a whole extruder run.
 */
export const DECLARATION_VERSION = 'v1-2026-09'

export const RECYCLING_DECLARATION = [
  'Clean and dry, no food residue',
  'Labels and adhesive removed',
  'Sorted by polymer — PLA, PETG, ABS or PP',
  'No composites, nothing painted or coated',
  'Nothing smaller than a thumbnail',
  'No unknown plastics — if it is unmarked, leave it out',
  'Photographed before drop-off',
] as const

/** Two kilos, so a machine run is worth firing up. Named once, enforced twice. */
export const MIN_DROPOFF_GRAMS = 2000

/**
 * What a drop-off is worth as filament, roughly.
 *
 * About three quarters of what comes in survives shredding and extrusion. This
 * is an ESTIMATE and every caller says so: the credit follows the weight the
 * organisation records at the door, never this number.
 */
export function estimatedCreditGrams(grams: number): number {
  return Math.floor(grams * 0.75)
}

export type DropoffStatus = 'booked' | 'received' | 'declined' | 'cancelled'

/**
 * 059. Waste plastic booked in to an organisation.
 *
 * Grams throughout, integer, for 055's reason about money: a rounding error in
 * a number two parties agreed between them is an argument rather than a display
 * bug. `estimated_grams` is the contributor's word; `weighed_grams` is the
 * organisation's, and `credit_grams` is what that is worth as filament — minted
 * at the door and never by the contributor.
 */
export interface RecyclingDropoff {
  id: string
  org_id: string
  contributor_id: string
  material: string
  estimated_grams: number
  condition_declared: boolean
  /** Which wording of RECYCLING_DECLARATION was ticked (063). Null on rows
   *  written before the seven-line list existed. */
  declaration_version: string | null
  /** A storage path in the private `recycling-photos` bucket, never a URL. */
  photo_url: string | null
  note: string | null
  status: DropoffStatus
  weighed_grams: number | null
  credit_grams: number | null
  decided_by: string | null
  created_at: string
  updated_at: string
}

export type OrgRequestStatus = 'pending' | 'approved' | 'declined'

/**
 * 060. Somebody asking for an organisation to exist.
 *
 * Leadership is granted by an admin and never self-started — that is the trust
 * model, and this row is how the conversation starts. Approving it creates the
 * organisation and appoints the requester, in one transaction, because an
 * approval that only flips a status leaves an admin two more things to remember.
 */
export interface OrganizationRequest {
  id: string
  requester_id: string
  org_name: string
  what_they_do: string
  /** How an admin can check the requester actually works there. */
  verification: string
  status: OrgRequestStatus
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  /** What approving it created. Null while pending or declined. */
  organization_id: string | null
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
  | 'tutorial_thanked'

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
  tutorial_thanked: 'tutorials',
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
  /** 072: the public profile's About paragraph (≤600 chars) and the one guide
   *  the contributor would hand a first-timer. Both optional until every
   *  reader of the row has migrated. */
  bio?: string | null
  featured_tutorial_id?: string | null
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

/**
 * The editor's "About how long does it take?" choices, in minutes. A select
 * rather than a free number so every stored value formats cleanly. Hands-on
 * time only — printing is excluded, and the editor says so.
 */
export const BUILD_TIME_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 240] as const

/** 20 → "20 min", 60 → "1 h", 90 → "1.5 h", 100 → "1.7 h" — the board's format. */
export function formatBuildTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  return `${Math.round((minutes / 60) * 10) / 10} h`
}

/** "Age 3–7" as the board writes it (en dash); null when neither end is set,
 *  so a meta line can filter it out like any other absent fact. */
export function formatAgeRange(min: number | null | undefined, max: number | null | undefined): string | null {
  if (min == null && max == null) return null
  if (min == null) return `Up to age ${max}`
  if (max == null) return `Age ${min}+`
  return min === max ? `Age ${min}` : `Age ${min}–${max}`
}

export interface Tutorial {
  id: string
  title: string
  description: string | null
  difficulty: Difficulty
  kind: TutorialKind
  status: TutorialStatus
  maturity: TutorialMaturity
  /** When the author affirmed SAFETY_CHECKLIST; null until they have, and a
   *  draft cannot be submitted for review while it is null. */
  safety_declared_at: string | null
  /** Storage object path in `tutorial-pdfs` (`<id>/tutorial.pdf`), not a URL — served via /files/tutorial-pdfs/<path>. Null until uploaded. */
  tutorial_pdf_url: string | null
  /** Hands-on minutes, printing excluded. Null only on a draft: the API
   *  refuses to submit a guide for review without it (066). */
  build_minutes: number | null
  /** The ages the guide is written for, whole years 0–18 (071). Both nullable
   *  — a description, not a submit gate — and optional only so the fixtures
   *  that predate them need not name them; every row select returns both.
   *  formatAgeRange() draws them. */
  age_min?: number | null
  age_max?: number | null
  /** PostgREST computed fields (066). Present only when a select names them —
   *  the public list and detail routes do. */
  thanks_count?: number
  has_stl?: boolean
  /** Up to MAX_PHOTOS, in display order. The first is the cover. */
  photo_urls: string[]
  /** Generated from photo_urls[1] by the database (053). Read-only — a write
   *  naming this column is rejected, so set photo_urls instead. */
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

/** What the printers directory lists (058) and an STL row may name (068). */
export const STL_MATERIALS = ['PLA', 'PETG', 'TPU', 'ABS'] as const
export type StlMaterial = (typeof STL_MATERIALS)[number]

export interface StlFile {
  id: string
  tutorial_id: string
  filename: string
  /** Storage object path in `stl-files` (`<tutorial id>/<filename>`), not a URL — served via /files/stl-files/<path>. */
  file_url: string
  /** Per-copy print settings as the author sliced them (068). Null on rows
   *  that predate them or where the author left them blank; optional because
   *  the mobile app's fixtures were built before the columns existed. */
  print_minutes?: number | null
  filament_grams?: number | null
  material?: StlMaterial | null
}

/** One part on a print job: the STL row with how many copies were asked for. */
export type PrintJobFile = Pick<
  StlFile,
  'id' | 'filename' | 'print_minutes' | 'filament_grams' | 'material'
> & { quantity: number }

/** One row of tutorial_recommendations with its target embedded. `status`
 *  rides along on the contributor-facing payload so the editor can badge a
 *  target that is not yet public; the public detail route drops such rows
 *  entirely, the way it drops backing that was never accepted. */
export interface Recommendation {
  position: number
  tutorials: Pick<Tutorial, 'id' | 'title' | 'kind' | 'difficulty' | 'toy_photo_url' | 'status' | 'maturity'>
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
  /** Completed handoffs per month, oldest first, one entry per month of the
   *  window whether or not anything was delivered in it. `month` is
   *  `YYYY-MM` in Australia/Sydney, the zone every date on the site is
   *  written in. */
  deliveriesByMonth: Array<{ month: string; n: number }>
}

export interface ContributorProfile {
  id: string
  name: string
  tutorials: Tutorial[]
  toysShared: Toy[]
  toysDelivered: Toy[]
  /** 072. `featured` is one of `tutorials` (re-checked on read, so a guide
   *  that lost approval is not featured); `thanks` sums thanks_count over
   *  them; `badges` is contributorBadges() run server-side. Optional so a
   *  mobile build against the older endpoint still type-checks. */
  bio?: string | null
  featured?: Tutorial | null
  thanks?: number
  badges?: ContributorBadge[]
  created_at?: string
}

export interface OrgPublicProfile {
  id: string
  name: string
  status: string
  tutorialsBacked: Tutorial[]
  tutorialsApproved: Tutorial[]
  toysShared: Toy[]
  toysDelivered: Toy[]
  /** 059's profile fields, all public by design. The street address is not
   *  among them — it lives on the pickup columns, which 033 keeps off the
   *  public grant. */
  description?: string | null
  about?: string | null
  suburb?: string | null
  state?: string | null
  capabilities?: string[]
  contact_email?: string | null
  contact_phone?: string | null
  website_url?: string | null
  rate_note?: string | null
  recycling_materials?: string[]
  recycling_note?: string | null
  /** Published only. An online event's joining link is deliberately absent —
   *  "online links are never public". */
  events?: Array<
    Pick<
      OrgEvent,
      'id' | 'org_id' | 'title' | 'summary' | 'starts_at' | 'ends_at' | 'format' | 'location' | 'audience' | 'status'
    >
  >
  stories?: Array<
    Pick<OrgStory, 'id' | 'org_id' | 'kind' | 'title' | 'summary' | 'byline' | 'status' | 'created_at'>
  >
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
  // Switched on 2026-09-17, which is exactly the code change the note above
  // promised: the enum has carried 'organisation' since day one, so this needed
  // no migration. The artboard draws a Saved organisations screen and the save
  // control already sits on the public organisation page.
  organisations: 'organisation',
} as const satisfies Record<string, SaveEntityType>

export type SaveSlug = keyof typeof SAVE_SLUGS

/** GET /api/saves/ids — every saved id the caller has, grouped by slug. */
export type SavedIds = Record<SaveSlug, string[]>
