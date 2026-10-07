import { type Page } from '@playwright/test'
import { adminClient, createContributor, createNotification, createPublishedToy, createTutorial, renameProfile, uniqueTitle } from './helpers'

/**
 * Hand a file to whichever picker the tapped button opened. The chooser wait
 * has to be armed before the click (see guides-authoring.spec.ts).
 */
export async function chooseFile(page: Page, button: string | RegExp | { testId: string }, file: string) {
  const chooser = page.waitForEvent('filechooser')
  const target =
    typeof button === 'object' && 'testId' in button
      ? page.getByTestId(button.testId)
      : page.getByRole('button', { name: button, exact: typeof button === 'string' })
  await target.click()
  await (await chooser).setFiles(file)
}

export const PDF_FIXTURE = 'tests/e2e/fixtures/test.pdf'
export const PHOTO_FIXTURE = 'tests/e2e/fixtures/test.jpg'

/** The id at the end of the current URL path segment after `marker`, e.g. '/tutorials/'. */
export function idAfter(page: Page, marker: string) {
  return (page.url().split(marker)[1] ?? '').split(/[/?#]/)[0]
}

/** A confirmed account that never accepted the contributor terms (the gate sends it to /terms). */
export async function createUserWithoutTerms() {
  const email = `noterms-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mobile-e2e.local`
  const password = 'Test1234!'
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: 'E2E No Terms' },
  })
  if (error || !data.user) throw new Error(`createUserWithoutTerms failed: ${error?.message}`)
  return { id: data.user.id, email, password }
}

/** One step with a photo URL set; addSteps() makes text-only steps. */
export async function addPhotoStep(tutorialId: string, fields: { title: string; body: string; photo_url: string }) {
  const { error } = await adminClient()
    .from('tutorial_steps')
    .insert({ tutorial_id: tutorialId, position: 1, ...fields })
  if (error) throw new Error(`addPhotoStep failed: ${error.message}`)
}

/**
 * A thread of one kind with one claimed cost line, so it shows in the payer's
 * Me money panel. Inserted straight through the service role: the subject of
 * these specs is the panel's link, not the thread's own flow.
 */
export async function seedMoneyThread(type: 'donation' | 'build' | 'print', description: string) {
  const admin = adminClient()
  const payer = await createContributor()
  const payee = await createContributor()
  await renameProfile(payee.id, uniqueTitle('E2E Payee'))
  let subject: Record<string, unknown>
  if (type === 'donation') {
    subject = { toy_id: await createPublishedToy(payee.id), owner_id: payee.id }
  } else {
    const guide = await createTutorial(payee.id, { title: uniqueTitle('E2E Money Guide') })
    if (type === 'build') {
      subject = { tutorial_id: guide, build_brief: 'Please make it chunky.', owner_id: payee.id }
    } else {
      const { data: machine, error: machineError } = await admin
        .from('printers')
        .insert({ owner_id: payee.id, name: uniqueTitle('E2E Machine'), materials: ['PETG'], bed_x: 220, bed_y: 220, bed_z: 220, accepting: true, capacity: 3 })
        .select('id')
        .single()
      if (machineError || !machine) throw new Error(`seedMoneyThread printer failed: ${machineError?.message}`)
      subject = { tutorial_id: guide, printer_id: machine.id, print_delivery: 'collect', print_colour: 'Any colour', owner_id: payee.id }
    }
  }
  const { data: tx, error } = await admin
    .from('toy_transactions')
    .insert({ type, status: 'requested', requester_id: payer.id, ...subject })
    .select('id')
    .single()
  if (error || !tx) throw new Error(`seedMoneyThread insert failed: ${error?.message}`)
  const { error: costError } = await admin.from('exchange_costs').insert({
    transaction_id: tx.id,
    description,
    amount_cents: 450,
    claiming: true,
    payer_id: payer.id,
    payee_id: payee.id,
    created_by: payee.id,
  })
  if (costError) throw new Error(`seedMoneyThread cost failed: ${costError.message}`)
  return { id: tx.id as string, payer, payee }
}

/**
 * An organisation pinned at a real postcode centroid (2300), with a drop-off
 * taking TPU only, so the map lists it as an organisation and as a drop-off.
 */
export async function seedMapOrg(name: string) {
  const { data, error } = await adminClient()
    .from('organizations')
    .insert({
      name,
      status: 'active',
      suburb: 'Mapville',
      state: 'NSW',
      pickup_suburb: 'Mapville',
      pickup_state: 'NSW',
      pickup_postcode: '2300',
      recycling_materials: ['TPU'],
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedMapOrg failed: ${error?.message}`)
  return data.id as string
}

/** A pending collaborator invite plus the inbox row that offers Accept and Decline. */
export async function seedCollaboratorInvite(tutorialId: string, tutorialTitle: string, inviteeId: string, inviterId: string) {
  const admin = adminClient()
  const { data, error } = await admin
    .from('tutorial_collaborator_invites')
    .insert({ tutorial_id: tutorialId, invited_profile_id: inviteeId, invited_by: inviterId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedCollaboratorInvite failed: ${error?.message}`)
  await createNotification(inviteeId, { type: 'collaborator_invited', tutorial_id: tutorialId, tutorial_title: tutorialTitle, actor_name: 'E2E Author' })
  return data.id as string
}

/** One row of a table by a single equality, or null. */
export async function rowWhere(table: string, column: string, value: string) {
  const { data, error } = await adminClient().from(table).select('*').eq(column, value).maybeSingle()
  if (error) throw new Error(`rowWhere ${table} failed: ${error.message}`)
  return data as Record<string, unknown> | null
}
