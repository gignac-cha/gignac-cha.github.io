import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE_PORT = Number(process.env.FOOTPRINT_PAGE_PORT ?? 4173);
const COLLECTOR_PORT = Number(process.env.FOOTPRINT_COLLECTOR_PORT ?? 4174);

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

type Route = { file: string; type: string };

const routes = new Map<string, Route>([
  ['/app.html', { file: join(packageRoot, 'tests', 'fixtures', 'app.html'), type: 'text/html; charset=utf-8' }],
  ['/blank.html', { file: join(packageRoot, 'tests', 'fixtures', 'blank.html'), type: 'text/html; charset=utf-8' }],
  [
    '/footprint.bundle.js',
    { file: join(packageRoot, 'outputs', 'footprint.bundle.js'), type: 'text/javascript; charset=utf-8' },
  ],
]);

const page = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PAGE_PORT}`);
  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    return;
  }
  const route = routes.get(url.pathname);
  if (!route) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const content = await readFile(route.file);
    response.writeHead(200, { 'Content-Type': route.type, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain' });
    response.end(String(error));
  }
});

type CollectedRequest = {
  method: string;
  path: string;
  origin: string | null;
  contentType: string | null;
  body: string;
};

const requests: CollectedRequest[] = [];

const collector = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${COLLECTOR_PORT}`);
  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.end('ok');
    return;
  }
  if (request.method === 'GET' && url.pathname === '/requests') {
    const path = url.searchParams.get('path');
    const matched = requests.filter((entry) => !path || entry.path === path);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(matched));
    return;
  }
  let body = '';
  request.on('data', (chunk) => {
    body += chunk;
  });
  request.on('end', () => {
    requests.push({
      method: request.method ?? '',
      path: url.pathname,
      origin: request.headers.origin ?? null,
      contentType: request.headers['content-type'] ?? null,
      body,
    });
    response.writeHead(204);
    response.end();
  });
});

page.listen(PAGE_PORT, '127.0.0.1', () => {
  console.log(`[footprint:tests] page server on http://127.0.0.1:${PAGE_PORT}`);
});
collector.listen(COLLECTOR_PORT, '127.0.0.1', () => {
  console.log(`[footprint:tests] collector (no CORS headers) on http://127.0.0.1:${COLLECTOR_PORT}`);
});
