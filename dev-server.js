// เซิร์ฟเวอร์ทดสอบในเครื่อง (ใช้แทน `vercel dev`) — ไม่ต้องติดตั้งอะไรเพิ่ม
// วิธีใช้: สร้างไฟล์ .env.local ที่มี GEMINI_API_KEY=... แล้วรัน  node dev-server.js
// จากนั้นเปิด http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;

// โหลดตัวแปรจาก .env.local / .env (ถ้ามี)
for (const file of [".env.local", ".env"]) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
// อนุญาต localhost อัตโนมัติตอนทดสอบในเครื่อง (ไม่กระทบค่าบน Vercel)
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS += `,http://localhost:${PORT},http://127.0.0.1:${PORT}`;
}
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  ยังไม่ได้ตั้ง GEMINI_API_KEY ในไฟล์ .env.local — แชทจะใช้คำตอบสำรองแทน");
}

const chatHandler = require("./api/chat.js");

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webp": "image/webp"
};
// ไฟล์ที่ไม่ควรถูกเปิดผ่านเว็บ
const BLOCKED = /^(\.env|\.git|api[\\/]|dev-server\.js|node_modules)/i;

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/chat") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 100000) req.destroy(); });
    req.on("end", () => {
      try { req.body = body ? JSON.parse(body) : undefined; } catch { req.body = body; }
      res.status = code => { res.statusCode = code; return res; };
      res.json = obj => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); };
      Promise.resolve(chatHandler(req, res)).catch(err => {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ error: "Server error" });
      });
    });
    return;
  }

  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname).replace(/^[\\/]+/, "");
  const filePath = path.resolve(ROOT, rel);
  if (!filePath.startsWith(ROOT + path.sep) || BLOCKED.test(rel)) {
    res.statusCode = 404; return res.end("Not found");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.statusCode = 404; return res.end("Not found"); }
    res.setHeader("Content-Type", MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`✅ DLT Smart AI รันอยู่ที่ http://localhost:${PORT}  (กด Ctrl+C เพื่อหยุด)`);
});
