const { checkIngest, body, sb, touchServer } = require("../_lib");
// POST /api/ingest/log  (header X-Ingest-Token)  { type, detail, serverName, date }
module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  if (!checkIngest(req)) return res.status(401).json({ error: "token invalide" });
  const b = body(req);
  try {
    await touchServer(b.serverName);
    await sb(`hs_logs`, { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ server_name: b.serverName || null, type: b.type || "info", detail: (b.detail || "").toString().slice(0, 400) }) });
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
