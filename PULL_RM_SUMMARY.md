# Pull RM (RM REQ AIR) — Working Summary / Handoff

> เอกสารสรุปสำหรับคุยงาน **Pull Material (RM REQ AIR)** ต่อในเซสชันใหม่
> (แยกจากโมดูล **Claim Air** ซึ่งเป็นคนละส่วน)

---

## 1. Stack & Deploy workflow (สำคัญมาก)

- Next.js 16.2.6 · React · TypeScript · Prisma v5 · NextAuth · self-hosted Supabase (Postgres)
- **Build ต้องใช้ Turbopack** (`next build --turbopack`) — webpack build ทำให้ RSC manifest พัง ทุกหน้าโหลดไม่ขึ้น
- Project (Windows): `C:\Projects\air-request-system`
- Server: `172.16.7.24` → SSH `sysadmin@demosupabase` → `~/web/air-request-system`

**คำสั่ง (แยกเครื่องเด็ดขาด):**
- **Windows PowerShell** (ที่เดียวที่ push): `git add … ; git commit -m "…" ; git push gitlab HEAD`
- **Server SSH** (ที่เดียวที่ deploy): `git pull origin main ; bash deploy.sh`
  - ถ้าแก้ schema: `PUSH_DB=1 bash deploy.sh`
- deploy.sh ทำ `rm -rf .next` ก่อน build (clean build) + มี `src/instrumentation.ts` กัน unhandledRejection crash-loop

---

## 2. โครงสร้าง & concept

- `requestType` = **SCM | PURCHASING | SAMPLE** · doc prefix: `SCM_ / PULL_ / MER_`
- helper `pullReqType(r)`: SAMPLE ถ้า requestType SAMPLE หรือ docNo `MER_` · PURCHASING ถ้า PURCHASING หรือ `PULL_` · else SCM
- MER group regex: `/^(MER_|DVM_MER|VP_MER)/`
- **2 branch flow:**
  - **SCM**: request → SCM decision → VP SCM → President
  - **PC (Purchasing)**: request → PC decision → DVM Pur → VP Pur (PC approver = single คนต่อ BU, route by BU)
- **SAMPLE (MER)**: MER คีย์ → PENDING_PURCHASING → จัดซื้อกรอก → **auto-approve** → LG (booking + actual)
- **CBM (sea):** `<500=1 · ≤700=2 · ≤1000=3 · >1000=5`
- EXCHANGE_RATE = 32.5 · แสดงผลเป็น **USD**
- People Finder = **OFF** (ใช้ master/registered users เท่านั้น)

**ไฟล์หลัก:**
- `src/lib/pull-courier.ts` — `pullLandedCost()` (Air/Sea/Courier landed cost USD), `lcCbm`, sea = MAX rate
- `src/components/pull/LandedCostCompare.tsx` — การ์ดเทียบ Air→Sea→DHL→Market (pastel, USD)
- `src/lib/pull-reqtype.ts`, `src/lib/pull-requesters.ts` (`buildRequesters` → displayOf), `src/components/pull/ComboBox.tsx`
- `src/lib/pull-notify.ts` — `poUsernameToEmail("JUTHALAK POUKNOI")→"juthalak.p@nanyangtextile.com"`
- Pages: `src/app/(dashboard)/pull-material/{request,purchase,documents,dashboard,files,tracking}/page.tsx`

---

## 3. ✅ ทำเสร็จ session ที่แล้ว (ตรวจ `git status` ว่า deploy ครบไหม)

**MER Sample form** (`pull-material/request/page.tsx`)
- Qty มีหน่วย **PCS**
- ช่อง **SO** (ComboBox) กรองตาม brand/supplier/item ที่เลือก (API `bom?sampleSo=1`)
- ลำดับ: **SO → Brand → Supplier → Item Desc → Qty → +เพิ่ม** (แถวเดียว)
- ตัด remark รายบรรทัดออก (เหลือ remark รวมทั้งใบ)

**Purchase page** (`pull-material/purchase/page.tsx`)
- เอกสาร MER: ซ่อน Mode (Regular/Irregular) → auto-approve · หัวข้อ "งานจาก MER/SCM" ตามเอกสาร
- ปุ่มแนบ **INV** (category INV) + Packing List (category PACKING)
- **เห็นเฉพาะเอกสารตัวเอง**: MER → purchaserEmail · SCM → POUSERNAME→email · no-POUSERNAME → pool (จัดซื้อทุกคนเห็น) · admin เห็นหมด
- แท็บ **SCM / MER** (source split) · ปุ่ม **FW** (เฉพาะใบ pool) · โชว์ **brand** · ปุ่ม **Open** · ตัดป้าย Regular/Irregular

**อื่นๆ**
- **CBM >1000 = 5** (ทั้ง `pull-courier.ts` + request page)
- **Tracking**: normalize ชื่อผู้ขอด้วย `buildRequesters/displayOf` (sudarat = sudarat.r)

---

## 4. 🎨 Design ที่คุยไว้ — ยังไม่ทำ

**เลือก mode ขนส่ง air/sea/courier (ที่ compare box)**
- **PC approver เป็นคนเลือก** (single ต่อ BU → ไม่ชน) ที่หน้า approval
- ยอดที่อนุมัติ = **est ของ mode ที่เลือก**
- เก็บ **history ทุก mode** (append-only) — เอาไปวิเคราะห์อนาคต
  - schema ร่าง: `doc, so, bu, brand, port, weight, chosenMode(AIR/SEA/COURIER), estAir, estSea, estCourier, carrier(DHL/FEDEX), chosenBy, chosenAt`
- **courier ไม่มี HAWB** → actual แยกทาง air

**Logistics actual entry**
- **Phase 1 (ตอนนี้):** LG กรอก actual **by doc** เอง
- **Phase 2 (อนาคต):** FWD กรอกผ่าน **Excel template** → เมล alert หา Forwarder → FWD กรอก → LG อัปไฟล์กลับเข้าเอกสาร
  - ออกแบบให้ **แหล่งกรอก actual สลับได้** (LG วันนี้ / FWD วันหน้า) โดยไม่รื้อ

---

## 5. ⏸ คำถามค้าง (รอหัวหน้า / ต้องเคาะ)

1. เปลี่ยน mode หลัง PC อนุมัติได้ไหม → re-approve หรือ LG override + log?
2. FWD กรอกฟิลด์อะไรบ้าง (rate/charge/HAWB/ETD-ETA)?
3. 1 เอกสาร = 1 FWD หรือหลาย FWD?
4. ส่ง template แบบแนบไฟล์ในเมล หรือลิงก์กรอกออนไลน์?

---

## 6. Constraints (ยังมีผล)

- jariya.t: ห้ามแก้ ยกเว้นเอา CLAIM_PROCUREMENT ออก
- People Finder OFF · master/registered users only
- git push บน Windows เท่านั้น · git pull + deploy.sh บน server เท่านั้น
- nidcha **ห้าม**เป็น VP_PUR ใน RM REQ AIR

---

_อัปเดตล่าสุด: 2026-09-22 — ให้เซสชันใหม่อ่านไฟล์นี้ก่อนเริ่มคุยงาน Pull RM_
