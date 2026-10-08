// Saves files POSTed by the dev scripts (scripts/hifi-shot.js) into a folder: node scripts/drop-server.mjs <folder> [port]
// Listens on 127.0.0.1 only. Dev tooling; nothing ships it.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? '.'), port = Number(process.argv[3] ?? 5174);
mkdirSync(dir, { recursive: true });
createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method !== 'POST') return res.end(); // the browser's CORS preflight
  const name = basename(new URL(req.url, 'http://localhost').searchParams.get('name') ?? 'drop.bin'); // basename: nothing lands outside the folder
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => { writeFileSync(join(dir, name), Buffer.concat(chunks)); console.log(`saved ${name}`); res.end('ok'); });
}).listen(port, '127.0.0.1', () => console.log(`drop server: http://127.0.0.1:${port} -> ${dir}`));
