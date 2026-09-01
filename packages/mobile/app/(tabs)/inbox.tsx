// packages/mobile/app/(tabs)/inbox.tsx
import { InboxScreen } from '../../components/inbox/inbox-screen'

export default function InboxTab() {
  // The tab root has no native header, so the screen draws its own.
  return <InboxScreen showHeader />
}
