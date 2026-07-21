# Version Notes — Air Request System

บันทึกการแก้ไขรายวัน (changelog) เก็บว่าแต่ละวันทำ/แก้อะไรไปบ้าง

**วิธีใช้:** เพิ่มบล็อกวันใหม่ไว้**บนสุด** (ใหม่สุดอยู่บน) ใช้หัวข้อ `## YYYY-MM-DD` แล้วจัดกลุ่มตามหมวด
(ที่มาของรายละเอียด = git log — ดูข้อความ commit เต็มได้ด้วย `git log`)

---

## 2026-07-21

### 🌏 EA business unit (flow เดียวกับ NYG, เปลี่ยนแค่ merch 2 คน + LG)
- Sign-up: เพิ่ม BU **EA** ใน dropdown → MER สมัครเป็น EA ได้ (role `MER_EA`)
- เพิ่ม 3 user: **sally** = ADVM (`DVM_MER_EA`), **peshan.p** = DVM (`VP_MER_EA`), **quynh.nguyen** = Logistics EA
- Flow: create → ADVM(sally) → DVM(peshan) → **เข้าเส้น NYG** (SCM kimita → VP SCM saji → claim → president) ที่ใช้คนร่วมกัน
- **Logistics แยกตาม BU**: EA = quynh, NYG = aoyjai (bu-scoped notify + queue) — ไม่ปนกัน
- **Procurement claim** = คนเดิม NYG (jarunee/prapakorn/jariya ปรับ bu=ALL ให้ครอบ EA; GW ไม่ใช้ role นี้จึงปลอดภัย)
- **Commercial claim EA** → ทีม merch EA (sally/peshan) ผ่าน assignedDvmMer/assignedVpMer + เพิ่ม DVM_MER_EA/VP_MER_EA ใน COMMERCIAL role map

### 🔁 Claim — การส่งต่อ / การแจ้งเตือน (routing & email)
- **Cross-BU fix (สำคัญ):** role ที่ตั้ง `bu="ALL"` (Claim-Production, VP-Production, Accounting, SCM_NYG) เคยถูกตัดออกเพราะกรอง `bu` แบบตรงตัว → แก้ให้ match `[bu, "ALL"]` ทุกจุด (claim entry, next-priority cascade, LG-files, accounting alert, approver chain, by-role picker)
- **Production route ตาม factory G-group:**
  - queue แยกตาม G — rushan เห็นเฉพาะ G1/G3, pk เห็นเฉพาะ G2/G4 (ทั้งหน้า APPROVALS และในเอกสาร)
  - EVP = role `VP_PRODUCTION` (khomkrit, `claimDepartment="ALL"` ครอบทุก G) — เดิม chain ผูกกับ CLAIM_PRODUCTION prio 2 ที่ไม่มี user → picker หาไม่เจอ
  - person picker ตัด suffix `_G1G3/_G2G4` ก่อนเทียบ role
  - EVP รวมทุก forward ที่ส่งมาหาตัวเอง (G1/G3 + G2/G4) เป็นหน้าเดียว, อนุมัติเท่าที่มาถึงได้เลยไม่ต้องรอครบ
- **LG กรอกเสร็จ → alert เฉพาะคนที่รับผิดชอบเอกสารนั้น** (Commercial→DVM ที่ถูกเลือก, Purchasing prio-1, Production ตาม G ฯลฯ) ไม่ blast ทุกคน
- **NYK claim:** กันเมล EVP/CR ไว้จน approver อนุมัติครบทุกแบรนด์ก่อน แล้วเด้งรอบเดียว
- ลบเมลซ้ำ `[Master needs data]` (เหลือ `[WT Charge Missing]` ที่ละเอียดกว่า)
- เมลแสดง **ทุกแบรนด์** ในเอกสาร (ไม่ใช่แบรนด์แรกแบรนด์เดียว)

### 🖥️ หน้าจออนุมัติ (Approve screens)
- เพิ่ม **Card/Table view toggle** แบบ NYG ให้ครบ: NYK claim, VP claim, GW DPM/GM, Claim Next Approver, CLAIM GW (สร้าง component กลาง `SoApprovalTable`)
- **GW DPM/GM:** เพิ่ม "Back to Merchandise" (ทั้งเอกสาร + ราย style) + backend action `back_to_mer_style_gw` (style ที่อนุมัติแล้วคงสถานะตอน resubmit); จัดปุ่ม Approve ไว้ซ้าย Back ไว้ขวา; ใช้คำเต็ม "Back to Merchandise"
- เพิ่มคอลัมน์ **BRAND + PO GARMENT** ในตาราง SO ของ claim

### 📁 ALL FILES
- ตัวนับ Status ไม่นับ test doc (ให้ตรงกับ list)
- ปุ่ม (admin) เปิด/ปิดแสดง test doc + hint ในหน้าว่างว่ามี test doc ซ่อนอยู่

### 📄 PDF
- ลายเซ็น = เฉพาะ**คนสุดท้ายของแต่ละ chain/claim** (VP MER, VP SCM, EVP claim ต่อแผนก, President) — ยุบตัวกลาง
- แก้คอลัมน์ตาราง DETAILS ทับกัน (ขยาย STYLE/DESC/FACTORY, ลด font หัวตาราง)
- CLAIM BY DEPARTMENT บวกค่าดิบก่อนปัดครั้งเดียว → ตรงกับ TOTAL (เดิมปัดทีละแถวทำให้เกิน 1 บาท)

### 🧩 Master / Template
- Master descriptions 17 รายการ + fuzzy match (Levenshtein ≥85%, จัดลำดับคำสลับได้) ก่อน hold/alert
- เพิ่ม `JACKET,Hoodie` ใน master + สคริปต์ปลดล็อกเอกสารที่ค้าง (`release-held.js`)
- Template มี dropdown DESCRIPTION สดจาก master (เตือนอย่างเดียว, อัปเดตทุกครั้งที่โหลด)

### 🗄️ Data / Users / Backup
- `seed-master.js` (rates + descriptions) และ `seed-users.js` (รายชื่อครบตาม BU, priority, multi-BU=ALL) — re-run เพื่อ restore ได้
- Master approver ไม่มี password (login ผ่าน magic-link / admin View-as); admin + test MER (atsadet.n NYG, apisit.n GW) มี password
- `jariya.t` = ADMIN + CLAIM_PROCUREMENT (Purchasing, NYG)
- Backup/restore ทั้ง DB (Prisma JSON snapshot, restore เรียงตาม FK); ตัด BillOfMaterial 445k แถวออกจาก snapshot
- ลบ MasterGMTType + MasterPort (ไม่ใช้แล้ว)
- เพิ่ม role **Visitor** (ดูอย่างเดียวทุก BU)
- Admin import เอกสารเก่าเป็น COMPLETED (ไม่ผ่าน flow/ไม่ส่งเมล) + เลือก BU + ใช้ค่า WEIGHT(KG) จากไฟล์

### 🧹 อื่นๆ
- ลบปุ่ม "PDF (whole document)" ออกจากหน้าเอกสาร (PDF ยังโหลดได้ที่ ALL FILES)
- จัดปุ่ม New Request ไปชิดขวาข้าง Import History
- **ล้าง data NYG** เตรียมให้ผู้ใช้เริ่มเทสจริง

---

<!-- เพิ่มวันใหม่ไว้เหนือเส้นนี้:
## YYYY-MM-DD
### หมวด
- รายการแก้ไข
-->
