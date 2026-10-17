// Dashboard: read / save server settings (detections + webhook)
import { wrap, send, readBody, sb, httpError, requireUser, requireOwnedServer } from './_lib.js';

// name -> [min, max] for value (null = no value)
const DETECTIONS = {
  GodMode: null, SpeedHack: [5, 100], NoClip: [10, 1000], Invisible: null, SuperJump: [1, 50],
  Spectate: null, BlacklistedWeapon: null, Injection: null, Heartbeat: [30, 600],
  BlacklistedEvent: null, EventSpam: [5, 500], Explosion: [1, 100], EntitySpam: [5, 500],
  BlacklistedEntity: null, WeaponDamage: [50, 5000],
};
const ACTIONS = ['ban', 'kick', 'log'];
const LOGS = ['Startup', 'ResourceStart', 'ResourceStop', 'Join', 'Leave', 'Death', 'Revive', 'Weapon', 'Explosion', 'Admin'];
const WEBHOOK = /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

function clean(input) {
  const out = { webhook: '', logWebhook: '', logs: {}, detections: {} };
  for (const key of ['webhook', 'logWebhook']) {
    const url = String(input?.[key] || '').trim();
    if (url && !WEBHOOK.test(url)) throw httpError(400, 'Invalid Discord webhook URL');
    out[key] = url;
  }
  for (const name of LOGS) {
    if (typeof input?.logs?.[name] === 'boolean') out.logs[name] = input.logs[name];
  }

  for (const [name, range] of Object.entries(DETECTIONS)) {
    const d = input?.detections?.[name];
    if (!d || typeof d !== 'object') continue;
    const item = {};
    if (typeof d.enabled === 'boolean') item.enabled = d.enabled;
    if (ACTIONS.includes(d.action)) item.action = d.action;
    if (range && d.value !== undefined && d.value !== '') {
      const v = Number(d.value);
      if (!Number.isFinite(v) || v < range[0] || v > range[1]) {
        throw httpError(400, `${name}: value must be between ${range[0]} and ${range[1]}`);
      }
      item.value = v;
    }
    out.detections[name] = item;
  }
  return out;
}

export default wrap(async (req, res) => {
  const user = requireUser(req);

  if (req.method === 'GET') {
    const server = await requireOwnedServer(user, req.query.server);
    return send(res, 200, { settings: server.settings || {} });
  }

  if (req.method === 'POST') {
    const b = readBody(req);
    const server = await requireOwnedServer(user, b.server);
    const settings = clean(b.settings);
    await sb(`servers?id=eq.${server.id}`, { method: 'PATCH', body: { settings } });
    return send(res, 200, { ok: true, settings });
  }

  throw httpError(405, 'Method not allowed');
});
