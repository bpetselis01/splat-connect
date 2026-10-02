/** 099. The postcode to measure from, or null when the profile's is not four digits (the API 400s anything else). */
export const nearParam = (postcode: string | null | undefined): string | null => {
  const p = postcode?.trim() ?? ''
  return /^\d{4}$/.test(p) ? p : null
}
