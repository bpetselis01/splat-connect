import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito'
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2'
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono'
import { AuthProvider } from '../lib/auth-context'
import { IntroVideo } from '../components/ui/IntroVideo'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Baloo2_800ExtraBold,
    JetBrainsMono_400Regular,
  })
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
          <Stack.Screen name="(my)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="printing" />
        </Stack>
        {showIntro ? <IntroVideo onFinish={() => setShowIntro(false)} /> : null}
      </AuthProvider>
    </SafeAreaProvider>
  )
}
