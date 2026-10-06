// The last screen that showed the tab bar. The header ✕ closes everything
// opened since and lands back there.
type BarPath = '/home' | '/map' | '/inbox' | '/me' | '/guides' | '/toy-library'

let last: BarPath = '/home'

export const rememberBarPath = (tab: string) => {
  last = `/${tab}` as BarPath
}

export const lastBarPath = () => last
