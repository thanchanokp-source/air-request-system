// Runs once at server startup (Next.js instrumentation hook). Guards the Node process so a
// ChunkLoadError from ONE page's SSR (a known Turbopack production quirk on the analytics/rates
// routes) logs an error instead of an unhandledRejection that kills the whole process — which was
// making pm2 crash-loop and every page return "This page couldn't load".
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason: any) => {
      console.error("[unhandledRejection guarded]", reason?.message || reason)
    })
    process.on("uncaughtException", (err: any) => {
      console.error("[uncaughtException guarded]", err?.message || err)
    })
  }
}
