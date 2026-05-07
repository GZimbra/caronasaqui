const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

let cachedToken = null;
let cachedFirebaseUserToken = null;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Variavel obrigatoria ausente: ${name}`);
    error.code = "MISSING_ENV";
    throw error;
  }
  return value;
}

function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(part => {
    const index = part.indexOf("=");
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
  }));
}

function sign(value) {
  return crypto.createHmac("sha256", requiredEnv("ADMIN_SESSION_SECRET")).update(value).digest("hex");
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

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...headers,
  });
  res.end(JSON.stringify(data));
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

function sessionCookie(value, maxAge) {
  return `admin_session=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
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
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const assertion = `${unsigned}.${crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")}`;

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
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in * 1000) };
  return cachedToken.token;
}

function loadFirebaseClientConfig() {
  return {
    apiKey: "AIzaSyCxpm0fU6_6Fr_6-S5G84fv-bCSoA03mfM",
    projectId: "caronas-aqui",
    measurementId: "G-YENXSWMG5Y",
  };
}

async function getFirebaseUserToken() {
  if (cachedFirebaseUserToken && cachedFirebaseUserToken.expiresAt > Date.now() + 60000) {
    return cachedFirebaseUserToken.token;
  }

  const config = loadFirebaseClientConfig();
  const username = process.env.ADMIN_USERNAME || "admin";
  const email = process.env.ADMIN_FIREBASE_EMAIL || `${username}@caronasaqui.internal`;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${config.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: requiredEnv("ADMIN_PASSWORD"),
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

module.exports = async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
  const action = url.searchParams.get("action");

  try {
    if (req.method === "POST" && action === "login") {
      const body = JSON.parse(await readBody(req) || "{}");
      if (!safeCompare(body.username, requiredEnv("ADMIN_USERNAME")) || !safeCompare(body.password, requiredEnv("ADMIN_PASSWORD"))) {
        sendJson(res, 401, { ok: false });
        return;
      }

      sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie(createSession(), 28800) });
      return;
    }

    if (req.method === "GET" && action === "session") {
      sendJson(res, hasValidSession(req) ? 200 : 401, { ok: hasValidSession(req) });
      return;
    }

    if (req.method === "POST" && action === "logout") {
      sendJson(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
      return;
    }

    if (req.method === "GET" && action === "data") {
      if (!hasValidSession(req)) {
        sendJson(res, 401, { ok: false });
        return;
      }

      sendJson(res, 200, await loadAdminData());
      return;
    }

    sendJson(res, 404, { ok: false });
  } catch (error) {
    const status = error.code === "MISSING_ENV" ? 500 : 503;
    sendJson(res, status, { ok: false, error: error.message });
  }
};
