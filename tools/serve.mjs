// Minimal static server for a build dir (clean URLs + 404 page).
// Usage: npm run preview [-- --port 4173] [-- --dir dist]
//        node tools/serve.mjs --dir <build dir> --port <n>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const root = path.resolve(arg('--dir', 'dist'));
const port = Number(arg('--port', 4173)) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

if (!fs.existsSync(root)) {
  console.error(`No build at ${root}. Run: node build.mjs --out ${path.relative('.', root) || '.'}`);
  process.exit(1);
}

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, p);
  if (file !== root && !file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  let status = 200;
  if (!fs.existsSync(file)) { file = path.join(root, '404.html'); status = 404; }
  res.writeHead(status, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}  (${path.relative('.', root) || root})`));
