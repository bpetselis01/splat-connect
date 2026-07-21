import { Slot } from 'expo-router'
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito'
import { AuthProvider } from '../lib/auth-context'

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold })

  if (!fontsLoaded) return null

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  )
}
