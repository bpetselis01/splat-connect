/**
 * Inbox — messages from the contact form.
 */
import { apiClient } from '@/lib/api-client'
import { AdminInbox, type ContactMessage } from '@/components/admin-inbox'

export const metadata = { title: 'Inbox — SPLAT Connect' }

export default async function AdminInboxPage() {
  const messages = await apiClient
    .get<ContactMessage[]>('/api/admin/inbox')
    .catch(() => [] as ContactMessage[])

  return (
    <div className="max-w-[980px]">
      <h1 className="title-hub">Inbox</h1>
      <p className="mt-2 mb-[22px] max-w-[60ch] text-[15px] text-muted">
        Messages from the contact form. Safety reports sit at the top of Open until someone
        answers them.
      </p>
      <AdminInbox messages={messages} />
    </div>
  )
}
