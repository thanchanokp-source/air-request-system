"use client"
import { StageWork } from "../_StageWork"
export default function Page() {
  return <StageWork
    title="Approval — Pull Material"
    subtitle="DVM → VP → EVP (เฟสนี้ placeholder: กดอนุมัติข้าม chain — master คนอนุมัติใส่ทีหลัง)"
    status="PENDING_APPROVAL"
    fields={[]}
    primary={{ label: "อนุมัติ", toStatus: "APPROVED", color: "#16a34a" }}
    secondary={{ label: "ตีกลับ SCM", toStatus: "PENDING_SCM_DECISION" }}
  />
}
