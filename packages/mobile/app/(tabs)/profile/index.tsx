import { useAuth } from '../../../lib/auth-context'
import { ProfileScreen } from '../../../components/profile-screen'
import { ChildProfileHome } from '../../../components/profile/child-profile-home'

export default function ProfileIndex() {
  const { session, profile } = useAuth()
  if (session && profile?.role === 'parent') return <ChildProfileHome />
  return <ProfileScreen />
}
