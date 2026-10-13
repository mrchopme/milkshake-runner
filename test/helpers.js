import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

// Walks a content (or pack) directory the way Vite's import.meta.glob does, so tests build the same registry.
// prefix is the path the browser sees: 'content' for content/, 'packs/hifi' for packs/hifi/.
export async function discover(root, prefix = 'content', dir = root) {
  const entries = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) entries.push(...(await discover(root, prefix, p)));
    else if (name.endsWith('.js')) {
      const rel = relative(root, p).split('\\').join('/');
      entries.push({ path: `${prefix}/${rel}`, module: (await import(pathToFileURL(p))).default });
    }
  }
  return entries;
}
