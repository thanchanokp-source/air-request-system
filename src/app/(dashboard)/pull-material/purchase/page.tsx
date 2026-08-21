"use client"
import { StageWork } from "../_StageWork"
export default function Page() {
  return <StageWork
    title="Purchase — Pull Material"
    subtitle="Fill G.W. (weight) + Shipment date → send to SCM for the air decision"
    status="PENDING_PURCHASING"
    fields={[
      { key: "grossWeightKg", label: "G.W. (kg)", type: "number" },
      { key: "shipmentDate", label: "Shipment Date", type: "date" },
    ]}
    primary={{ label: "Save → Send to SCM", toStatus: "PENDING_SCM_DECISION" }}
  />
}
