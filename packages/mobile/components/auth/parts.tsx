// packages/mobile/components/auth/parts.tsx
//
// The pieces every sign-in screen shares — the web board's auth stage (bear,
// card column, "No paid tier" foot line) made into a phone column, plus the
// controls the spec calls for (docs/superpowers/specs/2026-09-30-mobile-sign-in-design.md).
import { useEffect, useRef, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { BackButton } from '../ui/BackButton'
import { Screen } from '../ui/Screen'
import { TextField } from '../ui/TextField'
import { AppleButton, appleAvailable, googleAvailable } from '../../lib/social-auth'
import type { AuthProblem } from '../../lib/auth-errors'

const CONTROL = 52

/** The board draws every auth action as a 52px pill; Button's default is the
 *  14px-radius form button. */
export const pill = { borderRadius: theme.radii.pill, minHeight: CONTROL }

export function AuthStage({
  children,
  back = true,
  foot = true,
}: {
  children: React.ReactNode
  back?: boolean
  foot?: boolean
}) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen ownHeader>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.column}>
            {back ? (
              <View style={styles.back}>
                <BackButton />
              </View>
            ) : null}
            {children}
            {foot ? <Text style={styles.foot}>No paid tier. Not a medical device.</Text> : null}
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  )
}

export function Heading({ children, center }: { children: string; center?: boolean }) {
  return (
    <Text accessibilityRole="header" style={[styles.heading, center && styles.center]}>
      {children}
    </Text>
  )
}

export function Lede({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return <Text style={[styles.lede, center && styles.center]}>{children}</Text>
}

/** Apple (iOS only) above Google, same height, then the "or" rule. Renders
 *  nothing when neither provider is configured for this build. */
export function SocialButtons({ onApple, onGoogle }: { onApple: () => void; onGoogle: () => void }) {
  const [apple, setApple] = useState(false)
  const google = googleAvailable()
  useEffect(() => {
    let live = true
    appleAvailable().then((a) => live && setApple(a))
    return () => {
      live = false
    }
  }, [])
  if (!apple && !google) return null
  return (
    <View style={styles.social}>
      {apple ? <AppleButton onPress={onApple} height={CONTROL} /> : null}
      {google ? (
        <Pressable
          testID="google-sign-in"
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          onPress={onGoogle}
          style={({ pressed }) => [styles.google, pressed && styles.pressed]}
        >
          <Image source={require('../../assets/google-g.png')} style={styles.gLogo} />
          <Text style={styles.googleText}>Continue with Google</Text>
        </Pressable>
      ) : null}
      <View style={styles.or} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.rule} />
        <Text style={styles.orText}>or use your email</Text>
        <View style={styles.rule} />
      </View>
    </View>
  )
}

export function PasswordField({
  label = 'Password',
  isNew,
  ...input
}: TextInputProps & { label?: string; isNew?: boolean }) {
  const [shown, setShown] = useState(false)
  const long = (input.value ?? '').length >= 6
  return (
    <View>
      <TextField
        testID="password-input"
        label={label}
        accessibilityLabel={label}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={isNew ? 'newPassword' : 'password'}
        autoComplete={isNew ? 'new-password' : 'current-password'}
        passwordRules={isNew ? 'minlength: 6;' : undefined}
        {...input}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            onPress={() => setShown((v) => !v)}
            hitSlop={6}
            style={styles.eye}
          >
            <Ionicons name={shown ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.muted} />
          </Pressable>
        }
      />
      {isNew ? (
        <View style={styles.rule6}>
          <Ionicons
            name={long ? 'checkmark-circle' : 'information-circle-outline'}
            size={15}
            color={long ? theme.colors.successDeep : theme.colors.muted}
          />
          <Text style={[styles.hint, long && styles.hintOk]}>At least 6 characters</Text>
        </View>
      ) : null}
    </View>
  )
}

/** Six boxes drawn over one real input, so paste, the keyboard's code
 *  suggestion and screen readers all see a single "6-digit code" field. */
export function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const ref = useRef<TextInput>(null)
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.codeRow} accessible={false}>
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          style={[styles.codeBox, i === Math.min(value.length, 5) && styles.codeBoxCurrent]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={styles.codeDigit}>{value[i] ?? ''}</Text>
        </View>
      ))}
      <TextInput
        ref={ref}
        testID="code-input"
        accessibilityLabel="6-digit code"
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        caretHidden
        style={styles.codeInput}
      />
    </Pressable>
  )
}

const WEB = process.env.EXPO_PUBLIC_WEB_URL

export function TermsCheckbox({
  checked,
  onPress,
  testID = 'accept-contributor-terms',
}: {
  checked: boolean
  onPress: () => void
  testID?: string
}) {
  return (
    <View style={styles.terms}>
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.termsRow}
      >
        <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={theme.colors.primaryDark} />
        <Text style={styles.termsText}>
          I agree to the contributor terms and understand SPLAT Connect is not a medical device.
        </Text>
      </Pressable>
      {/* Links are siblings of the checkbox, never nested inside it: nested, a
          tap aimed at the box opened the browser and the box never ticked. */}
      <View style={styles.termsLinks}>
        <Pressable accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(`${WEB}/legal/contributor-terms`)}>
          <Text style={styles.link}>Contributor terms</Text>
        </Pressable>
        <Pressable accessibilityRole="link" hitSlop={6} onPress={() => Linking.openURL(`${WEB}/privacy`)}>
          <Text style={styles.link}>Privacy policy</Text>
        </Pressable>
      </View>
    </View>
  )
}

export function AuthError({
  error,
  action,
}: {
  error: AuthProblem | null
  action?: { label: string; onPress: () => void }
}) {
  if (!error) return null
  return (
    <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <View style={styles.errorLine}>
        <Ionicons name="alert-circle" size={18} color={theme.colors.danger} />
        <Text style={styles.errorText}>{error.message}</Text>
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={6}>
          <Text style={styles.errorAction}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function TextLink({ lead, label, onPress, testID }: { lead?: string; label: string; onPress: () => void; testID?: string }) {
  return (
    <View style={styles.textLinkRow}>
      {lead ? <Text style={styles.textLinkLead}>{lead} </Text> : null}
      <Pressable testID={testID} accessibilityRole="link" onPress={onPress} hitSlop={8}>
        <Text style={styles.link}>{label}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingBottom: theme.spacing(8) },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: theme.spacing(3) },
  back: { alignSelf: 'flex-start' },
  center: { textAlign: 'center' },
  heading: { fontFamily: theme.fonts.display, fontSize: 26, lineHeight: 30, color: theme.colors.ink },
  lede: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, lineHeight: 21, color: theme.colors.muted },
  foot: {
    fontFamily: theme.fonts.semiBold,
    fontSize: 12,
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing(4),
  },
  social: { gap: theme.spacing(3) },
  google: {
    height: CONTROL,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2.5),
    ...theme.shadow(1),
  },
  pressed: { transform: [{ scale: theme.motion.pressScale }] },
  gLogo: { width: 20, height: 20 },
  googleText: { fontFamily: theme.fonts.black, fontSize: 16, color: theme.colors.ink },
  or: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2.5), marginVertical: theme.spacing(1) },
  rule: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  orText: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rule6: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1.5), marginTop: -theme.spacing(2.5), marginBottom: theme.spacing(3) },
  hint: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.muted },
  hintOk: { color: theme.colors.successDeep },
  codeRow: { flexDirection: 'row', gap: theme.spacing(1.5), justifyContent: 'center' },
  codeBox: {
    flex: 1,
    maxWidth: 52,
    height: 56,
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeBoxCurrent: { borderColor: theme.colors.primary, borderWidth: 2 },
  codeDigit: { fontFamily: theme.fonts.numeral, fontSize: 24, color: theme.colors.ink },
  // Over the boxes, invisible but real: it takes the taps, the paste and the
  // autofill, and Playwright can fill it.
  codeInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
  terms: { gap: theme.spacing(1.5) },
  termsRow: { flexDirection: 'row', gap: theme.spacing(2.5), alignItems: 'flex-start' },
  termsText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, lineHeight: 19, color: theme.colors.ink },
  termsLinks: { flexDirection: 'row', gap: theme.spacing(4), marginLeft: theme.spacing(8.5) },
  link: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    textDecorationLine: 'underline',
  },
  error: {
    gap: theme.spacing(2),
    backgroundColor: theme.colors.dangerSoft,
    borderRadius: theme.radii.field,
    padding: theme.spacing(3),
  },
  errorLine: { flexDirection: 'row', gap: theme.spacing(2), alignItems: 'flex-start' },
  errorText: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, lineHeight: 18, color: theme.colors.ink },
  errorAction: {
    fontFamily: theme.fonts.black,
    fontSize: theme.type.caption,
    color: theme.colors.primaryDeep,
    textDecorationLine: 'underline',
    marginLeft: theme.spacing(6.5),
  },
  textLinkRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', marginTop: theme.spacing(1) },
  textLinkLead: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
