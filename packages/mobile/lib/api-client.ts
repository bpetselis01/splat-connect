import { router } from 'expo-router'
import { makeApiClient } from '@splat-connect/types'
import { supabase } from './supabase'

// Exported so lib/upload.ts can reuse the exact same session lookup for its
// multipart requests instead of a second copy of this.
export async function getToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

// The request core is web's, from @splat-connect/types: same error messages,
// same empty-body handling, same `status` on a thrown ApiError.
export const apiClient = makeApiClient({
  getToken,
  baseUrl: () => process.env.EXPO_PUBLIC_API_URL ?? '',
  // Pushed over the screen that made the write, so Accept can come back to it with its state.
  onTermsRequired: () => router.push({ pathname: '/terms', params: { returnTo: 'back' } }),
})
