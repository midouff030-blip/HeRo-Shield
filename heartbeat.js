const { checkIngest, body, touchServer } = require("../_lib");
// POST /api/ingest/heartbeat  { serverName, online, max }
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  if (!checkIngest(req)) return res.status(401).json({ error: "token invalide" });
  const b = body(req);
  try {
    await touchServer(b.serverName, { online: b.online || 0, max: b.max || 0 });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
