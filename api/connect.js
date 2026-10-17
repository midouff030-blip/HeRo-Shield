const { getSession, sb, fetchCfx } = require("./_lib");
// POST { code, name? } -> enregistre le serveur pour le proprietaire.
// Tente de recuperer l'etat live FiveM ; si l'API est injoignable, enregistre quand meme.
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  if (req.method !== "POST") return res.status(405).json({ error: "methode" });
  let b = req.body; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const codeRaw = (b?.code || "").toString().trim();
  const code = codeRaw.replace(/^.*\/join\//, "").replace(/[^a-z0-9]/gi, "");
  let name = (b?.name || "").toString().trim().slice(0, 80);
  if (!code) return res.status(400).json({ error: "code de connexion requis (cfx.re/join/XXXX)" });

  try {
    const live = await fetchCfx(code);           // peut etre null si l'API est bloquee
    if (!name) name = (live && live.hostname) || code;
    await sb(`hs_licenses?on_conflict=key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ key: code, server_name: name, owner_id: s.id, active: true }) });
    await sb(`hs_servers?on_conflict=name`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ name, online: live ? live.online : 0, max: live ? live.max : 0, last_seen: new Date().toISOString() }) });
    res.status(200).json({ ok: true, name, code, online: live ? live.online : null, max: live ? live.max : null, live: !!live });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
