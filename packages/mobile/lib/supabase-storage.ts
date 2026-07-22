// Supabase auth needs a storage adapter. On native we use SecureStore (encrypted
// on-device). SecureStore is unavailable on web (react-native-web), so the web
// build falls back to localStorage — good enough for the dev/E2E web target.
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

export type AuthStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

// ponytail: SecureStore caps individual values at ~2048 bytes. Fine for the
// simple email/password sessions this app issues today; if a future OAuth
// provider inflates the session payload past that, swap this adapter for a
// hybrid SecureStore (key) + AsyncStorage (encrypted blob) implementation.
const secureStoreAdapter: AuthStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
}

const webAdapter: AuthStorage = {
  getItem: (key) => Promise.resolve(globalThis.localStorage?.getItem(key) ?? null),
  setItem: (key, value) => { globalThis.localStorage?.setItem(key, value); return Promise.resolve() },
  removeItem: (key) => { globalThis.localStorage?.removeItem(key); return Promise.resolve() },
}

export function resolveAuthStorage(os: string = Platform.OS): AuthStorage {
  return os === 'web' ? webAdapter : secureStoreAdapter
}
