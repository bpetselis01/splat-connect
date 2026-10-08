// packages/mobile/lib/guide-files.ts
//
// The Files tab's helpers. Downloads live on the website; the app only views.

/** 'lts_base.stl' → 'Lts base': the filename without its extension, as words. */
export function stlName(filename: string): string {
  const bare = filename.replace(/\.stl$/i, '').replace(/[_-]+/g, ' ').trim()
  return bare ? bare[0]!.toUpperCase() + bare.slice(1) : ''
}

/** The guide's page on the website, where the PDF and STLs download; null when no web address is configured. */
export function webGuideUrl(tutorialId: string): string | null {
  const web = process.env.EXPO_PUBLIC_WEB_URL
  return web ? `${web}/tutorials/${tutorialId}` : null
}

// Above this the parse takes seconds on a phone and the page is told to say so.
export const STL_PREVIEW_MAX_BYTES = 25 * 1024 * 1024
