const { getSession, sb } = require("./_lib");
// user + liste des serveurs qui ont remonte des donnees
module.exports = async (req, res) => {
  const s = getSession(req);
  if (!s) return res.status(401).json({ error: "non connecte" });
  try {
    const servers = await sb(`hs_servers?select=name,online,max,last_seen&order=last_seen.desc`);
    res.status(200).json({ user: { id: s.id, username: s.username, avatar: s.avatar }, servers: servers || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
