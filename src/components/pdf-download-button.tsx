"use client"
import React, { useState } from "react"

export function PdfDownloadButton({ req, item, compact = false, alwaysShow = false }: { req: any; item?: any; compact?: boolean; alwaysShow?: boolean }) {
  const [loading, setLoading] = useState(false)

  if (!alwaysShow && req.status !== "COMPLETED") return null

  const handleDownload = async () => {
    setLoading(true)
    try {
      const fullReq = await fetch(`/api/requests/${req.id}`).then(r => r.json())
      const fullItem = fullReq.items?.find((i: any) => i.id === item.id) || item
      const fileName = `${fullReq.documentNo}_${fullItem.so}.pdf`

      const [{ pdf }, { RequestPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./request-pdf"),
      ])

      const element = React.createElement(RequestPdfDocument, { req: fullReq, item: fullItem }) as any
      const blob = await pdf(element).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
      alert("PDF generation failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); handleDownload() }}
      disabled={loading}
      className={
        compact
          ? "text-xs bg-gray-700 text-white px-2 py-0.5 rounded hover:bg-gray-800 disabled:opacity-50 font-medium whitespace-nowrap"
          : "text-sm bg-gray-700 text-white px-4 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium"
      }
    >
      {loading ? "..." : "↓ PDF"}
    </button>
  )
}
