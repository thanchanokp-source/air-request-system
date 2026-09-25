// Full Pull RM data export — one row per PO, every column a report needs (est/actual/mode/FWD…).
// Lives here so any page (TRACKING today, others later) exports exactly the same workbook.
import { pullReqType } from "@/lib/pull-reqtype"
import { STATUS_LABEL } from "@/app/(dashboard)/pull-material/_StageWork"

const dstr = (v: any) => (v ? String(v).slice(0, 10) : "")
const earliestD = (arr: any[]) => { const t = arr.map(v => (v ? new Date(v).getTime() : NaN)).filter(n => !isNaN(n)); return t.length ? new Date(Math.min(...t)).toISOString().slice(0, 10) : "" }
const estOf = (r: any) => (r.items || []).reduce((a: number, i: any) => a + (Number(i.airFreightCost) || 0), 0)

export async function exportPullReport(rows: any[]) {
  if (!rows.length) return alert("ไม่มีข้อมูลให้ export")
    try {
      const ExcelJS: any = (await import("exceljs")).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet("Pull RM report")
      ws.columns = [
        { header: "DOCUMENT NO", key: "doc", width: 22 }, { header: "BU", key: "bu", width: 8 },
        { header: "TYPE", key: "type", width: 12 }, { header: "STATUS", key: "status", width: 20 },
        { header: "REQUESTER", key: "requester", width: 18 }, { header: "PURCHASER", key: "purchaser", width: 18 },
        { header: "BRAND", key: "brand", width: 14 }, { header: "SUPPLIER", key: "supplier", width: 26 },
        { header: "SO", key: "so", width: 16 }, { header: "PO NO", key: "po", width: 16 },
        { header: "QTY AIR", key: "qty", width: 12 }, { header: "UOM", key: "uom", width: 8 },
        { header: "INVOICE NO", key: "inv", width: 18 },
        { header: "COUNTRY", key: "country", width: 14 }, { header: "AIR PORT", key: "port", width: 10 },
        { header: "SEA PORT", key: "seaport", width: 12 }, { header: "INCOTERM", key: "incoterm", width: 10 },
        { header: "WEIGHT (KG)", key: "weight", width: 12 }, { header: "PACKAGE", key: "package", width: 14 },
        { header: "ETC", key: "etc", width: 12 }, { header: "NEED DATE", key: "needDate", width: 12 },
        { header: "MRD", key: "mrd", width: 12 }, { header: "SHIPMENT DATE", key: "shipDate", width: 14 },
        { header: "SHIP MODE (LG)", key: "mode", width: 14 }, { header: "MODE APPROVED", key: "amode", width: 14 },
        { header: "MODE REASON", key: "mreason", width: 26 },
        { header: "EST AIR (USD)", key: "est", width: 14 }, { header: "PRE COST (USD)", key: "pre", width: 14 },
        { header: "ACTUAL (USD)", key: "act", width: 14 }, { header: "LOCAL CHARGE (USD)", key: "local", width: 16 },
        { header: "DIFF (USD)", key: "diff", width: 12 }, { header: "CURRENCY TYPED", key: "cur", width: 14 },
        { header: "FWD", key: "fwd", width: 14 }, { header: "FWD RATE (THB/KG)", key: "rate", width: 16 },
        { header: "FWD SENT", key: "sent", width: 13 }, { header: "FWD PHASE", key: "phase", width: 10 },
        { header: "ACTUAL SOURCE", key: "src", width: 13 },
        { header: "MAWB", key: "mawb", width: 16 }, { header: "HAWB", key: "hawb", width: 16 },
        { header: "FLIGHT ETD", key: "etd", width: 12 }, { header: "FLIGHT ETA", key: "eta", width: 12 },
        { header: "CFM IN-HOUSE", key: "cfm", width: 13 }, { header: "CREATED", key: "created", width: 12 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E9E9" } }
      ws.views = [{ state: "frozen", ySplit: 1 }]

      for (const r of rows) {
        const its: any[] = r.items || []
        const d0 = its.find((x: any) => x.airFreightCost != null) || its[0] || {}
        const est = estOf(r)
        const pkgs = Array.isArray(r.packages) ? r.packages : []
        const pkgStr = pkgs.length ? pkgs.map((p: any) => `${p.qty} ${p.uom}`).join(", ") : (d0.cartons ?? "")
        const byPo: Record<string, { qty: number; uoms: Set<string>; sos: Set<string>; vend: Set<string>; brand: Set<string> }> = {}
        its.forEach(it => {
          const po = it.poNoDoc || "-"
          const g = (byPo[po] ||= { qty: 0, uoms: new Set(), sos: new Set(), vend: new Set(), brand: new Set() })
          g.qty += Number(it.pullMaterialQty) || 0
          if (it.bomUom) g.uoms.add(it.bomUom); if (it.soNoDoc) g.sos.add(it.soNoDoc)
          if (it.vendorName) g.vend.add(it.vendorName); if (it.brand) g.brand.add(it.brand)
        })
        for (const po of Object.keys(byPo)) {
          const g = byPo[po]
          ws.addRow({
            doc: r.documentNo, bu: r.bu, type: pullReqType(r), status: STATUS_LABEL?.[r.status] || r.status,
            requester: r.requesterName || "", purchaser: r.purchaserName || r.purchaserEmail || "",
            brand: [...g.brand].join(", "), supplier: [...g.vend].join(", "),
            so: [...g.sos].join(", "), po, qty: g.qty || "", uom: [...g.uoms].join(", "),
            inv: (r.poInvoices || {})[po] || r.invoiceNo || "",
            country: d0.country || "", port: d0.port || "", seaport: d0.seaPort || "", incoterm: d0.incoterm || "",
            weight: d0.weight != null ? Number(d0.weight) : "", package: pkgStr,
            etc: dstr(d0.etc), needDate: dstr(d0.needDate),
            mrd: earliestD(its.flatMap(i => [i.shipmentDate, i.mrdDate, i.mrdNeedDate, i.mrd2])),
            shipDate: earliestD(its.map(i => i.shipmentDate)),
            mode: r.shipMode || "", amode: r.approvedMode || "", mreason: r.shipModeReason || "",
            est: est || "", pre: r.preCost != null ? Number(r.preCost) : "",
            act: r.actualAir != null ? Number(r.actualAir) : "",
            local: r.localChargeTh != null ? Number(r.localChargeTh) : "",
            diff: r.actualAir != null ? Math.round(((Number(r.actualAir) || 0) - est) * 100) / 100 : "",
            cur: r.actualCurrency || "", fwd: r.fwdName || r.preCostFwd || "",
            rate: r.fwdRateThbPerKg != null ? Number(r.fwdRateThbPerKg) : "",
            sent: dstr(r.fwdSentAt), phase: r.fwdPhase || "", src: r.actualSource || "",
            mawb: r.mawbNo || "", hawb: r.hawbNo || "", etd: dstr(r.flightEtd), eta: dstr(r.flightEta),
            cfm: dstr(r.cfmInHouseDate), created: dstr(r.createdAt),
          })
        }
      }
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url
      a.download = `PullRM_report_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) { alert("Export ไม่สำเร็จ: " + String((e as any)?.message || e).slice(0, 160)) }
  }
