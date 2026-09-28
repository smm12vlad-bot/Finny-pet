import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const dist = path.join(projectRoot, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const entry of ['index.html', 'manifest.webmanifest', 'src', 'content', 'vendor', 'assets']) {
  await cp(path.join(projectRoot, entry), path.join(dist, entry), { recursive: true });
}

console.log(`Production-сборка создана: ${dist}`);
