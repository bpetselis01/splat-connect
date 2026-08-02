import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createProject } from '../../helpers/orgs.js'

let recipient: TestUser
let stranger: TestUser
let tutorialId: string
let notificationId: string

beforeAll(async () => {
  recipient = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: recipient.id, status: 'draft' })
  const { data, error } = await adminClient()
    .from('notifications')
    .insert({
      recipient_id: recipient.id,
      type: 'tutorial_approved',
      tutorial_id: tutorialId,
      actor_name: 'SPLAT',
    })
    .select('id')
    .single()
  if (error) throw error
  notificationId = data.id as string
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(recipient.id)
  await deleteTestUser(stranger.id)
})

describe('notifications RLS', () => {
  it('the recipient can read their own notification', async () => {
    const { data, error } = await createUserClient(recipient.token)
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('a stranger cannot read someone else\'s notification', async () => {
    const { data, error } = await createUserClient(stranger.token)
      .from('notifications')
      .select('id')
      .eq('id', notificationId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('the recipient can mark their own notification read', async () => {
    const { data, error } = await createUserClient(recipient.token)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('read_at')
    expect(error).toBeNull()
    expect(data?.[0]?.read_at).not.toBeNull()
  })

  it('a stranger cannot mark someone else\'s notification read', async () => {
    const { data, error } = await createUserClient(stranger.token)
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select('id')
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  it('an ordinary user cannot insert a notification for themselves', async () => {
    const { error } = await createUserClient(recipient.token)
      .from('notifications')
      .insert({ recipient_id: recipient.id, type: 'tutorial_approved', tutorial_id: tutorialId, actor_name: 'me' })
    expect(error?.code).toBe('42501')
  })
})
