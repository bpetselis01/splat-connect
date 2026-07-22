import 'react-native-url-polyfill/auto'
import { AppState } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import { resolveAuthStorage } from './supabase-storage'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: resolveAuthStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)

// React Native has no browser visibility API — Supabase relies on this to
// pause/resume its auto-refresh timer while the app is backgrounded.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
