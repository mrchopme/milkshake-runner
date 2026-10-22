import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

// Walks a content (or pack) directory the way Vite's import.meta.glob does, so tests build the same registry.
// prefix is the path the browser sees: 'content' for content/, 'packs/hifi' for packs/hifi/.
export async function discover(root, prefix = 'content', dir = root) {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!(prefix.startsWith('packs/') && dir === root && name === 'lib')) entries.push(...(await discover(root, prefix, p))); } // a pack's lib/ holds helpers, not overlays
    else if (name.endsWith('.js')) {
      const rel = relative(root, p).split('\\').join('/');
      entries.push({ path: `${prefix}/${rel}`, module: (await import(pathToFileURL(p))).default });
    }
  }
  return entries;
}

// THREE objects (materials, textures, geometries, meshes) compare by identity only. ponytail: a FAILING strict assert.equal on two
// different ones inspects a texture's 131,072 bytes one a line and Myers-diffs the two lists (65 GB: the Mac froze twice,
// 2026-10-20/21), so these give assert nothing to diff and name the object instead.
export const same = (a, b, msg = 'the same object') => assert.ok(a === b, msg);
export const notSame = (a, b, msg = 'different objects') => assert.ok(a !== b, msg);
