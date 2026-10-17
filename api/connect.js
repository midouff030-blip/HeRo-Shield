const { getSession, sb, fetchCfx } = require("./_lib");
// POST { code, name? } -> recupere l'etat live FiveM + enregistre le serveur pour le proprietaire
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const code = (b?.code || "").toString().trim();
  if (!code) return res.status(400).json({ error: "code de connexion requis (cfx.re/join/XXXX)" });
  try {
    const live = await fetchCfx(code);
    if (!live) return res.status(404).json({ error: "Serveur introuvable. Verifie le code (cfx.re/join/XXXX) et qu'il est en ligne." });
    const name = (b?.name || live.hostname || code).toString().trim().slice(0, 80);
    // le "code" sert de cle de liaison ; server_name = nom affiche
    await sb(`hs_licenses?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key: live.code, server_name: name, owner_id: s.id, active: true }) });
    await sb(`hs_servers?on_conflict=name`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ name, online: live.online, max: live.max, last_seen: new Date().toISOString() }) });
    res.status(200).json({ ok: true, name, online: live.online, max: live.max, hostname: live.hostname });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
