import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

// Generate a cache version from the complete static build, including hashed chunks.
export function pwa(): Plugin {
  let output: string;
  return {
    name: 'family-pwa',
    apply: 'build',
    configResolved(config) {
      output = join(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = readdirSync(output, {
        recursive: true,
        withFileTypes: true,
      })
        .filter((file) => file.isFile() && file.name !== 'sw.js')
        .map((file) =>
          join(file.parentPath, file.name).slice(output.length + 1),
        )
        .sort();
      const hash = createHash('sha256');
      for (const file of files)
        hash.update(file).update(readFileSync(join(output, file)));
      writeFileSync(
        join(output, 'sw.js'),
        `
const VERSION = '${hash.digest('hex').slice(0, 16)}';
const PREFIX = 'family-shell-' + encodeURIComponent(self.registration.scope) + '-';
const CACHE = PREFIX + VERSION;
const FILES = ${JSON.stringify(files)}.map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Cache only the built application shell. Never intercept GitHub or private API data.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then(cache => cache.match(new URL('index.html', self.registration.scope).href, { ignoreVary: true }))));
  } else if (FILES.includes(url.href)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(request, { ignoreVary: true })) || fetch(request)));
  }
});
`,
      );
    },
  };
}
