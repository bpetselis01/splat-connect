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
export const theme = {
  colors: {
    primary: '#1998d5',
    primaryDark: '#1179b0',
    primaryDeep: '#0f5f8c',
    background: '#faf9f7',
    surface: '#ffffff',
    surfaceSunken: '#f3f1ed',
    accentLight: '#dcf0fb',
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
    danger: '#e05252',
    dangerSoft: '#fde3e3',
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
  },
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
  type: { title: 24, heading: 19, body: 16, label: 14, caption: 13 },
  spacing: (n: number) => n * 4,
  // One hairline. `thick` survives for the few places that need a real edge,
  // but Soft Pop separates with elevation rather than with borders.
  border: { hairline: 1 },
  radii: { field: 14, panel: 18, card: 24, pill: 999 },
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
