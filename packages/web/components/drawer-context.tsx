/**
 * Whether the mobile navigation drawer is open.
 *
 * A context rather than a prop because the trigger and the drawer sit on
 * opposite sides of an async server component: app/layout.tsx builds the shell
 * by calling `await AppShell({ children })` on the server, and a server render
 * cannot be handed a client callback. Both consumers are already 'use client',
 * so a provider wrapped around them is the one channel that reaches both.
 *
 * Defaults to a closed, inert drawer so a component rendered outside the
 * provider — a unit test, or the header on a public route — does not throw.
 */
'use client'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'

type Drawer = { isOpen: boolean; open: () => void; close: () => void }

const noop = () => {}
const DrawerContext = createContext<Drawer>({ isOpen: false, open: noop, close: noop })

export function useDrawer(): Drawer {
  return useContext(DrawerContext)
}

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}
