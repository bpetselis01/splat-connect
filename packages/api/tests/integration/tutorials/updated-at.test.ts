import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let tutorialId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  tutorialId = await createProject({ authorId: author.id, status: 'draft' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(author.id)
})

describe('tutorials.updated_at', () => {
  it('is bumped on update', async () => {
    const { data: before } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    await new Promise((r) => setTimeout(r, 10))
    await adminClient().from('tutorials').update({ title: 'Bumped' }).eq('id', tutorialId)
    const { data: after } = await adminClient().from('tutorials').select('updated_at').eq('id', tutorialId).single()
    expect(new Date(after!.updated_at as string).getTime()).toBeGreaterThan(
      new Date(before!.updated_at as string).getTime()
    )
  })
})
