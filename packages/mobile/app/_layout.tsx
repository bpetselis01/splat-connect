import { useEffect, useState } from 'react'
import { Slot } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito'
import { AuthProvider } from '../lib/auth-context'
import { IntroVideo } from '../components/ui/IntroVideo'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold })
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Slot />
        {showIntro ? <IntroVideo onFinish={() => setShowIntro(false)} /> : null}
      </AuthProvider>
    </SafeAreaProvider>
  )
}
