// packages/mobile/lib/builds.ts
// The rules behind the build thread and the Makers wanted board, kept pure so
// they can be tested without rendering a screen.
//
// A build is a toy transaction with a guide for a subject (057). Its extra
// stage — the maker posts a photo of it working, the family approves it — is
// two timestamps rather than two status members, so every answer here comes
// from buildStep() in @splat-connect/types plus the row's own columns. Copy is
// the board's (#build_thread) where it is generic and web's
// components/build-next-step.tsx where the board names its demo people.
import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
import type { BuildStep, ToyTransaction } from '@splat-connect/types'
import { buildStep, isOwnerSide } from '@splat-connect/types'
import { theme } from './theme'

type IconName = ComponentProps<typeof Ionicons>['name']

/** The one place a transaction decides which thread it opens in. */
export function threadHref(tx: Pick<ToyTransaction, 'id' | 'type'>): string {
  return tx.type === 'build' ? `/exchanges/build/${tx.id}` : `/exchanges/${tx.id}`
}

export type RailState = 'done' | 'now' | 'todo' | 'stop'

const RAIL = ['Asked', 'Claimed', 'Photo', 'Handover'] as const

// Which rail dot is current at each step. A posted but unapproved shot is
// still the Photo dot: it is not done until the family says so.
const RAIL_NOW: Record<BuildStep, number> = { asked: 1, claimed: 2, shot: 2, approved: 3, handover: 3, closed: 4 }

type RailRow = Pick<
  ToyTransaction,
  'status' | 'working_photo_url' | 'work_approved_at' | 'owner_confirmed_at' | 'requester_confirmed_at'
>

/**
 * The board's four-dot rail. A withdrawn build records that somebody pulled
 * out but not when, so the stop is read off what survived the status being
 * overwritten — the same inference as web's lib/build-stages.ts: a photo
 * proves it got past Claimed, an approval or a confirmation past Photo.
 */
export function buildRail(tx: RailRow): { label: string; state: RailState }[] {
  let now: number
  let stopped = false
  if (tx.status === 'rejected' || tx.status === 'withdrawn') {
    stopped = true
    now =
      tx.status === 'rejected'
        ? 1
        : tx.work_approved_at || tx.owner_confirmed_at || tx.requester_confirmed_at
          ? 3
          : tx.working_photo_url
            ? 2
            : 1
  } else {
    now = RAIL_NOW[buildStep(tx)]
  }
  return RAIL.map((label, i) => ({
    label,
    state: i < now ? 'done' : i === now ? (stopped ? 'stop' : 'now') : 'todo',
  }))
}

type ActRow = Pick<
  ToyTransaction,
  | 'status'
  | 'requester_id'
  | 'owner_id'
  | 'owner_org_id'
  | 'owner_confirmed_at'
  | 'requester_confirmed_at'
  | 'working_photo_url'
  | 'work_approved_at'
>

/**
 * Who may do what, right now. Each flag is the API's own guard
 * (packages/api/src/routes/toy-transactions.ts) — a button the server would
 * refuse is worse than no button.
 */
export function buildControls(tx: ActRow, viewerId: string, ledOrgIds: readonly string[] = []) {
  const isMaker = isOwnerSide(tx, viewerId, ledOrgIds)
  const isFamily = tx.requester_id === viewerId
  const live = tx.status === 'requested' || tx.status === 'accepted'
  const unclaimed = tx.status === 'requested' && !tx.owner_id && !tx.owner_org_id
  const approved = tx.status === 'accepted' && Boolean(tx.work_approved_at)
  return {
    isMaker,
    isFamily,
    // Anybody but the family, on a request nobody has taken (POST /:id/claim).
    canClaim: unclaimed && !isFamily,
    // A request addressed to this maker by name: accept or decline, as any toy.
    canAnswer: tx.status === 'requested' && isMaker,
    // Reposting is allowed until the family approves; the API resets the
    // approval on a new photo, so after that it would undo their yes.
    canPostShot: isMaker && tx.status === 'accepted' && !tx.work_approved_at,
    canApprove: isFamily && tx.status === 'accepted' && Boolean(tx.working_photo_url) && !tx.work_approved_at,
    // Both sides hold a code and both confirm — the family's confirmation is
    // the only record the build arrived. Not before the shot is approved.
    showCode: approved && (isMaker || isFamily),
    confirmed: isMaker ? tx.owner_confirmed_at !== null : tx.requester_confirmed_at !== null,
    canMessage: live && (isMaker || isFamily),
    canWithdraw: live && (isMaker || isFamily),
  }
}

export interface BuildCard {
  tone: string
  icon: IconName
  kicker: string
  title: string
  body: string
}

const TONE = {
  waiting: theme.colors.apricotSoft,
  live: theme.colors.honeySoft,
  open: theme.colors.mintSoft,
  done: theme.colors.tone.mint.bg,
  closed: theme.colors.surfaceSunken,
}

/**
 * The tinted card under the rail: what this build is waiting for and who it is
 * waiting on. Its kicker doubles as the header's status pill, so the two can
 * never disagree.
 */
export function buildCard(
  tx: ActRow & Pick<ToyTransaction, 'travel_km'>,
  viewerId: string,
  otherName: string,
  ledOrgIds: readonly string[] = []
): BuildCard {
  const c = buildControls(tx, viewerId, ledOrgIds)

  if (tx.status === 'requested') {
    if (c.canClaim) {
      return { tone: TONE.open, icon: 'hand-left', kicker: 'Needs a maker', title: 'Not claimed yet', body: 'Read the brief below. Claiming is one tap when you are ready.' }
    }
    if (c.canAnswer) {
      return { tone: TONE.live, icon: 'hammer', kicker: 'Needs you', title: 'Take it on, or decline', body: 'Read the brief below. Taking it on gives you both a handover code.' }
    }
    if (!tx.owner_id && !tx.owner_org_id) {
      return {
        tone: TONE.waiting,
        icon: 'hourglass',
        kicker: 'Waiting',
        title: 'Waiting for a maker',
        body: tx.travel_km
          ? `On Makers wanted for makers within ${tx.travel_km} km. You will hear here the moment someone takes it on.`
          : 'On Makers wanted. You will hear here the moment someone takes it on.',
      }
    }
    return { tone: TONE.waiting, icon: 'hourglass', kicker: 'Waiting', title: 'Waiting for an answer', body: 'You will hear here the moment they answer. Nothing to do yet.' }
  }

  if (tx.status === 'accepted' && !tx.working_photo_url) {
    return c.isMaker
      ? { tone: TONE.live, icon: 'hammer', kicker: 'Your build', title: 'Build it, then post a working shot', body: 'The family approves the photo before anyone travels.' }
      : { tone: TONE.live, icon: 'hammer', kicker: 'Live', title: `${otherName || 'The maker'} is building it`, body: 'You will get a photo of it working before you arrange pickup.' }
  }

  if (tx.status === 'accepted' && !tx.work_approved_at) {
    return c.isMaker
      ? { tone: TONE.live, icon: 'hourglass', kicker: 'Waiting', title: 'Waiting for the family to approve', body: 'They check the photo against the guide.' }
      : { tone: TONE.waiting, icon: 'camera', kicker: 'Needs you', title: 'Check the working shot', body: 'Does it match the guide? Does the switch look right? Approve it and agree a place to meet.' }
  }

  if (tx.status === 'accepted') {
    return c.confirmed
      ? { tone: TONE.live, icon: 'hourglass', kicker: 'Waiting', title: `Waiting on ${otherName || 'them'} to confirm`, body: 'You have entered their code. The build closes once they enter yours.' }
      : { tone: TONE.waiting, icon: 'hourglass', kicker: 'Needs you', title: 'Arrange the handover', body: 'Agree a time and a public place in the thread. Swap codes when the toy changes hands — that is what closes the build.' }
  }

  if (tx.status === 'completed') {
    return { tone: TONE.done, icon: 'checkmark-circle', kicker: 'Handed over', title: 'Both of you confirmed', body: 'Closed and kept as a record. Say thanks in the thread if you like.' }
  }

  return {
    tone: TONE.closed,
    icon: 'close-circle',
    kicker: tx.status === 'rejected' ? 'Not taken on' : 'Withdrawn',
    title: tx.status === 'rejected' ? 'This one did not go ahead' : 'This request was withdrawn',
    body: 'Nothing was built. You can ask another maker, or the same one again.',
  }
}
