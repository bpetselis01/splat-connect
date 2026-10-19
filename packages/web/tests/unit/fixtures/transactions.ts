import type { ToyTransactionDetail, ToyTransactionSummary } from '@splat-connect/types'

export function summary(overrides: Partial<ToyTransactionSummary> = {}): ToyTransactionSummary {
  return {
    id: 'tx-1', toy_id: 'toy-1', offered_toy_id: null, type: 'donation', status: 'requested',
    requester_id: 'requester-1', owner_id: 'owner-1', owner_org_id: null, owner_code: null, requester_code: null,
    owner_confirmed_at: null, requester_confirmed_at: null, tutorial_id: null, build_brief: null, travel_km: null,
    urgency: null, requester_suburb: null, family_has_toy: false, working_photo_url: null, work_approved_at: null,
    printer_id: null, event_id: null, part_sets: null, print_note: null, print_group_id: null, print_colour: null,
    print_delivery: null, printing_started_at: null, ready_at: null, ready_photo_url: null, decline_reason: null,
    pickup_line1: null, pickup_suburb: null, pickup_state: null, pickup_postcode: null, pickup_instructions: null,
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', toy_name: 'Fire truck',
    tutorial_title: null, toy_cover_photo_url: null, offered_toy_name: null, offered_toy_cover_photo_url: null,
    other_party_name: 'Ash', requester_name: null, acting_for_org_name: null, blocked_by_rival_accept: false,
    last_message: null,
    ...overrides,
  } as ToyTransactionSummary
}

export function detail(overrides: Partial<ToyTransactionDetail> = {}): ToyTransactionDetail {
  return {
    ...summary(),
    printer: null, print_files: [], print_group_size: null, owner_name: 'Sam', requester_name: 'Ash',
    received_toy: null,
    messages: [{ id: 'm1', transaction_id: 'tx-1', sender_id: 'requester-1', kind: 'system', body: 'Requested this toy for donation.', created_at: '2026-08-01T00:00:00Z' }],
    ...overrides,
  } as ToyTransactionDetail
}
