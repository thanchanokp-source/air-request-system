# Changelog — Air Request System

บันทึกการแก้ไขรายวัน (ล่าสุดอยู่บนสุด) · commit history ดูเพิ่มได้ที่ `git log --oneline`

---

## 2026-08-03

### ฟีเจอร์ใหม่
- **NYK Direct Import (ทุก BU)** — เมนู NYK IMPORT: อัปไฟล์ → ข้ามทุกขั้น ส่งตรง SCM NYK · คำนวณ actual จาก Total HAWB อัตโนมัติ · แนบหลายไฟล์ · เลือก BU · จบแล้วข้าม President → Accounting
- **LG Forward** — LG กรอกบางส่วนแล้วส่งต่อให้ลูกน้อง (magic-link) มากรอกต่อ + ตั้งทีม LG + 8 ลูกน้อง (forward target)
- **EA สกุลเงิน** — Master Rate รับ rate USD/kg + FX (THB/USD, VND/USD) · toggle THB⇄VND (list) · PDF เป็น VND · snapshot ล็อกต่อใบ
- **GW แนบไฟล์ตอน upload** (MER เลือก claim เอง)

### ปรับ workflow / logic
- **SCM NYK claim alert** → ยิงเฉพาะเมื่อ LG ใส่ INV + Actual air ครบ (hold ตอนเข้า claim, ยิงตอน LG Save & Send)
- **LG เห็นเอกสารหลัง VP SCM approve** (เดิมเห็นตั้งแต่ SCM) — คิว + weekly reminder
- fix: กด Approve แล้ว claim splits (+delay detail) ไม่ถูกเซฟ → เซฟทันที
- fix: การ์ด LOGISTICS = 0 ทั้งที่รอ LG → นับ SO ที่ LG ยังไม่เสร็จ (parallel)

### การแสดงผล / filter
- Delay code + detail โชว์ให้ approver (approvals + VP SCM table + card) · PDF เอาแค่ delay group
- Status by position (`PENDING_MER … PENDING_LG_BOOKING/CLAIM / PENDING_CLAIM … COMPLETED`) + rule: ใส่ air แล้ว claim ยังไม่จบ = PENDING_CLAIM
- Stage filter (AIR REQUESTS + Approvals, scope ตาม BU) · Dashboard: คอลัมน์ STATUS
- Admin เห็นทุก doc ในหน้า Approvals + ค้นหาว่าเอกสารค้างที่ใคร (search ชื่อ/เมล)
- เพิ่มคอลัมน์ BU ใน SO detail · chip โชว์ BU จริง · ยุบ attachment เป็น "+N" (แถวเดียว)
- PDF: เลข HAWB/INVOICE ยาวไม่ล้นทับ · dropdown filter ขยายตามข้อความ (ไม่ตัดคำ)

### Users / สิทธิ์
- fix login: อีเมลตัวพิมพ์ใหญ่ login ได้ (case-insensitive)
- เพิ่ม sriputtra.r เป็น Sourcing (เหมือน Jarunee)
- jariya: ถอด LG → ใส่กลับ (NYG/EA/TRM/GW) · LG เห็น Master Description/Rate

### อื่นๆ
- EA launch (เอา "soon" ออก) · ALL FILES → REPORT · LG excel: `Total HAWB#` → `EXPENSE/HAWB`
- fix: EA logistics (Quynh) เห็น EA ไม่ใช่ NYG · SCM Import พังในเบราว์เซอร์ (buffer→array)
- สคริปต์ backup master data · เตือน GW74 แชร์ DB เดียวกับ air-request

### DB (ผ่าน pooler)
- columns ใหม่: `nykDirect`, `lgForward*`, `MasterFreightRate.bu/currency`, `AirRequest.vndRate`

### ค้าง / รอตัดสินใจ
- Date parsing: MER พิมพ์ `03/08/2026` (3 ส.ค.) → Excel ตีเป็น 8 มี.ค. (real date cell) — แก้ที่ template (คอลัมน์วันที่เป็น text) + แก้ข้อมูล doc เดิม
- LG workflow by-brand / HAWB ข้ามเอกสาร (รอ scope)
