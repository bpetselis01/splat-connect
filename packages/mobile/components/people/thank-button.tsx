// packages/mobile/components/people/thank-button.tsx
/**
 * One-tap thanks, as the board draws it (MB sayThanks): a person through 117,
 * an organisation through 077. A thanks for an exchange, print or build names
 * the transaction so the person's notification opens it. The result is a
 * flash line beside the button — the app has no toast host.
 */
import { View, type StyleProp, type ViewStyle } from 'react-native'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '../../lib/api-client'
import { useAuth } from '../../lib/auth-context'
import { Button } from '../ui/Button'
import { FlashLine, useFlash } from '../ui/Flash'

export type ThankTarget = { profileId: string } | { orgId: string }

export function ThankButton({
  label,
  to,
  transactionId,
  variant = 'secondary',
  style,
}: {
  label: string
  to: ThankTarget
  transactionId?: string
  variant?: 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
}) {
  const router = useRouter()
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [message, flash] = useFlash()
  // Nobody thanks themselves (117 refuses it); on your own showcase there is no button.
  if ('profileId' in to && session?.user.id === to.profileId) return null

  async function thank() {
    if (!session) return router.push('/sign-in')
    setBusy(true)
    try {
      if ('orgId' in to) await apiClient.post(`/api/organizations/${to.orgId}/thanks`, {})
      else await apiClient.post(`/api/contributors/${to.profileId}/thanks`, transactionId ? { transaction_id: transactionId } : {})
      setSent(true)
      flash('Thanks sent — they will see it in their notifications')
    } catch (err) {
      if (err instanceof Error && /status 409/.test(err.message)) {
        setSent(true)
        flash('You already thanked them')
      } else flash('Could not send that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={style}>
      <Button label={label} variant={variant} loading={busy} disabled={sent || busy} onPress={() => void thank()} />
      <FlashLine message={message} />
    </View>
  )
}
