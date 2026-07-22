// SO numbers are 8 digits. Excel stores a numeric SO as a number, so an SO that begins
// with a zero (e.g. "01250452") loses its leading zero and arrives as 7 digits
// ("1250452"). Restore it by prepending a single "0" so every SO is a full 8 digits.
// Non-numeric or already-correct SOs are returned unchanged.
export function normalizeSo(raw: any): string {
  const s = String(raw ?? "").trim()
  if (/^\d{7}$/.test(s)) return "0" + s
  return s
}

// True when an SO looks valid after normalisation: exactly 8 digits. (Non-numeric SOs are
// left for the caller to decide — this only judges the common all-digits case.)
export function isValidSo(raw: any): boolean {
  const s = normalizeSo(raw)
  return /^\d{8}$/.test(s)
}
