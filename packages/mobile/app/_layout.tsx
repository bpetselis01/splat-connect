import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_900Black } from '@expo-google-fonts/nunito'
import { Jersey10_400Regular } from '@expo-google-fonts/jersey-10'
import { AuthProvider } from '../lib/auth-context'
import { IntroVideo } from '../components/ui/IntroVideo'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_900Black, Jersey10_400Regular })
  const [showIntro, setShowIntro] = useState(true)

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(my)" options={{ presentation: 'modal' }} />
        </Stack>
        {showIntro ? <IntroVideo onFinish={() => setShowIntro(false)} /> : null}
      </AuthProvider>
    </SafeAreaProvider>
  )
}
