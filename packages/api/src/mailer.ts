/**
 * Sending one email from the API, through Resend's HTTP API (plain fetch, no
 * dependency). Off until RESEND_API_KEY and MAIL_FROM are set: returns false
 * rather than throwing, because every caller sends after the real work is done
 * and must not report that work as failed over a missing email.
 */
export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const { RESEND_API_KEY, MAIL_FROM } = process.env
  if (!RESEND_API_KEY || !MAIL_FROM) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to, subject, text }),
    })
    if (!res.ok) console.error('sendEmail refused', res.status, await res.text())
    return res.ok
  } catch (e) {
    console.error('sendEmail failed', e)
    return false
  }
}
