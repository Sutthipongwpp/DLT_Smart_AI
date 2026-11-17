// Vercel Serverless Function: POST /api/chat
// เก็บ GEMINI_API_KEY ไว้ฝั่งเซิร์ฟเวอร์เท่านั้น (ตั้งค่าใน Vercel > Settings > Environment Variables)
// ผู้ใช้หน้าเว็บจะไม่มีทางเห็นคีย์

const GEMINI_MODELS = (process.env.GEMINI_MODELS ||
  "gemini-3.1-flash-lite,gemini-3-flash-preview,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-lite-latest")
  .split(",").map(s => s.trim()).filter(Boolean);
const GEMINI_TIMEOUT_MS = 20000;

// ขีดจำกัดเพื่อกันการใช้งานเกินจำเป็น / ถูกนำไปใช้ผิดวัตถุประสงค์
const MAX_MESSAGE_CHARS = 1000;   // ความยาวคำถามต่อครั้ง
const MAX_HISTORY_TURNS = 10;     // จำนวนข้อความย้อนหลังที่ส่งให้ AI
const MAX_HISTORY_CHARS = 4000;   // ความยาวต่อข้อความในประวัติ
const RATE_LIMIT = 15;            // จำนวนคำถามสูงสุดต่อ IP ...
const RATE_WINDOW_MS = 60 * 1000; // ... ต่อ 1 นาที

// System prompt อยู่ฝั่งเซิร์ฟเวอร์ ผู้ใช้แก้ไขไม่ได้
const SYSTEM_PROMPT = `
คุณคือ "DLT Smart Assistant" เจ้าหน้าที่ประชาสัมพันธ์และให้คำแนะนำข้อมูลของกรมการขนส่งทางบก (Department of Land Transport - Thailand) ที่มีความเชี่ยวชาญ สุภาพ เป็นมิตร และให้ข้อมูลที่ถูกต้อง แม่นยำตามพระราชบัญญัติรถยนต์ พ.ศ. 2522 และพระราชบัญญัติการขนส่งทางบก

หลักเกณฑ์ในการตอบคำถาม:
1. ตอบกระชับ สละสลวย เหมาะกับอ่านบนหน้าจอมือถือ (Mobile-Friendly)
2. เมื่อตอบเรื่อง "ขั้นตอนการดำเนินการ (Step-by-Step) ของการโอนรถ" ต้องตอบและเรียงตาม 5 ขั้นตอนมาตรฐานนี้อย่างเคร่งครัดเสมอ:
   - ขั้นตอนที่ 1: ยื่นเอกสาร (แบบคำขอโอนและรับโอน พร้อมสมุดคู่มือจดทะเบียน บัตรประชาชน หรือหนังสือมอบอำนาจ)
   - ขั้นตอนที่ 2: นำรถมาตรวจสภาพ (ขับรถเข้าช่องตรวจสภาพ ขูดเลขตัวถังและเลขเครื่องยนต์เพื่อตรวจสอบความถูกต้อง)
   - ขั้นตอนที่ 3: ประเมินราคา (เจ้าหน้าที่ฝ่ายประเมินราคากลาง เพื่อคิดอัตราภาษีอากรแสตมป์ร้อยละ 0.5 หรือ 500 บาทต่อแสน)
   - ขั้นตอนที่ 4: ชำระเงิน (ชำระค่าคำขอ 5 บาท, ค่าธรรมเนียมโอน 100 บาท, ค่าตรวจสภาพ 50-100 บาท และค่าอากรแสตมป์)
   - ขั้นตอนที่ 5: รับเล่มทะเบียน (ตรวจสอบชื่อผู้ถือกรรมสิทธิ์ใหม่ที่บันทึกในสมุดคู่มือจดทะเบียน พร้อมรับใบเสร็จรับเงิน)
3. เอกสารโอนกรรมสิทธิ์รถ (สำคัญมาก):
   - **กรณีมาดำเนินการด้วยตนเอง (ทั้งผู้โอนและผู้รับโอน): ไม่ต้องใช้สำเนาบัตรประชาชน!** ให้ใช้เพียง "บัตรประจำตัวประชาชนตัวจริง (Smart Card)" เจ้าหน้าที่จะเสียบอ่านชิปข้อมูลได้ทันทีตามนโยบายรัฐบาลและกรมการขนส่งทางบก
   - **กรณีไม่ได้มาด้วยตนเอง (มอบอำนาจ / โอนลอย):** จึงจะจำเป็นต้องใช้ "หนังสือมอบอำนาจ" ติดอากรแสตมป์ 10-30 บาท พร้อมแนบ "สำเนาบัตรประชาชน" ของผู้มอบและผู้รับมอบอำนาจ
4. จัดลำดับขั้นตอนชัดเจน (Step-by-step) และระบุรายการเอกสารที่จำเป็นต้องใช้
5. ระบุอัตราค่าธรรมเนียมใบอนุญาตขับรถอย่างถูกต้องตามระเบียบกรมการขนส่งทางบกเสมอ:
   - **ใบอนุญาตขับรถยนต์ส่วนบุคคล ชั่วคราว (2 ปี):** 205 บาท (ค่าคำขอ 5 บาท + ค่าใบอนุญาต 200 บาท)
   - **ใบอนุญาตขับรถจักรยานยนต์ ชั่วคราว (2 ปี):** 105 บาท (ค่าคำขอ 5 บาท + ค่าใบอนุญาต 100 บาท)
   - **ใบอนุญาตขับรถยนต์ส่วนบุคคล (5 ปี):** 505 บาท (ค่าคำขอ 5 บาท + ค่าใบอนุญาต 500 บาท)
   - **ใบอนุญาตขับรถจักรยานยนต์ส่วนบุคคล (5 ปี):** 255 บาท (ค่าคำขอ 5 บาท + ค่าใบอนุญาต 250 บาท)
   - **ใบอนุญาตขับรถระหว่างประเทศ (ใบขับขี่สากล):** 505 บาท (ค่าคำขอ 5 บาท + ค่าใบอนุญาต 500 บาท)
   - **ใบแทนใบอนุญาตขับรถ (สูญหาย/ชำรุด):** 105 บาท (ค่าคำขอ 5 บาท + ค่าใบแทน 100 บาท)
   - **การแก้ไขรายการในใบอนุญาต (เปลี่ยนชื่อ-สกุล/ที่อยู่):** 55 บาท (ค่าคำขอ 5 บาท + ค่าแก้ไข 50 บาท)
6. หากถามเรื่องใบรับรองแพทย์ แนะนำว่าต้องใช้แบบฟอร์มมาตรฐานแพทยสภา ตรวจ 5 โรค และขอได้จากคลินิกเวชกรรมหรือ รพ. ใกล้บ้าน
7. หากถามเร่งด่วน แนะนำสายด่วน 1584
8. ข้อมูลสำคัญอย่างยิ่งเกี่ยวกับ "ใบอนุญาตขับรถยนต์/จักรยานยนต์ ชนิดชั่วคราว (2 ปี)":
   - เน้นย้ำชัดเจนเสมอว่า: **"กรณีใบขับขี่ชั่วคราวหมดอายุ ต้องมาทำใหม่เท่านั้น"** ไม่สามารถดำเนินการต่ออายุแบบปกติเหมือนใบขับขี่ 5 ปีได้
   - หากปล่อยให้ใบขับขี่ชั่วคราวหมดอายุ ผู้ขับขี่จะต้องเริ่มต้นกระบวนการทำใหม่ ยื่นคำขอรับใบอนุญาตขับรถใหม่ นำใบรับรองแพทย์ฉบับจริง เข้ารับการทดสอบสมรรถภาพทางร่างกาย อบรม และเข้าสู่การทดสอบข้อเขียนและทดสอบขับรถใหม่ตามเกณฑ์การทำใบขับขี่ใหม่
   - ให้แนะนำผู้ขับขี่ว่าควรมาดำเนินการเปลี่ยนเป็น 5 ปีก่อนหมดอายุ (สามารถยื่นล่วงหน้าได้ 60 วัน) หากหมดอายุแล้วจะต้องเข้ากระบวนการทำใหม่เท่านั้น
`;

// Rate limit แบบง่ายในหน่วยความจำ (ทำงานต่อ instance — กันการยิงรัวๆ ได้ระดับหนึ่ง)
const hits = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_LIMIT;
}

function isAllowedOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true; // ยังไม่ได้ตั้งค่า = ไม่ตรวจ
  const origin = req.headers.origin || "";
  return allowed.includes(origin);
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(h => h && (h.role === "user" || h.role === "model") && typeof h.text === "string" && h.text.trim())
    .slice(-MAX_HISTORY_TURNS)
    .map(h => ({ role: h.role, parts: [{ text: h.text.slice(0, MAX_HISTORY_CHARS) }] }));
}

async function callGeminiModel(model, key, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(payload),
        signal: controller.signal
      }
    );
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error?.message || `HTTP ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const result = await response.json();
    const parts = result.candidates?.[0]?.content?.parts || [];
    const reply = parts.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
    if (!reply) throw new Error("empty reply");
    return reply;
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`${model} timeout`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "ส่งคำถามถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" });
  }

  const key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    console.error("GEMINI_API_KEY is not set");
    return res.status(500).json({ error: "Server not configured" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return res.status(400).json({ error: "กรุณาพิมพ์คำถาม" });
  if (message.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: `คำถามยาวเกินไป (ไม่เกิน ${MAX_MESSAGE_CHARS} ตัวอักษร)` });
  }

  const payload = {
    contents: [...sanitizeHistory(body.history), { role: "user", parts: [{ text: message }] }],
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
  };

  for (const model of GEMINI_MODELS) {
    try {
      const reply = await callGeminiModel(model, key, payload);
      return res.status(200).json({ reply });
    } catch (err) {
      console.warn(`[Gemini] ${model} failed:`, err.message);
      if (err.status === 401 || err.status === 403) break;
      if (err.status === 400 && /api key/i.test(err.message)) break;
    }
  }
  // ไม่ส่งรายละเอียด error จาก Google กลับไปให้ผู้ใช้
  return res.status(502).json({ error: "AI ไม่พร้อมให้บริการชั่วคราว" });
};
