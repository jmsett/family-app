import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Preview exactly the committed files served by Pages, without exposing source.
const root = fileURLToPath(new URL('..', import.meta.url));
const files = new Set<string>(
  JSON.parse(readFileSync(join(root, '.pages-files.json'), 'utf8')),
);
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};
createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file =
    path === '/family-app/' ? 'index.html' : path.slice('/family-app/'.length);
  if (
    !path.startsWith('/family-app/') ||
    !files.has(file) ||
    !['GET', 'HEAD'].includes(request.method ?? '')
  ) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const content = readFileSync(join(root, file));
    response.writeHead(200, {
      'Content-Type': types[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Content-Length': content.length,
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(4173, 'localhost', () =>
  console.log('Pages preview: http://localhost:4173/family-app/'),
);
