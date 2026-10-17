const crypto = require("crypto");
const { CLIENT_ID, CLIENT_SECRET, SUPABASE_URL, SUPABASE_KEY, SESSION_SECRET, SITE_URL, INGEST_TOKEN } = process.env;
const API = "https://discord.com/api/v10";

function sign(d) {
  const body = Buffer.from(JSON.stringify(d)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET || "dev").update(body).digest("base64url");
  return body + "." + sig;
}
function verify(t) {
  if (!t || !t.includes(".")) return null;
  const [body, sig] = t.split(".");
  const exp = crypto.createHmac("sha256", SESSION_SECRET || "dev").update(body).digest("base64url");
  try { if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null; } catch { return null; }
  try { const d = JSON.parse(Buffer.from(body, "base64url").toString()); if (d.exp && Date.now() > d.exp) return null; return d; } catch { return null; }
}
function getSession(req) { const m = (req.headers.cookie || "").match(/hs_session=([^;]+)/); return m ? verify(decodeURIComponent(m[1])) : null; }
function setCookie(res, t) { res.setHeader("Set-Cookie", `hs_session=${encodeURIComponent(t)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`); }
function clearCookie(res) { res.setHeader("Set-Cookie", "hs_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"); }
const redirectUri = () => `${SITE_URL}/api/auth-callback`;

// Verifie le token d'ingestion envoye par le resource (header X-Ingest-Token)
function checkIngest(req) {
  const tok = req.headers["x-ingest-token"];
  return INGEST_TOKEN && tok && tok === INGEST_TOKEN;
}
function body(req) { let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } } return b || {}; }

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...opts,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "content-type": "application/json", ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`supabase ${r.status} ${await r.text().catch(() => "")}`);
  return r.status === 204 ? null : r.json().catch(() => null);
}
// upsert d'un serveur (met a jour last_seen / online)
async function touchServer(name, extra = {}) {
  if (!name) return;
  await sb(`hs_servers?on_conflict=name`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ name, last_seen: new Date().toISOString(), ...extra }) }).catch(() => {});
}

module.exports = { CLIENT_ID, CLIENT_SECRET, SUPABASE_URL, SUPABASE_KEY, API, SITE_URL, INGEST_TOKEN,
  sign, verify, getSession, setCookie, clearCookie, redirectUri, checkIngest, body, sb, touchServer };
