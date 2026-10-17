const { getSession, sb } = require("./_lib");
// GET ?server=<name> -> server + bans + logs + players + stats (donnees du resource)
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  const name = req.query?.server;
  if (!name) return res.status(400).json({ error: "server manquant" });
  const enc = encodeURIComponent(name);
  try {
    const lic = await sb(`hs_licenses?server_name=eq.${enc}&owner_id=eq.${s.id}&select=key`);
    if (!lic || !lic.length) return res.status(403).json({ error: "Serveur introuvable ou pas a toi." });

    const [srv, bans, logs, players] = await Promise.all([
      sb(`hs_servers?name=eq.${enc}&select=name,online,max,last_seen`),
      sb(`hs_bans?server_name=eq.${enc}&select=type,player_name,identifier,reason,detail,ban_id,screenshot,created_at&order=created_at.desc&limit=60`),
      sb(`hs_logs?server_name=eq.${enc}&select=type,detail,created_at&order=created_at.desc&limit=80`),
      sb(`hs_players?server_name=eq.${enc}&select=name,identifier,playtime_sec,online,last_seen&order=playtime_sec.desc&limit=100`)
    ]);
    const server = (srv && srv[0]) || { name, online: 0, max: 0 };
    const byType = {};
    (bans || []).forEach(b => { byType[b.type] = (byType[b.type] || 0) + 1; });
    res.status(200).json({
      server, key: lic[0].key, bans: bans || [], logs: logs || [], players: players || [],
      stats: { bans: (bans || []).length, logs: (logs || []).length, online: server.online || 0, players: (players || []).length, byType }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
