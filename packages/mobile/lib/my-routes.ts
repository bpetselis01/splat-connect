// buildNav speaks in web hrefs (it is shared); this is the whole translation.
// Adding a hub row on web without a line here sends it to the hub, not a 404.
const ROUTES: Record<string, string> = {
  '/dashboard/tutorials': '/tutorials',
  '/dashboard/toys': '/toys',
  '/dashboard/exchanges': '/exchanges',
  '/dashboard/challenges': '/challenges',
  // Was '/explore' while the form did not exist yet — a hub row that landed
  // on the tab and left you to find it. Now it names its own screen.
  '/get-involved/submit-an-idea': '/explore/challenges/new',
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
