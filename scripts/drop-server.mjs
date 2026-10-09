// Saves files POSTed by the dev scripts (scripts/hifi-shot.js) into a folder: node scripts/drop-server.mjs <folder> [port]
// Listens on 127.0.0.1 only and takes files only from pages served from localhost, so another site open in the browser
// cannot write into the folder. Dev tooling; nothing ships it.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

if (!process.argv[2]) { console.error('usage: node scripts/drop-server.mjs <folder> [port]'); process.exit(1); }
const dir = resolve(process.argv[2]), port = Number(process.argv[3] ?? 5174);
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
mkdirSync(dir, { recursive: true });
createServer((req, res) => {
  const origin = req.headers.origin ?? '';
  if (!LOCAL.test(origin)) { res.statusCode = 403; return res.end(); }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method !== 'POST') return res.end(); // the browser's CORS preflight
  const asked = basename(new URL(req.url, 'http://localhost').searchParams.get('name') ?? ''); // basename: nothing lands outside the folder
  const name = asked && asked !== '.' && asked !== '..' ? asked : 'drop.bin';
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    try { writeFileSync(join(dir, name), Buffer.concat(chunks)); console.log(`saved ${name}`); res.end('ok'); }
    catch (err) { console.error(`could not save ${name}:`, err.message); res.statusCode = 500; res.end(); }
  });
}).listen(port, '127.0.0.1', () => console.log(`drop server: http://127.0.0.1:${port} -> ${dir}`));
