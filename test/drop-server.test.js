import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createServer, request } from 'node:http';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../scripts/drop-server.mjs', import.meta.url));
const freePort = () => new Promise((res) => { const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
const post = (port, name, origin) => new Promise((res, rej) => {
  const req = request({ host: '127.0.0.1', port, method: 'POST', path: `/?name=${encodeURIComponent(name)}`, headers: origin ? { origin } : {} }, (r) => { r.resume(); r.on('end', () => res(r.statusCode)); });
  req.on('error', rej);
  req.end('x');
});

test('the drop server saves only what a localhost page sends, and a bad name never crashes it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'drop-')), port = await freePort();
  const server = spawn(process.execPath, [SCRIPT, dir, String(port)]);
  try {
    await new Promise((res, rej) => { server.stdout.once('data', res); server.once('exit', rej); });
    assert.equal(await post(port, 'evil.png', 'http://evil.example'), 403, 'another site cannot write here');
    assert.equal(await post(port, 'bare.png'), 403, 'neither can a request with no origin');
    assert.ok(!existsSync(join(dir, 'evil.png')) && !existsSync(join(dir, 'bare.png')));
    assert.equal(await post(port, 'shot.png', 'http://localhost:5177'), 200);
    assert.equal(readFileSync(join(dir, 'shot.png'), 'utf8'), 'x');
    for (const name of ['', '..']) assert.equal(await post(port, name, 'http://127.0.0.1:5177'), 200, `name "${name}"`);
    assert.ok(existsSync(join(dir, 'drop.bin')), 'an empty or dot name is saved as drop.bin');
    assert.equal(server.exitCode, null, 'still running');
  } finally { server.kill(); }
});

test('the drop server wants its folder spelled out', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /usage: node scripts\/drop-server\.mjs <folder> \[port\]/);
});
