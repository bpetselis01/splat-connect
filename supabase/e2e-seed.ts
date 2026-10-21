// Fixture seeding shared by the web e2e suite, the mobile e2e suite and the
// device provisioner. Playwright-free on purpose: a plain Node script imports
// it, and e2e code imports nothing from components/.
import { createClient } from '@supabase/supabase-js'
import { AGREEMENT_VERSIONS, type AgreementType } from '@splat-connect/types'
import { LOCAL_SUPABASE_SERVICE_ROLE_KEY, LOCAL_SUPABASE_URL } from './local-dev-keys'

export const PASSWORD = 'Test1234!'

/** Service-role client for E2E fixture setup. */
export function adminClient(url = LOCAL_SUPABASE_URL, serviceRoleKey = LOCAL_SUPABASE_SERVICE_ROLE_KEY) {
  return createClient(url, serviceRoleKey)
}

/**
 * Unique per invocation even within the same millisecond. Parallel workers
 * collide on `Date.now()` alone, and a duplicated title makes one spec's
 * assertions match another's fixture.
 */
export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function uniqueEmail(prefix: string, domain = 'web-e2e.local') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${domain}`
}

/**
 * Provision a confirmed admin via the service role. The signup trigger defaults
 * new accounts to the contributor role, so the role is set explicitly here.
 */
export async function createAdmin() {
  const admin = adminClient()
  const email = uniqueEmail('admin')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Admin' },
  })
  if (error || !data.user) throw new Error(`Failed to create admin: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'admin', name: 'E2E Admin' })
  if (profileError) throw new Error(`Failed to set admin profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}

/**
 * Record a terms acceptance for a user, through the service role, at the
 * current version. Deliberately not folded into createContributor: the gate is
 * real behaviour, and hiding it in the fixture would make it untestable.
 */
export async function acceptTerms(userId: string, type: AgreementType = 'contributor_terms', db = adminClient()) {
  const { error } = await db
    .from('user_agreements')
    .insert({ user_id: userId, agreement_type: type, version: AGREEMENT_VERSIONS[type] })
  if (error) throw new Error(`acceptTerms failed: ${error.message}`)
}

/** An active organisation. Returns its id. */
export async function createOrg(name: string = uniqueTitle('E2E Org')): Promise<string> {
  const { data, error } = await adminClient()
    .from('organizations')
    .insert({ name, status: 'active' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createOrg failed: ${error?.message}`)
  return data.id
}

/** A leader row, written once however many times it is asked for. */
export async function addLeader(orgId: string, userId: string) {
  const { error } = await adminClient()
    .from('org_leaders')
    .upsert({ org_id: orgId, user_id: userId }, { onConflict: 'org_id,user_id', ignoreDuplicates: true })
  if (error) throw new Error(`addLeader failed: ${error.message}`)
}

/**
 * An organisation led by this user with org-leader terms accepted at the
 * current version, which the review policies (007) check. Pass `orgId` to make
 * the user another leader of an existing organisation. Returns the org id.
 */
export async function makeLeader(userId: string, orgName?: string, orgId?: string): Promise<string> {
  const id = orgId ?? (await createOrg(orgName))
  await addLeader(id, userId)
  const admin = adminClient()
  const { data, error } = await admin
    .from('user_agreements')
    .select('id')
    .eq('user_id', userId)
    .eq('agreement_type', 'org_leader_terms')
    .eq('version', AGREEMENT_VERSIONS.org_leader_terms)
  if (error) throw new Error(`makeLeader terms lookup failed: ${error.message}`)
  if (!data.length) await acceptTerms(userId, 'org_leader_terms')
  return id
}

export type EventQuestion = {
  prompt: string
  answer_type: 'short' | 'paragraph' | 'number' | 'choice' | 'boolean'
  required?: boolean
  /** Only a 'choice' question carries options, and it must carry some. */
  options?: string[]
}

/** An in-person event 30 days out, straight into org_events. Returns its id. */
export async function createEvent(
  orgId: string,
  createdBy: string,
  overrides: Partial<{ title: string; status: 'draft' | 'published'; questions: EventQuestion[] }> & Record<string, unknown> = {}
): Promise<string> {
  const { questions = [], title, status, ...columns } = overrides
  const admin = adminClient()
  const { data, error } = await admin
    .from('org_events')
    .insert({
      org_id: orgId,
      created_by: createdBy,
      title: title ?? uniqueTitle('E2E Event'),
      status: status ?? 'draft',
      starts_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      format: 'in_person',
      location: 'E2E Hall, 1 Test St',
      suburb: 'Testville',
      state: 'NSW',
      audience: 'Anyone with a toy to adapt.',
      ...columns,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createEvent failed: ${error?.message}`)
  if (questions.length) {
    const { error: questionError } = await admin
      .from('org_event_questions')
      .insert(questions.map((q, i) => ({ event_id: data.id, position: i + 1, required: false, options: [], ...q })))
    if (questionError) throw new Error(`createEvent questions failed: ${questionError.message}`)
  }
  return data.id
}

/**
 * One notification, as the API's own handlers write them: the row carries the
 * subject id its COPY line and its link both read (idea_id, tutorial_id or
 * toy_transaction_id), never all three.
 */
export async function createNotification(
  recipientId: string,
  fields: {
    type: string
    actor_name?: string
    tutorial_id?: string
    tutorial_title?: string
    toy_transaction_id?: string
    toy_name?: string
    idea_id?: string
  }
): Promise<string> {
  const { data, error } = await adminClient()
    .from('notifications')
    .insert({ recipient_id: recipientId, actor_name: 'E2E Actor', ...fields })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createNotification failed: ${error?.message}`)
  return data.id
}

// Local Supabase's mail catcher. Specs read the real emailed code out of it
// rather than confirming through the admin API, so the template and the code
// screen are both under test.
const MAILPIT_PORT = 54324
const MAILPIT = `http://127.0.0.1:${MAILPIT_PORT}`

export class MailpitUnreachableError extends Error {
  constructor(cause: unknown) {
    super(`Mailpit is not answering on port ${MAILPIT_PORT} (${String(cause)}). Is local Supabase running?`)
    this.name = 'MailpitUnreachableError'
  }
}

export class NoMailError extends Error {
  constructor(email: string, waitedMs: number) {
    super(`No email reached ${email} within ${waitedMs} ms.`)
    this.name = 'NoMailError'
  }
}

/** Text of the newest email to `email` sent at or after `after` (epoch ms),
 *  polled until it arrives. */
export async function latestMail(email: string, after = 0, tries = 40): Promise<string> {
  const query = encodeURIComponent(`to:"${email}"`)
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${MAILPIT}/api/v1/search?query=${query}`)
      const { messages } = (await res.json()) as { messages: { ID: string; Created: string }[] }
      const fresh = messages.find((m) => Date.parse(m.Created) >= after)
      if (fresh) {
        const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${fresh.ID}`)).json()) as { Text: string }
        return msg.Text
      }
    } catch (e) {
      throw new MailpitUnreachableError(e)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new NoMailError(email, tries * 250)
}

/** The 6-digit code in the newest email to `email` sent at or after `after`. */
export async function latestCode(email: string, after = 0): Promise<string> {
  const code = (await latestMail(email, after)).match(/\b(\d{6})\b/)?.[1]
  if (!code) throw new Error(`The email to ${email} has no 6-digit code.`)
  return code
}
