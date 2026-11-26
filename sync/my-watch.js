// 내 PC용: 구글 드라이브 cobble-sync 폴더(친구 PC가 보내는 코블몬 저장 파일)를 1분마다 확인해서
// 바뀌면 도감 폴더의 my.js(window.MY)로 풀어 씀. index.html의 "내 포켓몬" 탭이 이걸 읽음. my.js는 .gitignore.
// node sync/my-watch.js [폴더 경로]   (경로 생략하면 X:\내 드라이브\cobble-sync 또는 X:\My Drive\cobble-sync 를 찾음)
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const OUT = path.join(__dirname, '..', 'my.js');

function findDir() {
  if (process.argv[2]) return process.argv[2];
  for (const L of 'DEFGHIJKLMNOPQRSTUVWXYZ') for (const n of ['내 드라이브', 'My Drive']) {
    const p = `${L}:\\${n}\\cobble-sync`; if (fs.existsSync(p)) return p;
  }
  return null;
}

// NBT(big-endian) -> JS. long은 Number로(UUID 조각 등은 정밀도가 깨질 수 있지만 표시용이라 무시)
function nbt(buf) {
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  let p = 0;
  const str = () => { const n = buf.readUInt16BE(p); p += 2; const s = buf.toString('utf8', p, p + n); p += n; return s; };
  const arr = (n, f) => { const a = []; for (let i = 0; i < n; i++) a.push(f()); return a; };
  const tag = t => {
    switch (t) {
      case 1: return buf.readInt8(p++);
      case 2: p += 2; return buf.readInt16BE(p - 2);
      case 3: p += 4; return buf.readInt32BE(p - 4);
      case 4: p += 8; return Number(buf.readBigInt64BE(p - 8));
      case 5: p += 4; return buf.readFloatBE(p - 4);
      case 6: p += 8; return buf.readDoubleBE(p - 8);
      case 7: { const n = buf.readInt32BE(p); p += 4; const a = [...buf.subarray(p, p + n)]; p += n; return a; }
      case 8: return str();
      case 9: { const et = buf[p++], n = buf.readInt32BE(p); p += 4; return arr(n, () => tag(et)); }
      case 10: { const o = {}; for (;;) { const t2 = buf[p++]; if (!t2) return o; const k = str(); o[k] = tag(t2); } }
      case 11: { const n = buf.readInt32BE(p); p += 4; return arr(n, () => tag(3)); }
      case 12: { const n = buf.readInt32BE(p); p += 4; return arr(n, () => tag(4)); }
      default: throw new Error('알 수 없는 NBT 태그 ' + t);
    }
  };
  const t = buf[p++]; str(); return tag(t);
}

function walk(d, base = d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) walk(f, base, out);
    else if (!/\.(tmp|bat|ps1)$/i.test(e.name)) out.push({ f, rel: path.relative(base, f).replace(/\\/g, '/'), m: fs.statSync(f).mtimeMs });
  }
  return out;
}

const DIR = findDir();
if (!DIR) { console.log('cobble-sync 폴더를 못 찾았어. 경로를 직접 넣어줘: node sync/my-watch.js "G:\\내 드라이브\\cobble-sync"'); process.exit(1); }
console.log('보는 폴더:', DIR, '\n쓰는 파일:', OUT);
let last = '';
function tick() {
  let files; try { files = walk(DIR); } catch (e) { return console.log('폴더 읽기 실패:', e.message); }
  const sig = files.map(x => x.rel + x.m).join('|');
  if (sig === last) return;
  const MY = { t: Math.max(0, ...files.map(x => x.m)), files: {} };
  for (const x of files) {
    try {
      const b = fs.readFileSync(x.f);
      MY.files[x.rel] = /\.json$/i.test(x.rel) ? JSON.parse(b.toString('utf8')) : nbt(b);
    } catch (e) { console.log('못 읽음:', x.rel, e.message); return; } // 드라이브가 받는 중일 수 있음 -> 다음 바퀴
  }
  fs.writeFileSync(OUT, 'window.MY=' + JSON.stringify(MY) + ';\n');
  last = sig;
  console.log(`[${new Date().toLocaleTimeString()}] 파일 ${files.length}개 -> my.js`);
}
tick(); setInterval(tick, 60 * 1000);
