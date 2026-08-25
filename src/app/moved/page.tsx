import Image from "next/image"

const NEW_URL = "https://demoairrequest.nanyangtextile.com/login"

export default function MovedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #bfdbfe 0%, #e0e7ff 50%, #ddd6fe 100%)" }}>
      <div className="relative w-full max-w-md">
        <div className="flex justify-center relative z-10">
          <div className="w-24 h-24 rounded-full bg-white shadow-lg flex items-center justify-center" style={{ marginBottom: "-48px" }}>
            <Image src="/LOGO.png" alt="Nan Yang Textile" width={80} height={80} className="object-contain" unoptimized />
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl px-8 pt-16 pb-8 text-center">
          <div className="text-4xl mb-2">🔗</div>
          <h1 className="text-xl font-bold text-gray-800">ระบบย้ายไปลิงก์ใหม่แล้ว</h1>
          <p className="text-sm text-gray-500 mt-2">The system has moved to a new address. Please use the new link below and update your bookmark.</p>

          <a href={NEW_URL}
            className="mt-6 inline-block w-full py-3 rounded-xl text-white font-semibold text-sm"
            style={{ background: "linear-gradient(90deg, #1e3a8a, #3b82f6)" }}>
            ไปที่ลิงก์ใหม่ / Go to new link →
          </a>

          <p className="mt-4 text-xs text-gray-400 break-all">{NEW_URL}</p>
        </div>
      </div>
    </div>
  )
}
