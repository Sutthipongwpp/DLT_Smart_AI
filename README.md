# DLT Smart AI

เว็บผู้ช่วยตอบคำถามงานกรมการขนส่งทางบก ใช้ Gemini API ผ่าน backend บน Vercel

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเว็บ (ไม่มี API key อยู่ในไฟล์นี้) |
| `api/chat.js` | Serverless function ที่เก็บคีย์และ system prompt แล้วเรียก Gemini ให้ |
| `vercel.json` | Security headers |
| `.env.example` | ตัวอย่างตัวแปรที่ต้องตั้ง |

หน้าเว็บส่งคำถามไปที่ `/api/chat` → ฟังก์ชันบน Vercel แนบ API key แล้วส่งต่อให้ Gemini → ส่งคำตอบกลับ
คนที่เปิดดู source ของหน้าเว็บจะไม่เห็นคีย์

## วิธี Deploy บน Vercel

1. อัปโหลดโฟลเดอร์นี้ขึ้น GitHub (ไฟล์ `.env*` ถูกกันไว้ใน `.gitignore` แล้ว)
   หรือใช้คำสั่ง `npx vercel` ในโฟลเดอร์นี้
2. ที่ vercel.com → **Add New Project** → เลือก repo นี้ (Framework Preset: **Other**)
3. ไปที่ **Settings → Environment Variables** แล้วเพิ่ม:
   - `GEMINI_API_KEY` = คีย์จาก Google AI Studio (**จำเป็น**)
   - `ALLOWED_ORIGINS` = โดเมนของเว็บ เช่น `https://dlt-smart-ai.vercel.app` (แนะนำ: ใช้กันเว็บอื่นมาเรียก API ของเรา)
4. กด **Redeploy** ทุกครั้งหลังเปลี่ยน Environment Variables

## ทดสอบในเครื่อง

1. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ `GEMINI_API_KEY`
2. รัน `node dev-server.js` แล้วเปิด http://localhost:3000 (ไม่ต้องติดตั้งอะไรเพิ่ม)

ใช้ `dev-server.js` แทน `npx vercel dev` เพราะบน Windows คำสั่ง `vercel dev` มักเจอ error `EPERM ... symlink`
ถ้าเปิด `index.html` ตรง ๆ โดยไม่รันเซิร์ฟเวอร์ แชทจะใช้คำตอบสำรองแบบออฟไลน์ เพราะไม่มี `/api/chat`

## การป้องกันใน `api/chat.js`

- API key อ่านจาก Environment Variable เท่านั้น
- System prompt อยู่ฝั่งเซิร์ฟเวอร์ ผู้ใช้แก้ไขไม่ได้ และนำ API ไปใช้งานอย่างอื่นไม่ได้
- จำกัดคำถามไม่เกิน 1,000 ตัวอักษร และประวัติแชทย้อนหลังไม่เกิน 10 ข้อความ
- จำกัด 15 คำถามต่อนาทีต่อ IP (ทำงานแยกในแต่ละ instance จึงกันได้แค่การยิงถี่ๆ)
- ตรวจ Origin เมื่อตั้งค่า `ALLOWED_ORIGINS`
- ไม่ส่งข้อความ error จาก Google กลับไปให้ผู้ใช้เห็น

## แนะนำเพิ่มเติมใน Google Cloud / AI Studio

- ตั้ง **API restrictions** ให้คีย์ใช้ได้แค่ "Generative Language API"
- ตั้ง **งบ/โควต้า (Budget alert / Quota)** เพื่อไม่ให้ค่าใช้จ่ายบานปลายถ้ามีคนใช้เยอะผิดปกติ
