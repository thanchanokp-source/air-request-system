"use client"

// Route-level error boundary for the request detail page. Without this, a render-time
// exception (e.g. after a Save Draft refetch) unmounts the whole page → it looks like the
// document "disappeared". This catches it, shows the error + a retry, so the data is never lost
// (it's safe on the server) and the actual error message is visible for debugging.
export default function RequestDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-xl mx-auto mt-16 bg-white border border-red-200 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">⚠️</span>
        <h1 className="text-lg font-bold text-gray-900">หน้านี้แสดงผลไม่สำเร็จ</h1>
      </div>
      <p className="text-sm text-gray-600">
        ข้อมูลของคุณ<strong>ถูกบันทึกไว้แล้วบนเซิร์ฟเวอร์</strong> — ไม่ได้หายไปไหน กด “ลองแสดงใหม่” หรือรีเฟรชหน้าได้เลย
      </p>
      <pre className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-wrap break-words max-h-52 overflow-auto">
        {error?.message || "Unknown error"}{error?.digest ? `\n\n(digest: ${error.digest})` : ""}
      </pre>
      <div className="flex gap-2">
        <button onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
          ลองแสดงใหม่
        </button>
        <button onClick={() => location.reload()}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
          รีเฟรชหน้า
        </button>
      </div>
      <p className="text-[11px] text-gray-400">ถ้าเจอหน้านี้ ช่วยแคปข้อความสีแดงส่งให้ผม เดี๋ยวแก้จุดที่ผิดให้ตรงจุดครับ</p>
    </div>
  )
}
