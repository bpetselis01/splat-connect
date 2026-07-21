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
} as const
