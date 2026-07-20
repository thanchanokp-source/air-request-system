import { AsyncLocalStorage } from "async_hooks"

// Per-document TEST reroute. When a notify function runs inside runWithTestMail(adminEmail, …),
// every sendMail it triggers is redirected to that admin (with a [TEST→] tag) instead of the
// real recipients — so admins can test the flow of ONE document without touching real users.
const testMailCtx = new AsyncLocalStorage<{ to: string }>()

export function runWithTestMail<T>(to: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  return to ? testMailCtx.run({ to }, fn) : fn()
}

export function currentTestMail(): string | null {
  return testMailCtx.getStore()?.to ?? null
}
