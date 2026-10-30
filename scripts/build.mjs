import { mkdir, copyFile, rm } from 'node:fs/promises';
await rm('public', { recursive: true, force: true });
await mkdir('public', { recursive: true });
for (const file of ['index.html', 'style.css', 'app.js', 'config.js', 'collective-client.js', 'collective.css', 'admin.html', 'admin.js', 'votacao.html', 'votacao.js']) await copyFile(file, `public/${file}`);
console.log('Site estático preparado em public/. A API é implantada separadamente pela Vercel.');
