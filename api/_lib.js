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

// Cle unique par serveur (a mettre dans Config.ReportingToken du client)
function newKey() {
  return "HS-" + crypto.randomBytes(3).toString("hex").toUpperCase() + "-" +
    crypto.randomBytes(3).toString("hex").toUpperCase() + "-" +
    crypto.randomBytes(3).toString("hex").toUpperCase();
}
// Le resource envoie sa cle dans X-Ingest-Token. On retrouve la licence (= le serveur + proprietaire).
async function ingestLicense(req) {
  const tok = req.headers["x-ingest-token"];
  if (!tok) return null;
  // compat : un INGEST_TOKEN global reste accepte (sert au serveur de demo du proprietaire)
  try {
    const rows = await sb(`hs_licenses?key=eq.${encodeURIComponent(tok)}&active=eq.true&select=key,server_name,owner_id`);
    if (rows && rows.length) return rows[0];
  } catch {}
  return null;
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

// Recupere l'etat live d'un serveur FiveM via son code de connexion (cfx.re/join/CODE)
async function fetchCfx(code) {
  code = (code || "").toString().trim().replace(/^.*\/join\//, "").replace(/[^a-z0-9]/gi, "");
  if (!code) return null;
  try {
    const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${code}`, {
      headers: { "User-Agent": "CitizenFX/1.0", "accept": "application/json" }
    });
    if (!r.ok) return null;
    const j = await r.json();
    const d = j && j.Data; if (!d) return null;
    const clean = (s) => (s || "").toString().replace(/\^\d/g, "").trim();
    const players = (d.players || []).map(p => ({ name: clean(p.name), ping: p.ping, id: p.id }));
    return {
      code,
      hostname: clean(d.hostname),
      online: d.clients != null ? d.clients : players.length,
      max: d.svMaxclients || d.sv_maxclients || (d.vars && (d.vars.sv_maxClients || d.vars.sv_maxclients)) || 0,
      players
    };
  } catch { return null; }
}

module.exports = { CLIENT_ID, CLIENT_SECRET, SUPABASE_URL, SUPABASE_KEY, API, SITE_URL, INGEST_TOKEN,
  sign, verify, getSession, setCookie, clearCookie, redirectUri, ingestLicense, newKey, body, sb, touchServer, fetchCfx };
