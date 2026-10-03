import { theme } from '../../lib/theme'

/** The board's .c-sky/.c-apr/... icon-square fills, by Feature tint. */
export const TINT_BG = {
  sky: theme.colors.accentLight,
  apr: theme.colors.apricotSoft,
  mint: theme.colors.mintSoft,
  honey: theme.colors.honeySoft,
  vio: theme.colors.violetSoft,
  sun: theme.colors.surfaceSunken,
} as const
