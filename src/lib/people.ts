const PEOPLE_API = "http://172.16.9.89:8080/info/people.php/getList"
const CACHE_TTL = 5 * 60 * 1000

let _cache: { data: any[]; ts: number } | null = null

export async function fetchPeopleList(): Promise<any[]> {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) return _cache.data
  const res = await fetch(PEOPLE_API, { method: "POST", signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`People API returned ${res.status}`)
  const data = await res.json()
  _cache = { data: Array.isArray(data) ? data : [], ts: Date.now() }
  return _cache.data
}

export async function emailExistsInDirectory(email: string): Promise<boolean> {
  const people = await fetchPeopleList()
  const lower = email.toLowerCase()
  return people.some(p => (p.MAIL || "").toLowerCase() === lower)
}
