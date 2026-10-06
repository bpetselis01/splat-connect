// packages/mobile/lib/nav-options.ts
import { createElement } from 'react'
import { initialWindowMetrics } from 'react-native-safe-area-context'
import { theme } from './theme'
import { tabBarClearance } from './tab-bar-layout'
import { BackButton } from '../components/ui/BackButton'

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
  // The scene stops above the floating tab bar, so a footer or the last row
  // never sits under it. Static: contentStyle is not a hook, and the bottom
  // inset does not change while the app runs.
  contentStyle: {
    backgroundColor: theme.colors.background,
    paddingBottom: tabBarClearance(initialWindowMetrics?.insets.bottom ?? 0),
  },
}

/**
 * For a screen that does not stop above the bar: a stack root or reading page
 * that pads its own scroll content (so the list scrolls behind the glass), a
 * sheet or build mode that covers the bar, or a chat that hides it.
 */
export const noBarClearance = { contentStyle: { backgroundColor: theme.colors.background } }
