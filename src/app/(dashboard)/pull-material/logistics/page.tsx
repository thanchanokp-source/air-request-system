"use client"
import { StageWork } from "../_StageWork"
export default function Page() {
  return <StageWork
    title="Logistics — Pull Material"
    subtitle="Fill In-House Air/Sea + Est Air/Sea + Lead time + Air Freight cost → forward to Purchasing"
    status="PENDING_LOGISTICS"
    fields={[
      { key: "inHouseAirDate", label: "In-House Air", type: "date" },
      { key: "inHouseSeaDate", label: "In-House Sea", type: "date" },
      { key: "estAir", label: "Est Air (THB)", type: "number" },
      { key: "estSea", label: "Est Sea (THB)", type: "number" },
      { key: "leadTimeAir", label: "Lead Air", type: "text" },
      { key: "leadTimeSea", label: "Lead Sea", type: "text" },
      { key: "airFreightCost", label: "Air Freight cost (THB)", type: "number" },
    ]}
    primary={{ label: "Save → Send to Purchasing", toStatus: "PENDING_PURCHASING" }}
  />
}
