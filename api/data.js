const { getSession, sb, fetchCfx } = require("./_lib");
// GET ?server=<name> -> etat live (FiveM API) + bans + logs + joueurs live + stats
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  const name = req.query?.server;
  if (!name) return res.status(400).json({ error: "server manquant" });
  const enc = encodeURIComponent(name);
  try {
    // le proprietaire possede-t-il ce serveur ? recupere le code de connexion
    const lic = await sb(`hs_licenses?server_name=eq.${enc}&owner_id=eq.${s.id}&select=key`);
    if (!lic || !lic.length) return res.status(403).json({ error: "Serveur introuvable ou pas a toi." });
    const code = lic[0].key;

    const [srv, bans, logs, live] = await Promise.all([
      sb(`hs_servers?name=eq.${enc}&select=name,online,max,last_seen`),
      sb(`hs_bans?server_name=eq.${enc}&select=type,player_name,identifier,reason,detail,ban_id,screenshot,created_at&order=created_at.desc&limit=60`),
      sb(`hs_logs?server_name=eq.${enc}&select=type,detail,created_at&order=created_at.desc&limit=80`),
      fetchCfx(code)
    ]);

    const server = (srv && srv[0]) || { name, online: 0, max: 0 };
    let players = [];
    if (live) {
      server.online = live.online; server.max = live.max; server.hostname = live.hostname; server.live = true;
      players = live.players || [];
      // rafraichit le cache serveur
      sb(`hs_servers?on_conflict=name`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ name, online: live.online, max: live.max, last_seen: new Date().toISOString() }) }).catch(() => {});
    }
    const byType = {};
    (bans || []).forEach(b => { byType[b.type] = (byType[b.type] || 0) + 1; });

    res.status(200).json({
      server, code, players, bans: bans || [], logs: logs || [],
      stats: { bans: (bans || []).length, logs: (logs || []).length, online: server.online || 0, players: players.length, byType }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
