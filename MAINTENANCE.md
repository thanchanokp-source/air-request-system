# คู่มือดูแลระบบ — Air Request System (สำหรับ IT)

เอกสารนี้สำหรับทีม IT ใช้ดูแล/deploy แอป **Air Request System** บน server
(ไม่ต้องเชี่ยวชาญ Next.js — ทำตาม 3-4 คำสั่งได้เลย)

---

## 1. ภาพรวมระบบ

| หัวข้อ | รายละเอียด |
|---|---|
| ชนิดแอป | Next.js (React + Node.js) — เหมือน GM74 |
| รันด้วย | **pm2** (ชื่อ process: `air-request`) |
| Node เวอร์ชัน | 20+ (ผ่าน nvm) |
| Port | **3003** |
| URL | http://172.16.7.24:3003 |
| โฟลเดอร์บน server | `/home/sysadmin/web/air-request-system` |
| Git (source) | GitLab: `https://gitlab.nanyangtextile.com/Thanchanok/air-request-system.git` |

### ระบบที่เชื่อมต่อ
| บริการ | ที่อยู่ | ใช้ทำอะไร |
|---|---|---|
| Database | demosupabase Postgres · schema **`air_req_new`** | เก็บข้อมูลทั้งหมด |
| File Storage | demosupabase Supabase Storage · bucket `air-request-attachments` | ไฟล์แนบ (INV/HAWB/PDF) |
| Email | Microsoft Graph / SMTP (Office365) | แจ้งเตือน approve/reject |

> ค่าเชื่อมต่อทั้งหมด (รหัส/คีย์) อยู่ในไฟล์ **`.env`** ในโฟลเดอร์โปรเจกต์ (ไม่อยู่ใน git)

---

## 2. เข้า server

```bash
ssh sysadmin@demosupabase.nanyangtextile.com
# หรือ mRemoteNG / PuTTY: Host 172.16.7.24, Port 22, User sysadmin
```

เข้าโฟลเดอร์โปรเจกต์:
```bash
cd /home/sysadmin/web/air-request-system
```

---

## 3. อัปเดตโค้ด (deploy เวอร์ชันใหม่)

เมื่อมีการแก้โค้ด + push ขึ้น GitLab แล้ว บน server รัน:

```bash
cd /home/sysadmin/web/air-request-system
git pull                 # ดึงโค้ดใหม่จาก GitLab
npm install              # (เฉพาะถ้ามี package ใหม่)
npm run build            # build เวอร์ชันใหม่
pm2 restart air-request  # รีสตาร์ทให้ใช้โค้ดใหม่
```

> ถ้า `git pull` ติด error เรื่อง certificate → รัน `git config http.sslVerify false` ครั้งเดียว

---

## 4. คำสั่ง pm2 ที่ใช้บ่อย

| ต้องการ | คำสั่ง |
|---|---|
| ดูสถานะทุกแอป | `pm2 list` |
| รีสตาร์ท | `pm2 restart air-request` |
| หยุด | `pm2 stop air-request` |
| เริ่ม | `pm2 start air-request` |
| ดู log สด | `pm2 logs air-request` |
| ดู log ย้อนหลัง 50 บรรทัด | `pm2 logs air-request --lines 50` |
| ล้าง log (ประหยัด disk) | `pm2 flush air-request` |
| บันทึกสถานะ (ให้ auto-start ตอน reboot) | `pm2 save` |

---

## 5. เช็คว่าแอปทำงานปกติไหม

```bash
pm2 list                          # status ต้องเป็น "online"
pm2 logs air-request --lines 30   # ดูว่ามี error ไหม + เห็น "✓ Ready"
curl -I http://localhost:3003     # ต้องได้ HTTP 200 หรือ 307
```

---

## 6. แก้ปัญหาเบื้องต้น

| อาการ | วิธีเช็ค/แก้ |
|---|---|
| เว็บเข้าไม่ได้ (site can't be reached) | `pm2 list` (online ไหม) · firewall: `sudo ufw allow 3003` |
| แอป crash / restart วนไม่หยุด (↺ พุ่ง) | `pm2 logs air-request --lines 50` ดู error แล้วแจ้งผู้ดูแลโค้ด |
| login ไม่ได้ / ข้อมูลไม่ขึ้น | เช็ค DB ต่อได้ไหม — ค่า DATABASE_URL ใน `.env` ถูกไหม |
| เปิดไฟล์แนบไม่ได้ | เช็ค SUPABASE_URL / SUPABASE_SECRET_KEY ใน `.env` |
| ดิสก์เต็ม | `df -h` · ล้าง log `pm2 flush` · แจ้งทีม server เคลียร์/ขยาย disk |
| build ไม่ผ่าน (node version) | ต้องใช้ Node 20+: `nvm use 20` ก่อน build |

---

## 7. โหมดปิดปรับปรุง (Maintenance Mode)

ปิด/เปิดได้จากในแอป (ไม่ต้องแตะ server):
1. เข้า `http://172.16.7.24:3003` → login ด้วยบัญชี **Admin**
2. เมนู **SETTINGS** → toggle **Maintenance Mode**
   - **เปิด** = ทุกคน (ยกเว้น admin) เห็นหน้า "ปิดปรับปรุงระบบชั่วคราว"
   - **ปิด** = ใช้งานได้ปกติ

---

## 8. ไฟล์ .env (ค่าเชื่อมต่อ)

อยู่ที่ `/home/sysadmin/web/air-request-system/.env` — **ห้าม commit ขึ้น git**

ตัวแปรสำคัญ:
| ตัวแปร | ใช้ทำอะไร |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | ต่อ Postgres (schema air_req_new) |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | ต่อ Storage (ไฟล์แนบ) |
| `NEXTAUTH_URL` / `APP_URL` | URL ของแอป (ต้องตรงกับ port ที่รัน) |
| `NEXTAUTH_SECRET` | กุญแจ session (เปลี่ยน = ทุกคน login ใหม่) |
| `AZURE_*` / `GRAPH_SENDER` / `SMTP_*` / `RESEND_API_KEY` | ส่งอีเมล |

> ถ้าแก้ `.env` → ต้อง `pm2 restart air-request` ให้ค่าใหม่มีผล

---

## 9. Backup (สำคัญ)

ข้อมูลจริงทั้งหมดอยู่ที่ **demosupabase (schema air_req_new)** + **Storage bucket**
แนะนำตั้ง backup ประจำ:
- **DB:** `pg_dump` schema `air_req_new` เป็นประจำ (รายวัน/สัปดาห์)
- **ไฟล์:** สำรอง bucket `air-request-attachments`

---

## 10. หมายเหตุ — ระบบเก่า (Cloud)

- เวอร์ชันเดิมบน Cloud (Vercel + cloud Supabase) = **ยังเปิดโหมดปิดปรับปรุงไว้** เป็น backup snapshot ณ วันย้าย
- ⚠️ **ห้ามปิด maintenance บน cloud** — ไม่งั้น user อาจไปใช้ DB เก่า → ข้อมูลแตกเป็น 2 ก้อน
- เก็บ cloud ไว้ 2-4 สัปดาห์ แล้วค่อยปิด/ลบทีหลัง

---

## 11. อัปเดต/แก้โค้ด (สำหรับผู้ดูแลโค้ด)

- โค้ดเป็น Next.js (App Router) + Prisma + TypeScript
- แก้บน PC → `git push` → บน server `git pull` + build + restart (ข้อ 3)
- ใช้ AI (Claude Code) ช่วยแก้/เพิ่มฟีเจอร์ได้ (แอปนี้พัฒนาด้วย AI มาตลอด)

---

*อัปเดตล่าสุด: หลังย้ายจาก Cloud → Server (demosupabase) เรียบร้อย*
