// Pixel language: ink borders, hard offset shadows, small radii. The blurred
// shadow and 14–18px radii of the soft pass are gone; nothing reads them once
// Task 2 lands.
export const theme = {
  colors: {
    primary: '#1998d5',
    primaryDark: '#0f6f9c',
    primaryDeep: '#0a4f70',
    background: '#eaf4fa',
    surface: '#ffffff',
    surfaceSunken: '#dcedf6',
    accentLight: '#d8ecf7',
    text: '#12283a',
    ink: '#12283a',
    muted: '#476376',
    border: '#c6e0ed',
    apricot: '#ff8f5e',
    apricotSoft: '#ffe3d5',
    apricotDeep: '#8c3312',
    mint: '#2fbf9f',
    mintSoft: '#d4f2ea',
    mintDeep: '#0f5c4d',
    honeySoft: '#fdeecb',
    honeyDeep: '#7a4e05',
    danger: '#a3301a',
    // Badge tones — the same bg/fg pairs as web's badge.tsx. tone.test guards contrast.
    tone: {
      sunken: { bg: '#dcedf6', fg: '#0a4f70' },
      honey: { bg: '#fdeecb', fg: '#7a4e05' },
      mint: { bg: '#d4f2ea', fg: '#0f5c4d' },
      apricot: { bg: '#ffe3d5', fg: '#8c3312' },
      brand: { bg: '#d8ecf7', fg: '#0a4f70' },
    },
    difficulty: {
      easy: { bg: '#d4f2ea', text: '#0f5c4d' },
      medium: { bg: '#fdeecb', text: '#7a4e05' },
      hard: { bg: '#ffe0d6', text: '#8c3312' },
    },
  },
  fonts: {
    regular: 'Nunito_400Regular',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
    black: 'Nunito_900Black',
    // Numerals only — the board draws Jersey 10 on counts and nothing else.
    numeral: 'Jersey10_400Regular',
  },
  type: { title: 24, heading: 19, body: 16, label: 14, caption: 13 },
  spacing: (n: number) => n * 4,
  border: { thin: 2, thick: 3 },
  radii: { sm: 6, md: 8, lg: 10, pill: 20 },
  // A hard shadow is an offset copy of the box in ink. `elevation` mirrors the
  // depth so Android draws something; it will be soft there, which is accepted.
  shadow: (depth: 3 | 4 | 5 | 6) => ({
    shadowColor: '#12283a',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: depth, height: depth },
    elevation: depth,
  }),
  motion: {
    pressScale: 0.96,
    fast: 140,
    base: 240,
    stagger: 55,
    press: { damping: 20, stiffness: 320, mass: 0.85 },
    settle: { damping: 16, stiffness: 170, mass: 0.9 },
  },
} as const
