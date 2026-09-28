import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const requestedRoot = process.argv[2] || '.';
const root = path.resolve(projectRoot, requestedRoot);
const port = Number(process.env.FINNY_PORT || 4173);
const host = process.env.FINNY_HOST || '127.0.0.1';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
};

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
    let target = path.resolve(root, relativePath);

    if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const info = await stat(target);
      if (info.isDirectory()) target = path.join(target, 'index.html');
    } catch {
      target = path.join(root, 'index.html');
    }

    const body = await readFile(target);
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(body);
  } catch (error) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Ошибка запуска: ${error.message}`);
  }
});

server.listen(port, host, () => {
  const address = `http://127.0.0.1:${port}`;
  console.log(`Финни запущен: ${address}`);
  if (host === '0.0.0.0') {
    try {
      const localAddresses = Object.values(networkInterfaces())
        .flat()
        .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
        .map((entry) => `http://${entry.address}:${port}`);
      for (const localAddress of [...new Set(localAddresses)]) {
        console.log(`Адрес для телефона: ${localAddress}`);
      }
      if (!localAddresses.length) console.log(`Адрес для телефона: http://IP-КОМПЬЮТЕРА:${port}`);
    } catch {
      console.log(`Адрес для телефона: http://IP-КОМПЬЮТЕРА:${port} (IP можно узнать командой ipconfig)`);
    }
  }
  console.log('Для остановки нажмите Ctrl+C.');
  if (process.platform === 'win32' && process.env.FINNY_OPEN === '1') {
    spawn('cmd', ['/c', 'start', '', address], { detached: true, stdio: 'ignore' }).unref();
  }
});
