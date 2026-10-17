
import crypto from 'node:crypto';

const env = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing environment variable: ${k}`);
  return v;
};


export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const key = env('SUPABASE_SERVICE_KEY');
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const err = new Error(`Supabase ${r.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    err.status = 502;
    throw err;
  }
  return data;
}

export const enc = encodeURIComponent;


const COOKIE = 'hs_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const b64 = (s) => Buffer.from(s).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', env('SESSION_SECRET')).update(data).digest('base64url');

export function setSession(res, user) {
  const payload = b64(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE }));
  const value = `${payload}.${sign(payload)}`;
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`);
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

export function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function getSession(req) {
  const raw = parseCookies(req)[COOKIE];
  if (!raw || !raw.includes('.')) return null;
  const [payload, sig] = raw.split('.');
  const expected = sign(payload);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!user.exp || user.exp < Date.now() / 1000) return null;
    return user;
  } catch {
    return null;
  }
}


export const send = (res, status, data) => res.status(status).json(data);

export function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (!e.expose) console.error(e);
      if (!res.headersSent) send(res, e.status || 500, { error: e.expose ? e.message : 'Server error' });
    }
  };
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  e.expose = true;
  return e;
}

export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

// ---------- Auth ----------
export function requireUser(req) {
  const u = getSession(req);
  if (!u) throw httpError(401, 'Not logged in');
  return u;
}


export async function requireLicense(req) {
  const license = String(req.headers['x-license'] || '').trim();
  if (!license) throw httpError(401, 'Missing license');
  const rows = await sb(`servers?license=eq.${enc(license)}&select=id,name`);
  if (!rows || !rows.length) throw httpError(401, 'Invalid license');
  const server = rows[0];
  // update last_seen (no wait)
  sb(`servers?id=eq.${server.id}`, { method: 'PATCH', body: { last_seen: new Date().toISOString() } }).catch(() => {});
  return server;
}


export async function requireOwnedServer(user, serverId) {
  if (!serverId || !/^[0-9a-f-]{36}$/i.test(serverId)) throw httpError(400, 'Invalid server');
  const rows = await sb(`servers?id=eq.${enc(serverId)}&owner_discord=eq.${enc(user.id)}&select=*`);
  if (!rows || !rows.length) throw httpError(404, 'Server not found');
  return rows[0];
}

export function newLicense() {
  const part = () => crypto.randomBytes(3).toString('hex').toUpperCase();
  return `HS-${part()}-${part()}-${part()}-${part()}`;
}

export const str = (v, max = 200) => String(v ?? '').slice(0, max);
