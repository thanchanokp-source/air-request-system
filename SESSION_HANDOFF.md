# Air Request System — สรุปงาน & งานค้าง (Handoff)

> เอกสารสรุปการเปลี่ยนแปลงล่าสุด + ขั้นตอน deploy + checklist ทดสอบ
> โค้ดทั้งหมด commit + push แล้ว (ล่าสุด `21f630b`)

---

## 🔴 งานค้างสำคัญ — ต้องรันใน terminal (ครั้งเดียว)

ฟีเจอร์ **SCM NYK 3-role** เพิ่ม column ใหม่ใน DB (`scmNykApproverToken`, `scmNykEvpToken`)
ถ้ายังไม่รัน → แอป error ตอนสร้างเอกสารใหม่ + login ผ่าน magic-link

```powershell
cd C:\Projects\air-request-system
npx prisma db push
```

- ขึ้น `already in sync` = รันไปแล้ว ไม่ต้องทำอะไรต่อ
- Deploy: ทุกอย่าง push ขึ้น Vercel แล้ว (auto-build) — hard refresh เบราว์เซอร์ `Ctrl+Shift+R` เพื่อโหลดโค้ดใหม่

---

## ✅ ตั้งค่าในแอป (หน้า Users) — หลัง deploy

- [ ] สร้าง user role **"Claim-SCM NYK Action Approver"** (ใส่ priority)
- [ ] ตรวจว่ามีครบ: **Claim-SCM NYK EVP** · **Claim-SCM NYK User** · **MER (GW)**
- [ ] user ฝั่ง Claim ต้อง tag **claimDepartment ให้ถูก** (GW-person=GW, supplier=SUPPLIER) — ไม่งั้น notify/สิทธิ์จะไม่แยก

---

## 🧪 Checklist ทดสอบ — GW Claim NYK (flow ใหม่)

1. LG กรอก HAWB / Actual → forward เข้า Claim
2. **SCM NYK Approver** กด Approve → เมลเด้งหา **EVP + SCM User** (พร้อมตาราง LG data: SO/INV/HAWB/Actual/NYK Claim)
3. **EVP** approve + **SCM User** ใส่ CR NO → SO ไป Accounting (ต้องครบทั้ง 2)
4. **Back to MER**: claim dept กดปุ่ม → ใส่เหตุผล → เมลถึง MER → MER แก้ claim dept → **Resubmit to Claim**
5. **Batch approve**: ติ๊กหลาย SO → กด Approve ทีเดียว

---

## 📋 Flow อ้างอิง — GW Claim (NYK) แบบ 3-role

```
SCM_NYK_APPROVER (approve)  →  alert พร้อมกัน (parallel):
   ├─ SCM_NYK_EVP      → approve
   └─ SCM_NYK (User)   → ใส่ CR NO (1 ต่อ document)
→ SO ไป Accounting เมื่อ EVP approve + CR ครบ (ขาดข้อใด = ค้างที่ Claim)
```

**หน้าที่แต่ละ role (ฝั่ง NYK):**
| Role | Action | หน้าที่ |
|---|---|---|
| SCM_NYK_APPROVER | Approver | approve ตัวแรก → trigger alert |
| SCM_NYK_EVP | Approver | approve ต่อ (ต้องรอ approver ก่อน) |
| SCM_NYK (User) | User | ใส่ CR NO อย่างเดียว (ไม่มีปุ่ม approve) |

**Claim depts อื่น (parallel, ต่างคนต่างทำ):**
- SCM_NYG → approve split ตัวเอง
- CLAIM_GW → approve split GW/SUPPLIER (แยกตาม `claimDepartment` ของ user)

---

## 📦 สิ่งที่ทำเสร็จใน session นี้ (deploy แล้ว)

| หมวด | รายละเอียด |
|---|---|
| **SCM NYK 3-role** | Approver → EVP ∥ CR (decoupled) + สถานะ `APPROVER_PASSED` / `DEPT_APPROVED` |
| **Batch approve** | ติ๊กหลาย SO → approve ทีเดียว (รองรับ GW claim) |
| **Back to MER** | claim reject → กลับหา MER แก้ claim dept → Resubmit + alert email |
| **Notify by dept** | GW ≠ SUPPLIER แยกผู้รับตาม `claimDepartment` (ไม่ส่งข้ามกัน) |
| **Alert + LG data** | เมลแนบตาราง INV/HAWB/Actual/Claim amount |
| **CR NO** | 1 ต่อ document · เพิ่ม column CR NO ในไฟล์ Export |
| **HAWB#** | fix บันทึก `hawbNo` ตอน LG confirm + แสดงในตาราง claim detail |
| **Attach by document** | GW claim แนบไฟล์ระดับเอกสาร (ไม่ใช่ราย SO) |
| **CLAIM DEPT column** | แสดงทุก split + % (เช่น `SCM NYK 50% · SCM NYG 50%`) |
| **My Claim** | หน้า Approvals โชว์ยอด claim แผนกตัวเอง (badge + column) |
| **i18n** | แปล UI + email + API messages เป็นอังกฤษทั้งแอป |
| **LG state fix** | reset ต่อเอกสาร (ไม่ค้างข้ามเอกสาร) + ปุ่มล้างข้อมูล GW |
| **Region** | ย้าย Vercel เป็น syd1 (ใกล้ Supabase) |

---

## ⚙️ คำสั่ง terminal ที่ใช้บ่อย

```powershell
# ทำงานที่โฟลเดอร์โปรเจกต์เสมอ
cd C:\Projects\air-request-system

# Deploy (Vercel auto-build จาก git push)
git add -A
git commit -m "ข้อความ commit"
git push

# ปรับ schema DB (เมื่อแก้ prisma/schema.prisma)
npx prisma db push

# เช็ค type ก่อน push
npx tsc --noEmit

# build ทดสอบ local
npm run build
```

> ⚠️ `npx prisma db push` ต้องรัน **ก่อน** deploy โค้ดที่ query column ใหม่ ไม่งั้น query พังทั้งแอป

---

## 📝 หมายเหตุ / ข้อจำกัด

- เอกสารเก่าที่สร้าง**ก่อน** db push จะไม่มี token ใหม่ (approver/evp) — ต้องอัปโหลดเอกสารใหม่เพื่อทดสอบ magic-link ครบ 3 role
- คอลัมน์ REASON เป็นข้อมูลที่ MER พิมพ์เอง — ระบบไม่แปล (ขึ้นตามที่กรอก)
- HAWB# / INV ที่ค้างในเอกสารเก่าที่แก้ก่อน fix จะไม่ขึ้นย้อนหลัง — กด 🗑 ล้างข้อมูล หรือใช้เอกสารใหม่
- Cross-doc: HAWB ข้ามเอกสารยังไม่รองรับ (1 HAWB อยู่ใน doc เดียว)
