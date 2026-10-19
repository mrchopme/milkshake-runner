// The submission bot's first step: pulls the level JSON out of a "Submit a level" issue and decides a safe file name.
// Validation proper is the lab's (`node scripts/level-lab.js play <file>`), which the workflow runs next.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function extractLevel(body) {
  // `\s*` on both sides of the fence absorbs the \r of a CRLF body.
  const m = String(body ?? '').match(/```json\s*\n([\s\S]*?)\n\s*```/);
  if (!m) throw new Error('no JSON block found in the issue; paste the whole level file into the Level JSON box');
  let level;
  try { level = JSON.parse(m[1]); } catch (e) { throw new Error(`the level is not valid JSON: ${e.message}`); }
  if (!level || typeof level !== 'object' || Array.isArray(level)) throw new Error('the level must be a JSON object');
  // The id becomes the file name and the branch name, so it is the one thing checked here.
  if (typeof level.id !== 'string' || !/^[a-z0-9-]{1,60}$/.test(level.id)) throw new Error('id must be 1-60 characters of a-z, 0-9 and -');
  return level;
}

export function writeLevel(body, dir) {
  const level = extractLevel(body);
  const path = join(dir, `${level.id}.json`);
  if (existsSync(path)) throw new Error(`id "${level.id}" is already a level in the game; pick another`);
  writeFileSync(path, JSON.stringify(level, null, 2) + '\n');
  return { path, level };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { level } = writeLevel(process.env.ISSUE_BODY, process.argv[2] ?? fileURLToPath(new URL('../levels', import.meta.url)));
    // One line each, for $GITHUB_OUTPUT.
    console.log(`id=${level.id}\ntitle=${String(level.title ?? level.id).replace(/\s+/g, ' ').trim().slice(0, 60)}`);
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
