// Postgres rejects a malformed uuid with 22P02. Routes map this to 404 rather
// than 500 — "Not found" is the truthful answer for an id that could never
// name a row, and it keeps a garbage path from surfacing as a 500.
export const INVALID_TEXT_REPRESENTATION = '22P02'

// A CHECK constraint refused the write. Routes whose constraint has a sentence
// of its own map this to 400.
export const CHECK_VIOLATION = '23514'
