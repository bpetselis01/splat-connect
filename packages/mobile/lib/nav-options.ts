// packages/mobile/lib/nav-options.ts
import { theme } from './theme'

/**
 * Shared native-header styling for every drill-down stack. Kept in one place so
 * the two tab stacks cannot drift apart — a back-navigation header that looks
 * different per tab is the clearest sign of an unowned design system.
 */
export const stackScreenOptions = {
  headerShown: true,
  headerStyle: { backgroundColor: theme.colors.background },
  headerShadowVisible: false,
  headerTintColor: theme.colors.primary,
  headerTitleStyle: {
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.heading,
    color: theme.colors.text,
  },
  contentStyle: { backgroundColor: theme.colors.background },
}
