const fs = require("fs");
const http = require("http");
const path = require("path");

const HOST = process.env.DEV_HOST || "127.0.0.1";
const PORT = Number(process.env.DEV_PORT || 5500);
const ROOT = path.resolve(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Security-Policy": "default-src 'self' https://www.gstatic.com https://unpkg.com; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.firebasestorage.app https://nominatim.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    ...headers,
  });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/admin")) {
    send(res, 404, "Not found");
    return;
  }

  const cleanPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const target = path.resolve(ROOT, "." + cleanPath);

  if (!target.startsWith(ROOT) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    send(res, 404, "Not found");
    return;
  }

  send(res, 200, fs.readFileSync(target), {
    "Content-Type": MIME[path.extname(target)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
}).listen(PORT, HOST, () => {
  console.log(`App local: http://${HOST}:${PORT}`);
});
