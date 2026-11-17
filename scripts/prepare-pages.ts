import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Commit browser-ready files for Pages → main → /(root), as in nunz-app.
const root = fileURLToPath(new URL('..', import.meta.url));
const source = join(root, 'apps/web/dist');
const manifest = join(root, '.pages-files.json');
const allowed =
  /^(index\.html|sw\.js|manifest\.webmanifest|(?:assets|icons)\/[a-zA-Z0-9_.-]+)$/;
const files = readdirSync(source, { recursive: true, withFileTypes: true })
  .filter((file) => file.isFile())
  .map((file) => join(file.parentPath, file.name).slice(source.length + 1))
  .sort();
if (
  !files.includes('index.html') ||
  !files.includes('sw.js') ||
  files.some((file) => !allowed.test(file))
) {
  throw new Error('Unexpected Pages build. No published files were changed.');
}
const previous: string[] = existsSync(manifest)
  ? JSON.parse(readFileSync(manifest, 'utf8'))
  : [];
if (
  !Array.isArray(previous) ||
  previous.some((file) => typeof file !== 'string' || !allowed.test(file))
) {
  throw new Error(
    'Invalid Pages artifact list. No published files were changed.',
  );
}
for (const file of previous) {
  if (!files.includes(file)) rmSync(join(root, file), { force: true });
}
for (const file of files) {
  const destination = join(root, file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(source, file), destination);
}
writeFileSync(join(root, '.nojekyll'), '');
writeFileSync(manifest, JSON.stringify(files, null, 2) + '\n');
console.log(`Prepared ${files.length} public app files for branch deployment.`);
