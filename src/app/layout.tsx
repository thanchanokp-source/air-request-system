import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/providers"
export const metadata: Metadata = { title: "Air Request System - Nan Yang Textile" }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th"><body><Providers>{children}</Providers></body></html>
}
