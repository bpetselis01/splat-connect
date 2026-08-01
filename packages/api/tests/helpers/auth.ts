import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export interface TestUser {
  id: string
  email: string
  token: string
}

/** Service-role client for test setup, assertions, and cleanup. */
export function adminClient() {
  return createClient(supabaseUrl, serviceKey)
}

export async function createTestUser(
  role: 'contributor' | 'admin' = 'contributor'
): Promise<TestUser> {
  const admin = adminClient()
  const email = `test-${crypto.randomUUID()}@splat-test.local`
  const password = 'Test1234!'

  const { data: signUpData, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (signUpError || !signUpData.user)
    throw new Error(`Failed to create test user: ${signUpError?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: signUpData.user.id, role })
  if (profileError)
    throw new Error(`Failed to set test user profile: ${profileError.message}`)

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
  const admin = adminClient()
  await admin.auth.admin.deleteUser(userId)
}
