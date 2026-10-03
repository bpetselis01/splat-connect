// packages/mobile/lib/use-tab-focused.ts
import { useEffect, useState } from 'react'
import { useNavigation, useRoute } from 'expo-router'

/**
 * Whether this tab is the one in front of the tab navigator. Called from a
 * tab's layout. Unlike useIsFocused it stays true while a screen from (my) or
 * printing is pushed over the tabs: those pushes cover the tab, they do not
 * leave it.
 */
export function useTabFocused(): boolean {
  const navigation = useNavigation()
  const { key } = useRoute()
  const read = () => {
    const tabs = navigation.getState()
    return !tabs || tabs.routes[tabs.index]?.key === key
  }
  const [focused, setFocused] = useState(read)
  useEffect(() => {
    setFocused(read())
    return navigation.addListener('state', () => setFocused(read()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, key])
  return focused
}
