// packages/mobile/lib/theme.ts
export const theme = {
  colors: {
    primary: '#1998d5',
    primaryDark: '#0f6f9c',
    text: '#1c242b',
    background: '#ffffff',
    accentLight: '#eaf6fb',
    accentLighter: '#f5fbfd',
    border: '#d9e8ee',
    muted: '#6b7a82',
    danger: '#991b1b',
    difficulty: {
      easy: { bg: '#dcfce7', text: '#166534' },
      medium: { bg: '#fef9c3', text: '#854d0e' },
      hard: { bg: '#fee2e2', text: '#991b1b' },
    },
  },
  fonts: {
    regular: 'Nunito_400Regular',
    semiBold: 'Nunito_600SemiBold',
    bold: 'Nunito_700Bold',
  },
  spacing: (n: number) => n * 4,
  radii: { sm: 8, md: 12, lg: 16, pill: 999 },
  shadow: { shadowColor: '#1c242b', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
  motion: { pressScale: 0.96, duration: 180 },
} as const
