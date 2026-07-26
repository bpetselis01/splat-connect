import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { getUserRole } from '@/lib/auth'

// Nunito is the mobile app's family (packages/mobile/lib/theme.ts). One rounded
// sans across headings, labels, buttons and data — product UI doesn't need a
// display/body pairing, and the shared family is what makes the two surfaces
// read as one product.
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-nunito',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SPLAT Connect — Toy Adaptation Library',
  description:
    'Open-source tutorials for switch-adapting toys for children with disabilities',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getUserRole()

  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-screen font-sans antialiased">
        <Nav role={role} />
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  )
}
