import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export interface TestUser {
  id: string
  email: string
  token: string
}

export async function createTestUser(
  role: 'contributor' | 'admin' = 'contributor'
): Promise<TestUser> {
  const admin = createClient(supabaseUrl, serviceKey)
  const email = `test-${crypto.randomUUID()}@splat-test.local`
  const password = 'Test1234!'

  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (signUpError || !signUpData.user)
    throw new Error(`Failed to create test user: ${signUpError?.message}`)

  await admin.from('profiles').upsert({ id: signUpData.user.id, role, is_approved: true })

  const anonClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY ?? '')
  const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({
    email,
    password,
  })
  if (sessionError || !sessionData.session)
    throw new Error(`Failed to sign in test user: ${sessionError?.message}`)

  return { id: signUpData.user.id, email, token: sessionData.session.access_token }
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = createClient(supabaseUrl, serviceKey)
  await admin.auth.admin.deleteUser(userId)
}
