// Dashboard: proof images of a ban
import { wrap, send, httpError, requireUser, requireOwnedServer, storageList, publicUrl } from './_lib.js';

export default wrap(async (req, res) => {
  const user = requireUser(req);
  const server = await requireOwnedServer(user, req.query.server);
  const banId = String(req.query.banId || '').replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
  if (!banId) throw httpError(400, 'Missing banId');

  const prefix = `${server.id}/bans/${banId}`;
  const names = await storageList(prefix);
  const ban = names.includes('0.jpg') ? publicUrl(`${prefix}/0.jpg`) : null;
  const replay = names.filter((n) => /^r\d+\.jpg$/.test(n)).sort().map((n) => publicUrl(`${prefix}/${n}`));
  send(res, 200, { ban, replay });
});
