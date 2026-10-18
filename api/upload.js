// FiveM: upload a screenshot (ban proof, replay frame or live view)
import { wrap, send, readBody, requireLicense, httpError, storageUpload } from './_lib.js';

const safe = (v) => String(v || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);

export default wrap(async (req, res) => {
  if (req.method !== 'POST') throw httpError(405, 'POST only');
  const server = await requireLicense(req);
  const b = readBody(req);

  const m = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/s.exec(String(b.image || ''));
  if (!m) throw httpError(400, 'Invalid image');
  const buffer = Buffer.from(m[2], 'base64');
  if (!buffer.length || buffer.length > 2.5 * 1024 * 1024) throw httpError(400, 'Image too big');

  let path;
  if (b.kind === 'ban') {
    const i = Math.max(0, Math.min(9, parseInt(b.index, 10) || 0));
    path = `${server.id}/bans/${safe(b.banId).toUpperCase()}/${i === 0 ? '0' : `p${i}`}.jpg`;
  }
  else if (b.kind === 'replay') path = `${server.id}/bans/${safe(b.banId).toUpperCase()}/r${String(Math.max(0, Math.min(999, parseInt(b.index, 10) || 0))).padStart(3, '0')}.jpg`;
  else if (b.kind === 'live') path = `${server.id}/live/${safe(b.identifier)}.jpg`;
  else throw httpError(400, 'Invalid kind');

  const url = await storageUpload(path, buffer);
  send(res, 201, { ok: true, url });
});
