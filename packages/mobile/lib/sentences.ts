// packages/mobile/lib/sentences.ts
//
// A step body as its sentences, so build mode can show "a, b" actions rather
// than one paragraph. Splits only where a stop is followed by a space and a
// capital or a digit: "3.5 mm" and "e.g. the" stay whole. Never rewrites.

export function sentences(text: string): string[] {
  // The stop is captured and glued back on: no lookbehind, which older Hermes lacks.
  const parts = text.trim().split(/([.!?])\s+(?=[A-Z0-9])/)
  const out: string[] = []
  for (let i = 0; i < parts.length; i += 2) out.push(parts[i] + (parts[i + 1] ?? ''))
  return out.map((s) => s.trim()).filter(Boolean)
}
