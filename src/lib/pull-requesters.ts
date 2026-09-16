// Build the "จัดซื้อ / requester" option list for Pull RM filters. Groups by the real user id
// (createdById) so the same person merges even when their name was stored inconsistently
// ("sudarat" vs "sudarat.r"); the display is the most name-like value in the group.
// Returns { options } for a <MultiSelect>, plus displayOf(doc) so a doc can be matched to its option.
const rname = (s: any) => String(s || "").split("@")[0].trim()
const reqKey = (r: any) => r.createdById || rname(r.requesterName).toLowerCase()

export function buildRequesters(reqs: any[]): { options: string[]; displayOf: (r: any) => string } {
  const groups = new Map<string, Set<string>>()
  reqs.forEach(r => { const d = rname(r.requesterName); if (!d) return; const k = reqKey(r); if (!groups.has(k)) groups.set(k, new Set()); groups.get(k)!.add(d) })
  const displayFor = new Map<string, string>()
  groups.forEach((names, k) => {
    const arr = [...names]
    const noDot = arr.filter(n => !n.includes(".")) // "sudarat" beats "sudarat.r"
    displayFor.set(k, (noDot.length ? noDot : arr).sort((a, b) => a.length - b.length)[0])
  })
  const options = [...new Set([...displayFor.values()])].sort()
  return { options, displayOf: (r: any) => displayFor.get(reqKey(r)) || rname(r.requesterName) }
}
