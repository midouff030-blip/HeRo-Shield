const { getSession, sb } = require("./_lib");
// user + serveurs que le proprietaire a connectes (via hs_licenses.owner_id)
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  try {
    const lics = await sb(`hs_licenses?owner_id=eq.${s.id}&select=server_name`);
    const names = new Set((lics || []).map(l => l.server_name).filter(Boolean));
    let servers = [];
    if (names.size) {
      const all = await sb(`hs_servers?select=name,online,max,last_seen&order=last_seen.desc&limit=500`);
      servers = (all || []).filter(x => names.has(x.name));
    }
    res.status(200).json({ user: { id: s.id, username: s.username, avatar: s.avatar }, servers });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
