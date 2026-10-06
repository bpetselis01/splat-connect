// packages/mobile/lib/nav-options.ts
import { createElement } from 'react'
import { theme } from './theme'
import { BackButton } from '../components/ui/BackButton'
import { HomeButton } from '../components/ui/HomeButton'

/**
 * Shared native-header styling for every drill-down stack. Kept in one place so
 * the stacks cannot drift apart — a back-navigation header that looks
 * different per tab is the clearest sign of an unowned design system.
 *
 * The board's header (#guide_detail): a 40px round back button, a Baloo title
 * beside it, and a hairline under the bar. headerLeft replaces the platform
 * chevron; iOS keeps its swipe-back gesture regardless. A screen that sets its
 * own headerLeft (a sheet's CloseButton, the editor hub's named back) wins.
 */
export const stackScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: theme.colors.background },
  headerShadowVisible: true,
  headerTintColor: theme.colors.ink,
  // Android only: iOS keeps its centred title (decided 2026-10-01).
  headerTitleAlign: 'left' as const,
  headerTitleStyle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.type.heading,
    color: theme.colors.ink,
  },
  // Always drawn, not only when `canGoBack`: a hidden tab's stack opened by a
  // Home shortcut holds that one screen, and BackButton goes Home from there.
  headerLeft: () => createElement(BackButton),
  // Option B (2026-10-06): Home is one tap from any screen without the tab
  // bar. Tab roots draw no header, so this never doubles the bar's Home. A
  // screen with its own right-hand button wraps it in WithHome; a sheet or
  // first-run flow turns it off with headerRight: () => null.
  headerRight: () => createElement(HomeButton),
  contentStyle: { backgroundColor: theme.colors.background },
}
