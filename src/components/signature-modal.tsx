"use client"
import { useEffect, useRef, useState } from "react"

/**
 * Signature capture popup used before every APPROVE action.
 * - First time (no saved signature): draw or upload → saved to master + returned.
 * - Next times: shows saved signature with "Confirm" (reuse) or "Change" (re-sign).
 * onConfirm receives the base64 PNG data URI to stamp on the document.
 */
export default function SignatureModal({
  open, onConfirm, onCancel, title = "Sign to Approve", confirmLabel = "Confirm & Approve",
}: {
  open: boolean
  onConfirm: (signatureDataUrl: string) => void
  onCancel: () => void
  title?: string
  confirmLabel?: string
}) {
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)
  const [mode, setMode] = useState<"review" | "draw" | "upload">("review")
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)

  useEffect(() => {
    if (!open) return
    setLoading(true); setUploadPreview(null); setHasDrawn(false)
    fetch("/api/signature").then(r => r.json()).then(d => {
      setSaved(d.signatureData || null)
      setMode(d.signatureData ? "review" : "draw")
      setLoading(false)
    }).catch(() => { setSaved(null); setMode("draw"); setLoading(false) })
  }, [open])

  // (re)initialise the canvas when entering draw mode
  useEffect(() => {
    if (mode !== "draw") return
    const c = canvasRef.current; if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    c.width = w * dpr; c.height = h * dpr
    const ctx = c.getContext("2d")!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0f172a"
    setHasDrawn(false)
  }, [mode])

  if (!open) return null

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!; const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent) => {
    const c = canvasRef.current!; c.setPointerCapture(e.pointerId)
    const ctx = c.getContext("2d")!; const p = pos(e)
    ctx.beginPath(); ctx.moveTo(p.x, p.y); drawing.current = true
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext("2d")!; const p = pos(e)
    ctx.lineTo(p.x, p.y); ctx.stroke(); setHasDrawn(true)
  }
  const up = () => { drawing.current = false }
  const clearCanvas = () => {
    const c = canvasRef.current; if (!c) return
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setHasDrawn(false)
  }

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const rd = new FileReader()
    rd.onload = () => setUploadPreview(String(rd.result))
    rd.readAsDataURL(f)
  }

  // current signature data based on active mode
  const currentSig = (): string | null => {
    if (mode === "review") return saved
    if (mode === "upload") return uploadPreview
    if (mode === "draw" && hasDrawn) return canvasRef.current!.toDataURL("image/png")
    return null
  }

  const finish = async () => {
    const sig = currentSig()
    if (!sig) return
    setSaving(true)
    // Save/replace the master signature only when it's newly drawn/uploaded.
    if (mode !== "review") {
      try {
        await fetch("/api/signature", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signatureData: sig }) })
      } catch { /* stamp anyway even if master save fails */ }
    }
    setSaving(false)
    onConfirm(sig)
  }

  const canFinish = mode === "review" ? !!saved : (mode === "upload" ? !!uploadPreview : hasDrawn)

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
          ) : mode === "review" && saved ? (
            <>
              <p className="text-xs text-gray-500 mb-2">Your saved signature</p>
              <div className="border border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center h-40 overflow-hidden">
                <img src={saved} alt="signature" className="max-h-full max-w-full object-contain" />
              </div>
              <button onClick={() => { setMode("draw") }} className="mt-3 text-xs text-blue-600 hover:underline">✎ Change signature</button>
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setMode("draw")} className={`flex-1 text-sm py-2 rounded-lg font-medium border ${mode === "draw" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>✍ Draw</button>
                <button onClick={() => setMode("upload")} className={`flex-1 text-sm py-2 rounded-lg font-medium border ${mode === "upload" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>⬆ Upload image</button>
              </div>

              {mode === "draw" ? (
                <>
                  <canvas ref={canvasRef}
                    className="w-full h-40 border border-gray-300 rounded-xl bg-white touch-none cursor-crosshair"
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[11px] text-gray-400">Draw your signature above</span>
                    <button onClick={clearCanvas} className="text-xs text-gray-500 hover:text-red-600">Clear</button>
                  </div>
                </>
              ) : (
                <div className="border border-dashed border-gray-300 rounded-xl h-40 flex items-center justify-center bg-gray-50 overflow-hidden relative">
                  {uploadPreview ? (
                    <img src={uploadPreview} alt="preview" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <label className="cursor-pointer text-center text-xs text-gray-500">
                      <span className="block text-2xl mb-1">🖼</span>
                      Click to choose signature image
                      <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                    </label>
                  )}
                  {uploadPreview && (
                    <label className="absolute bottom-2 right-2 text-[11px] text-blue-600 bg-white/90 rounded px-2 py-0.5 cursor-pointer border border-blue-200">
                      Change<input type="file" accept="image/*" onChange={onFile} className="hidden" />
                    </label>
                  )}
                </div>
              )}
              {saved && <button onClick={() => setMode("review")} className="mt-3 text-xs text-gray-500 hover:underline">← Use saved signature</button>}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={finish} disabled={!canFinish || saving}
            className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40">
            {saving ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
