// packages/mobile/lib/nav-options.ts
import { createElement } from 'react'
import { theme } from './theme'
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
  headerTitleAlign: 'left' as const,
  headerTitleStyle: {
    fontFamily: theme.fonts.display,
    fontSize: theme.type.heading,
    color: theme.colors.ink,
  },
  headerLeft: ({ canGoBack }: { canGoBack?: boolean }) => (canGoBack ? createElement(BackButton) : null),
  contentStyle: { backgroundColor: theme.colors.background },
}
