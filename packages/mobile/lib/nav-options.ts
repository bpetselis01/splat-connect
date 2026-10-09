// packages/mobile/lib/nav-options.ts
import { createElement, type ReactElement } from 'react'
import { theme } from './theme'
import { CloseToTabsButton } from '../components/ui/CloseButton'

/**
 * A header button without iOS 26's own glass capsule. A plain headerLeft or
 * headerRight is wrapped in a shared-background bar item, which draws a second
 * outline round our own disc; the items API can opt out of it. The plain prop is
 * kept for Android and web, which have no capsule.
 */
const bare = (render: () => ReactElement) => () => [
  { type: 'custom' as const, element: render(), hidesSharedBackground: true },
]
export const headerLeftSlot = (render: () => ReactElement) => ({
  headerLeft: render,
  unstable_headerLeftItems: bare(render),
})
export const headerRightSlot = (render: () => ReactElement) => ({
  headerRight: render,
  unstable_headerRightItems: bare(render),
})

/**
 * Shared native-header styling for every drill-down stack. Kept in one place so
 * the stacks cannot drift apart — a back-navigation header that looks
 * different per tab is the clearest sign of an unowned design system.
 *
 * The board's header (#guide_detail): a 40px round disc, a Baloo title beside
 * it, and a hairline under the bar. The disc is an ✕ that closes back to the
 * last screen with the tab bar (Byron's choice, 2026-10-06); one page back is
 * iOS's edge swipe or Android's Back. A screen that sets its own headerLeft (a
 * sheet's CloseButton) wins.
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
  // Home shortcut holds that one screen, and the ✕ still has somewhere to go.
  ...headerLeftSlot(() => createElement(CloseToTabsButton)),
  contentStyle: { backgroundColor: theme.colors.background },
}
