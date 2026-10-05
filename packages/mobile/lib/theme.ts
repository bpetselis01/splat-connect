// Soft Pop. The same token set as packages/web/app/globals.css, in the shape
// React Native wants — see docs/superpowers/specs/2026-09-16-soft-pop-extraction.md
// for where the values come from and how they were measured.
//
// The two platforms are coupled through `colors.tone` below: those bg/fg pairs
// are the same ones web's badge.tsx uses, and tone.test.ts contrast-checks them
// as one contract. Change one side without the other and the contract splits.
//
// The hard offset shadows and 6-10px radii of the Pixel pass are gone. Ironically
// this lands close to where mobile was before Pixel — that file's own header
// recorded removing "the blurred shadow and 14-18px radii of the soft pass".
import { Appearance } from 'react-native'

// Chosen once, when the app opens: every StyleSheet below reads it at import.
const dark = Appearance.getColorScheme() === 'dark'

const LIGHT = {
    primary: '#1998d5',
    primaryDark: '#1179b0',
    primaryDeep: '#0f5f8c',
    background: '#faf9f7',
    surface: '#ffffff',
    surfaceSunken: '#f3f1ed',
    accentLight: '#dcf0fb',
    // The board's --b50: the tint an unread inbox row and a selected menu
    // option sit on — one step lighter than accentLight.
    accentFaint: '#f0f9ff',
    text: '#1c2530',
    ink: '#1c2530',
    muted: '#5a6675',
    border: 'rgba(28,37,48,0.09)',
    apricot: '#ff8a5c',
    apricotSoft: '#ffe9de',
    mint: '#12b3a6',
    mintSoft: '#d9f4f1',
    honey: '#ffb020',
    honeySoft: '#fff0cc',
    violet: '#8b6df0',
    violetSoft: '#ece6fc',
    success: '#2f9e6b',
    // Carries white text, where #2f9e6b reaches only 3.37:1. Mirrors web's
    // --color-success-deep for the same reason.
    successDeep: '#237e51',
    // The board's --tok: Easy, Backed and "Like new" pills.
    successSoft: '#dff3ea',
    danger: '#e05252',
    // Carries white text (the delete-account button), where #e05252 reaches
    // only 3.82:1. Same move as successDeep.
    dangerDeep: '#b83a3a',
    dangerSoft: '#fde3e3',
    // Roles a single value cannot fill in both modes (dark mode, 2026-10-05):
    // text and icons on a coloured fill, the dark pills and their text, the
    // dimmed backdrop, and the frosted white of the tab bar and map credit.
    onColor: '#ffffff',
    inverse: '#1c2530',
    onInverse: '#ffffff',
    scrim: 'rgba(28,37,48,0.4)',
    glass: 'rgba(255,255,255,0.86)',
    // The board's tab bar: 62% white over the blur.
    tabGlass: 'rgba(255,255,255,0.62)',
    tabOn: 'rgba(220,240,251,0.85)',
    shadow: '#1c2530',
    // Badge tones — the same bg/fg pairs as web's badge.tsx. tone.test guards
    // contrast. Soft Pop inks every tint rather than using a per-hue deep
    // shade, so all seven share one foreground.
    tone: {
      sunken: { bg: '#f3f1ed', fg: '#1c2530' },
      honey: { bg: '#fff0cc', fg: '#1c2530' },
      mint: { bg: '#d9f4f1', fg: '#1c2530' },
      apricot: { bg: '#ffe9de', fg: '#1c2530' },
      brand: { bg: '#dcf0fb', fg: '#1c2530' },
    },
    difficulty: {
      easy: { bg: '#d9f4f1', text: '#1c2530' },
      medium: { bg: '#fff0cc', text: '#1c2530' },
      hard: { bg: '#ffe9de', text: '#1c2530' },
    },
  }

// The same roles for dark mode (mockup: https://claude.ai/artifact/CsJhF8jUE4m76VBAaJzBNf).
// Accents brighten to hold on dark grounds; soft tints become deep tints of
// the same hue; the badge tones keep one light foreground, as light keeps one ink.
const DARK: typeof LIGHT = {
    primary: '#3aaee6',
    primaryDark: '#3aa3dc',
    primaryDeep: '#8fd3f7',
    background: '#12171d',
    surface: '#1b222a',
    surfaceSunken: '#252e38',
    accentLight: '#173246',
    accentFaint: '#142838',
    text: '#e8ecf0',
    ink: '#e8ecf0',
    muted: '#9aa6b4',
    border: 'rgba(232,236,240,0.12)',
    apricot: '#ff9a72',
    apricotSoft: '#3b2720',
    mint: '#2cc5b8',
    mintSoft: '#14332f',
    honey: '#ffbe45',
    honeySoft: '#3a3017',
    violet: '#a08cf5',
    violetSoft: '#2a2442',
    success: '#46b883',
    successDeep: '#237e51',
    successSoft: '#16302a',
    danger: '#f06b6b',
    dangerDeep: '#b83a3a',
    dangerSoft: '#3a1e1f',
    onColor: '#ffffff',
    inverse: '#e8ecf0',
    onInverse: '#1c2530',
    scrim: 'rgba(0,0,0,0.55)',
    glass: 'rgba(27,34,42,0.88)',
    tabGlass: 'rgba(27,34,42,0.62)',
    tabOn: 'rgba(23,50,70,0.9)',
    shadow: '#000000',
    tone: {
      sunken: { bg: '#252e38', fg: '#e8ecf0' },
      honey: { bg: '#3a3017', fg: '#e8ecf0' },
      mint: { bg: '#14332f', fg: '#e8ecf0' },
      apricot: { bg: '#3b2720', fg: '#e8ecf0' },
      brand: { bg: '#173246', fg: '#e8ecf0' },
    },
    difficulty: {
      easy: { bg: '#14332f', text: '#e8ecf0' },
      medium: { bg: '#3a3017', text: '#e8ecf0' },
      hard: { bg: '#3b2720', text: '#e8ecf0' },
    },
  }

/** Both palettes, for the contrast tests; the app reads theme.colors. */
export const PALETTES = { light: LIGHT, dark: DARK }

export const theme = {
  /** The phone's Light/Dark setting when the app opened; a change reloads the app (lib/appearance.ts). */
  dark,
  colors: dark ? DARK : LIGHT,
  fonts: {
    regular: 'Nunito_400Regular',
    medium: 'Nunito_500Medium',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    black: 'Nunito_800ExtraBold',
    // Every heading. Unlike Jersey 10 this is a real display face, not numerals.
    display: 'Baloo2_800ExtraBold',
    // Counts and money, with tabular figures at the call site.
    numeral: 'JetBrainsMono_400Regular',
  },
  // The only text sizes in the app; tests/unit/lib/type-scale.test.ts fails on
  // a raw number. hero is the one big figure (recycling), display the tab heroes.
  type: { hero: 44, display: 28, title: 24, heading: 19, body: 16, label: 14, caption: 13, micro: 11 },
  spacing: (n: number) => n * 4,
  // One hairline. `thick` survives for the few places that need a real edge,
  // but Soft Pop separates with elevation rather than with borders.
  border: { hairline: 1 },
  // card is 20 here, 24 on web: the mobile board draws its cards at 20
  // (tokens radius.lg), the desktop board at 24.
  radii: { field: 14, panel: 18, card: 20, pill: 999 },
  // Four elevations, matching web's --e1..--e4. iOS reads the shadow* fields
  // and Android reads `elevation`; both are given so neither platform falls
  // flat. There is no offset ladder any more — depth is blur and spread.
  shadow: (level: 1 | 2 | 3 | 4) =>
    ({
      1: { shadowColor: '#1c2530', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
      2: { shadowColor: '#1c2530', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
      3: { shadowColor: '#1c2530', shadowOpacity: 0.1, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
      4: { shadowColor: '#1c2530', shadowOpacity: 0.14, shadowRadius: 48, shadowOffset: { width: 0, height: 24 }, elevation: 12 },
    })[level],
  motion: {
    // Unchanged, and now shared: web presses with transform:scale(.96) too.
    pressScale: 0.96,
    fast: 140,
    base: 240,
    stagger: 55,
    press: { damping: 20, stiffness: 320, mass: 0.85 },
    settle: { damping: 16, stiffness: 170, mass: 0.9 },
  },
} as const
