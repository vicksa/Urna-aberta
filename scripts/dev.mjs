import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { Readable } from 'node:stream';
import { GET } from '../api/election.js';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
const files = new Set(['index.html','style.css','app.js','config.js','collective-client.js','collective.css','admin.html','admin.js','votacao.html','votacao.js']);
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:8000');
    if (url.pathname === '/api/election') {
      const request = new Request(url, { method: req.method, headers: req.headers, ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      const response = await GET(request); res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!files.has(file)) { res.writeHead(404); res.end('Não encontrado'); return; }
    const data = await readFile(resolve(file)); res.writeHead(200, { 'Content-Type': `${types[extname(file)]}; charset=utf-8` }); res.end(data);
  } catch { res.writeHead(500); res.end('Falha no servidor local'); }
});
server.listen(8000, '0.0.0.0', () => console.log('Urna Aberta: http://localhost:8000'));
