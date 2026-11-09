// node serve.js  ->  http://localhost:8787  (index.html도 그냥 더블클릭으로 열림. 이건 선택)
const http = require('http'), fs = require('fs'), path = require('path');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png' };
http.createServer((req, res) => {
  const f = path.join(__dirname, decodeURIComponent(req.url.split('?')[0].split('#')[0]) === '/' ? 'index.html' : req.url.split('?')[0]);
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}).listen(8787, () => console.log('http://localhost:8787'));
