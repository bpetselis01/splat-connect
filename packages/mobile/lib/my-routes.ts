// buildNav speaks in web hrefs (it is shared); this is the whole translation.
// Adding a hub row on web without a line here sends it to the hub, not a 404.
const ROUTES: Record<string, string> = {
  '/dashboard/tutorials': '/tutorials',
  '/dashboard/toys': '/toys',
  '/dashboard/exchanges': '/exchanges',
  '/dashboard/challenges': '/challenges',
  '/get-involved/submit-an-idea': '/explore',
  '/dashboard/print-requests': '/print-requests',
  '/dashboard/organisation': '/organisation',
  '/dashboard/organisation/toys': '/organisation/toys',
  '/dashboard/organisation/orders': '/organisation/orders',
  '/dashboard/saved': '/saved',
  '/notifications': '/notifications',
  '/dashboard/profile': '/account',
  '/admin': '/admin',
}

export const myRoute = (href: string) => ROUTES[href] ?? '/my-splat'
