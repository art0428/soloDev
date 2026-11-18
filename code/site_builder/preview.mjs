#!/usr/bin/env node
/**
 * 本機預覽 docs/：node code/site_builder/preview.mjs [埠號]
 * 只給預覽用的最小靜態伺服器，只綁 127.0.0.1。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');
const PORT = Number(process.argv[2] || process.env.PORT || 61002);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(DOCS, path));
  if (!file.startsWith(DOCS)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('找不到這個檔案');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`docs 預覽：http://127.0.0.1:${PORT}/`));
