// Node server for Render (or any host). Serves the site + runs the api/ files.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.json': 'application/json', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
};
const BLOCKED = ['api', 'node_modules', '.env', 'server.js', 'package.json', 'supabase.sql', '.git'];

const handlers = new Map();
async function getHandler(route) {
  if (handlers.has(route)) return handlers.get(route);
  const file = path.join(ROOT, 'api', `${route}.js`);
  if (!file.startsWith(path.join(ROOT, 'api')) || route.split('/').some((p) => p.startsWith('_')) || !fs.existsSync(file)) {
    handlers.set(route, null);
    return null;
  }
  const mod = await import(pathToFileURL(file).href);
  handlers.set(route, mod.default);
  return mod.default;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 6e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve(data); }
    });
    req.on('error', () => resolve({}));
  });
}

// Make Node's res look like Vercel's (status / json)
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      return res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream');
    res.setHeader('Content-Length', st.size);
    fs.createReadStream(file).pipe(res);
  });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    if (pathname.startsWith('/api/')) {
      const handler = await getHandler(pathname.slice(5).replace(/\/$/, ''));
      wrapRes(res);
      if (!handler) return res.status(404).json({ error: 'Not found' });
      req.query = Object.fromEntries(url.searchParams);
      req.body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      return await handler(req, res);
    }

    if (pathname === '/') pathname = '/index.html';
    const first = pathname.split('/')[1];
    if (BLOCKED.includes(first)) { res.statusCode = 404; return res.end('Not found'); }

    let file = path.join(ROOT, pathname);
    if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
    if (!path.extname(file)) file += '.html'; // /dashboard -> dashboard.html
    serveFile(res, file);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.statusCode = 500; res.end('Server error'); }
  }
}).listen(PORT, () => console.log(`HeRo Shield running on port ${PORT}`));
