const { getSession, sb } = require("./_lib");
// POST { key, name } -> enregistre une licence (keymaster) + le serveur pour le proprietaire connecte
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const key = (b?.key || "").toString().trim();
  const name = (b?.name || "").toString().trim().slice(0, 60);
  if (!key || !name) return res.status(400).json({ error: "cle et nom du serveur requis" });
  try {
    await sb(`hs_licenses?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key, server_name: name, owner_id: s.id, active: true }) });
    await sb(`hs_servers?on_conflict=name`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ name, last_seen: new Date().toISOString() }) });
    res.status(200).json({ ok: true, name });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
