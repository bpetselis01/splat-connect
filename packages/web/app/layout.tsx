import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { apiClient } from '@/lib/api-client'
import type { Role, Profile } from '@splat-connect/types'

const inter = Inter({ subsets: ['latin'] })

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
  let role: Role | null = null
  try {
    const profile = await apiClient.get<Profile>('/api/contributors/me')
    role = profile.role
  } catch {
    // unauthenticated or API unavailable — role stays null
  }

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        <Nav role={role} />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  )
}
