"use client"
import { StageWork } from "../_StageWork"
export default function Page() {
  return <StageWork
    title="Purchase (จัดซื้อ) — Pull Material"
    subtitle="กรอก G.W. (น้ำหนัก) + Shipment date → ส่งให้ SCM ตัดสินใจ air"
    status="PENDING_PURCHASING"
    fields={[
      { key: "grossWeightKg", label: "G.W. (kg)", type: "number" },
      { key: "shipmentDate", label: "Shipment Date", type: "date" },
    ]}
    primary={{ label: "บันทึก → ส่ง SCM ตัดสินใจ", toStatus: "PENDING_SCM_DECISION" }}
  />
}
