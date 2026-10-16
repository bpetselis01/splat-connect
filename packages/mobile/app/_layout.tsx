import { useEffect } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito'
import { Baloo2_800ExtraBold } from '@expo-google-fonts/baloo-2'
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono'
import { StatusBar } from 'expo-status-bar'
import { AuthProvider } from '../lib/auth-context'
import { ActingOrgProvider } from '../lib/acting-org'
import { useReloadOnAppearanceChange } from '../lib/appearance'
import { theme } from '../lib/theme'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useReloadOnAppearanceChange()
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Baloo2_800ExtraBold,
    JetBrainsMono_400Regular,
  })

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync()
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ActingOrgProvider>
          <StatusBar style={theme.dark ? 'light' : 'dark'} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(my)" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="printing" />
            {/* No swipe back: the terms gate is where every route sends an
                account that has not accepted, so there is nothing behind it. */}
            <Stack.Screen name="terms" options={{ gestureEnabled: false }} />
            {/* What a pending control opens (packages/types/src/pending.ts). */}
            <Stack.Screen name="not-built" />
          </Stack>
        </ActingOrgProvider>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
