/**
 * Admin Supabase Client Factory
 * 
 * Creates a Supabase client with SERVICE ROLE credentials.
 * This client BYPASSES Row Level Security (RLS) policies.
 * 
 * WARNING: Use this ONLY for internal operations where RLS bypass is intentional.
 * For user-facing operations, use createUserClient() instead.
 * 
 * When to use this:
 * - Internal admin operations (not accessible to users)
 * - Initial data setup/migrations
 * - In specific routes like POST /tutorials (where JWT context causes issues)
 * 
 * How it differs from user client (supabase/user-client.ts):
 * - Admin client: Uses service_role_key, RLS policies are IGNORED
 * - User client: Uses anon key + user JWT, RLS policies are ENFORCED
 * 
 * Security implications:
 * - Admin client can access ANY data without restrictions
 * - Only use when you're performing intended admin operations
 * - NEVER pass admin client to user-facing code
 * - Always validate user permissions BEFORE using this
 * 
 * Related files:
 * - supabase/user-client.ts: User-safe version with RLS
 * - middleware/auth.ts: Validates user permissions before routes run
 * - routes/tutorials.ts: Uses admin client in POST (carefully)
 */
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
