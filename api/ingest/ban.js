const { checkIngest, body, sb, touchServer } = require("../_lib");
// POST /api/ingest/ban  (header X-Ingest-Token)
// { type, name, identifier, reason, detail, banId, expires, serverName, date, screenshot? }
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  if (!checkIngest(req)) return res.status(401).json({ error: "token invalide" });
  const b = body(req);
  try {
    await touchServer(b.serverName);
    await sb(`hs_bans`, { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        server_name: b.serverName || null, type: b.type || null, player_name: b.name || null,
        identifier: b.identifier || null, reason: b.reason || null, detail: b.detail || null,
        ban_id: b.banId ? String(b.banId) : null, expires: b.expires || 0, screenshot: b.screenshot || null
      }) });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
