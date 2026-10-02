// packages/mobile/app/(my)/notifications.tsx
import { InboxScreen } from '../../components/inbox/inbox-screen'

export default function MyNotifications() {
  // Title comes from the native header (app/(my)/_layout.tsx: "Notifications"),
  // and the row that led here was Notifications, so that half opens first.
  return <InboxScreen initialSegment="notifications" />
}
