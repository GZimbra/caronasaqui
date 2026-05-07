const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

loadEnvFile();

const HOST = process.env.ADMIN_HOST || "0.0.0.0";
const PORT = Number(process.env.ADMIN_PORT || process.env.PORT || 4174);
const ADMIN_USERNAME = requiredEnv("ADMIN_USERNAME");
const ADMIN_PASSWORD = requiredEnv("ADMIN_PASSWORD");
const SESSION_SECRET = requiredEnv("ADMIN_SESSION_SECRET");
const ROOT = PROJECT_ROOT;
let cachedToken = null;
let cachedFirebaseUserToken = null;
const loginRateLimit = new Map();

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

function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  });
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Variavel obrigatoria ausente: ${name}`);
    process.exit(1);
  }
  return value;
}

function securityHeaders(extra = {}) {
  return {
    "Content-Security-Policy": "default-src 'self' https://www.gstatic.com https://unpkg.com; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.firebasestorage.app https://nominatim.openstreetmap.org; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    ...extra,
  };
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(part => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
}

function createSession() {
  const payload = JSON.stringify({ iat: Date.now(), nonce: crypto.randomBytes(12).toString("hex") });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function hasValidSession(req) {
  const token = parseCookies(req).admin_session;
  if (!token || !token.includes(".")) return false;
  const [encoded, signature] = token.split(".");
  const expected = sign(encoded);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, securityHeaders(headers));
  res.end(body);
}

function sendJson(res, status, data, headers = {}) {
  send(res, status, JSON.stringify(data), { "Content-Type": "application/json; charset=utf-8", ...headers });
}

function readBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 4096) req.destroy();
    });
    req.on("end", () => resolve(body));
  });
}

function serveFile(res, urlPath) {
  const cleanPath = resolveStaticPath(urlPath);
  if (!cleanPath) {
    send(res, 404, "Not found");
    return;
  }

  const target = path.resolve(ROOT, "." + cleanPath);

  if (!target.startsWith(ROOT) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    send(res, 404, "Not found");
    return;
  }

  const ext = path.extname(target);
  send(res, 200, fs.readFileSync(target), {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
}

function resolveStaticPath(urlPath) {
  if (urlPath === "/") return "/public/index.html";
  if (urlPath === "/index.html") return "/public/index.html";
  if (urlPath === "/app" || urlPath === "/app.html") return "/public/app.html";
  if (urlPath === "/404.html") return "/public/404.html";
  if (urlPath === "/sw.js") return "/public/sw.js";
  if (urlPath.startsWith("/css/")) return `/public${decodeURIComponent(urlPath)}`;
  if (urlPath.startsWith("/js/")) return `/public${decodeURIComponent(urlPath)}`;
  if (urlPath === "/admin" || urlPath === "/admin/") return "/public/admin/index.html";
  if (urlPath.startsWith("/admin/css/") || urlPath.startsWith("/admin/js/")) {
    return `/public${decodeURIComponent(urlPath)}`;
  }
  return null;
}

function isRateLimited(req) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const windowMs = 60_000;
  const limit = 10;
  const current = loginRateLimit.get(ip) || [];
  const recent = current.filter(timestamp => now - timestamp < windowMs);
  recent.push(now);
  loginRateLimit.set(ip, recent);
  return recent.length > limit;
}

function sessionCookie(value, maxAge) {
  const secure = process.env.ADMIN_COOKIE_SECURE === "true" ? "; Secure" : "";
  return `admin_session=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  if (raw.trim().startsWith("{")) return JSON.parse(raw);
  return JSON.parse(fs.readFileSync(path.resolve(raw), "utf8"));
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;

  const sa = loadServiceAccount();
  if (!sa?.client_email || !sa?.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT nao configurado");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signature = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) throw new Error(`OAuth falhou: ${response.status}`);
  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  return cachedToken.token;
}

function loadFirebaseClientConfig() {
  const configPath = path.join(PROJECT_ROOT, "public", "js", "config", "firebase-config.js");
  const raw = fs.readFileSync(configPath, "utf8");
  const match = raw.match(/window\.CARONAS_FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error("Firebase client config nao encontrada");
  return Function(`"use strict"; return (${match[1]});`)();
}

async function getFirebaseUserToken() {
  if (cachedFirebaseUserToken && cachedFirebaseUserToken.expiresAt > Date.now() + 60000) {
    return cachedFirebaseUserToken.token;
  }

  const config = loadFirebaseClientConfig();
  const email = process.env.ADMIN_FIREBASE_EMAIL || `${ADMIN_USERNAME}@caronasaqui.internal`;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: ADMIN_PASSWORD,
      returnSecureToken: true,
    }),
  });

  if (!response.ok) {
    throw new Error("Sem acesso ao Firestore: configure FIREBASE_SERVICE_ACCOUNT ou crie o usuario Firebase Auth admin@caronasaqui.internal com a senha admin");
  }

  const data = await response.json();
  cachedFirebaseUserToken = {
    token: data.idToken,
    expiresAt: Date.now() + (Number(data.expiresIn || 3600) * 1000),
  };
  return cachedFirebaseUserToken.token;
}

function decodeValue(value) {
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item)]));
  }
  return null;
}

function decodeDocument(doc) {
  const id = doc.name.split("/").pop();
  const data = Object.fromEntries(Object.entries(doc.fields || {}).map(([key, value]) => [key, decodeValue(value)]));
  return { id, ...data };
}

async function listCollection(projectId, collection) {
  const sa = loadServiceAccount();
  const token = sa ? await getAccessToken() : await getFirebaseUserToken();
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=300`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Firestore ${collection}: ${response.status}`);
  const data = await response.json();
  return (data.documents || []).map(decodeDocument);
}

async function listCollectionOptional(projectId, collection) {
  try {
    return await listCollection(projectId, collection);
  } catch (error) {
    if (String(error.message).includes(": 403")) return [];
    throw error;
  }
}

async function loadAdminData() {
  const sa = loadServiceAccount();
  const clientConfig = !sa ? loadFirebaseClientConfig() : null;
  const projectId = process.env.FIREBASE_PROJECT_ID || sa?.project_id || clientConfig?.projectId;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID nao configurado");

  const [usuarios, caronas, solicitacoes, chats] = await Promise.all([
    listCollection(projectId, "usuarios"),
    listCollection(projectId, "caronas"),
    listCollectionOptional(projectId, "solicitacoes"),
    listCollectionOptional(projectId, "chats"),
  ]);

  return { usuarios, caronas, solicitacoes, chats };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/admin/login") {
    if (isRateLimited(req)) {
      sendJson(res, 429, { ok: false, error: "rate_limited" });
      return;
    }

    const body = JSON.parse(await readBody(req) || "{}");
    if (!safeCompare(body.username, ADMIN_USERNAME) || !safeCompare(body.password, ADMIN_PASSWORD)) {
      sendJson(res, 401, { ok: false });
      return;
    }

    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": sessionCookie(createSession(), 28800),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/admin/session") {
    sendJson(res, hasValidSession(req) ? 200 : 401, { ok: hasValidSession(req) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/admin/logout") {
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": sessionCookie("", 0),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/admin/data") {
    if (!hasValidSession(req)) {
      sendJson(res, 401, { ok: false });
      return;
    }

    try {
      sendJson(res, 200, await loadAdminData());
    } catch (error) {
      sendJson(res, 503, { ok: false, error: error.message });
    }
    return;
  }

  serveFile(res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Site e admin: http://${HOST}:${PORT}`);
});
