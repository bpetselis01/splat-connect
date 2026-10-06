// packages/mobile/lib/appearance.ts
// theme.colors is fixed when the app opens (every StyleSheet reads it at
// import), so a Light/Dark switch while the app is open reloads it to repaint.
import { useEffect } from 'react'
import { Appearance, DevSettings } from 'react-native'
import * as Updates from 'expo-updates'
import { theme } from './theme'

/** Reloads the app when the phone's Light/Dark setting stops matching the palette it opened with. */
export function useReloadOnAppearanceChange() {
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if ((colorScheme === 'dark') === theme.dark) return
      // expo-updates reloads a release build; a dev build reloads through Metro.
      if (Updates.isEnabled) void Updates.reloadAsync().catch(() => DevSettings.reload())
      else DevSettings.reload()
    })
    return () => sub.remove()
  }, [])
}
