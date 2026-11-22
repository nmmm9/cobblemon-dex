// 전설 탭 "지도에서 보이는 모습": 전설 구조물 파일(nbt)을 위에서 내려다본 그림으로 img/struct/<구조물 id>.png 에 그림
// build.js 가 img/ 를 비운 직후 require 해서 그림. 그 뒤 build.js 는 그림이 있는 구조물에만 표시(mm)를 붙임
// 칸마다 가장 위 블록의 텍스처 평균색 + 북쪽 칸과의 높이 차이로 명암 (바닐라 지도·Xaero 미니맵과 같은 방식). 위쪽 = 북쪽
// 여러 조각으로 된 구조물(jigsaw)은 조각을 이어 붙임. 조각 고르기는 가중치가 가장 큰 것, 회전은 맞는 첫 방향이라 게임과 조금 다를 수 있음
const fs = require('fs'), path = require('path'), z = require('zlib');
const RAW = path.join(__dirname, 'raw'), OUT = path.join(__dirname, 'img', 'struct');
const LAYERS = ['cv', 'cvx'].flatMap(d => fs.existsSync(path.join(RAW, d)) ? fs.readdirSync(path.join(RAW, d)).sort().map(x => path.join(RAW, d, x)) : []);
const last = rel => { let hit = null; for (const L of LAYERS) { const f = path.join(L, rel); if (fs.existsSync(f)) hit = f; } return hit; }; // 같은 경로는 뒤 레이어가 이김
const readJ = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const split = id => id.includes(':') ? id.split(':') : ['minecraft', id];

// ---------- NBT ----------
function nbt(buf) {
  const b = z.gunzipSync(buf); let p = 0;
  const u8 = () => b[p++], str = () => { const n = b.readUInt16BE(p); p += 2; const s = b.toString('utf8', p, p + n); p += n; return s; };
  const pl = t => { switch (t) {
    case 1: return b.readInt8(p++); case 2: { const v = b.readInt16BE(p); p += 2; return v; } case 3: { const v = b.readInt32BE(p); p += 4; return v; }
    case 4: p += 8; return 0; case 5: { const v = b.readFloatBE(p); p += 4; return v; } case 6: p += 8; return 0;
    case 7: { const n = b.readInt32BE(p); p += 4 + n; return 0; } case 8: return str();
    case 9: { const et = u8(), n = b.readInt32BE(p); p += 4; const a = []; for (let i = 0; i < n; i++) a.push(pl(et)); return a; }
    case 10: { const o = {}; for (;;) { const t2 = u8(); if (!t2) return o; o[str()] = pl(t2); } }
    case 11: { const n = b.readInt32BE(p); p += 4; const a = []; for (let i = 0; i < n; i++) { a.push(b.readInt32BE(p)); p += 4; } return a; }
    case 12: { const n = b.readInt32BE(p); p += 4 + 8 * n; return 0; } } };
  u8(); str(); return pl(10);
}
const TPL = {};
const template = id => TPL[id] ??= (() => {
  const [ns, p] = split(id), f = last(`data/${ns}/structure/${p}.nbt`); if (!f) return null;
  const r = nbt(fs.readFileSync(f)), pal = r.palette || r.palettes[0];
  const blocks = r.blocks.map(x => ({ pos: x.pos, name: pal[x.state].Name, props: pal[x.state].Properties || {}, nbt: x.nbt }));
  const jig = blocks.filter(x => x.name === 'minecraft:jigsaw' && x.nbt).map(x => { const [front, top] = (x.props.orientation || 'north_up').split('_'); return { pos: x.pos, front, top, name: x.nbt.name, target: x.nbt.target, pool: x.nbt.pool }; });
  return { size: r.size, blocks, jig };
})();

// ---------- jigsaw 조립 ----------
const DIR = { north: [0, 0, -1], east: [1, 0, 0], south: [0, 0, 1], west: [-1, 0, 0], up: [0, 1, 0], down: [0, -1, 0] };
const OPP = { north: 'south', south: 'north', east: 'west', west: 'east', up: 'down', down: 'up' };
const CW = ['north', 'east', 'south', 'west'];
const rotDir = (d, r) => CW.includes(d) ? CW[(CW.indexOf(d) + r) % 4] : d;
const rotPos = ([x, y, zz], [sx, , sz], r) => [[x, y, zz], [sz - 1 - zz, y, x], [sx - 1 - x, y, sz - 1 - zz], [zz, y, sx - 1 - x]][r];
const rotSize = ([sx, sy, sz], r) => r % 2 ? [sz, sy, sx] : [sx, sy, sz];
const poolEls = pool => { const [ns, p] = split(pool), f = last(`data/${ns}/worldgen/template_pool/${p}.json`); return f ? readJ(f).elements.filter(e => e.element.location).sort((a, b) => (b.weight || 1) - (a.weight || 1)) : []; };
const hit = (a, b) => a.min.every((v, i) => v <= b.max[i]) && b.min.every((v, i) => v <= a.max[i]);
function assemble(startPool, maxDepth) {
  const first = poolEls(startPool)[0]; if (!first) return [];
  const mk = (id, r, off) => { const t = template(id), s = rotSize(t.size, r); return { t, r, off, box: { min: off, max: off.map((v, i) => v + s[i] - 1) } }; };
  const pieces = [mk(first.element.location, 0, [0, 0, 0])], queue = [[pieces[0], 0]];
  while (queue.length) {
    const [pc, depth] = queue.shift(); if (depth >= maxDepth) continue;
    for (const J of pc.t.jig) {
      if (!J.pool || J.pool === 'minecraft:empty') continue;
      const jf = rotDir(J.front, pc.r), jt = rotDir(J.top, pc.r), jp = rotPos(J.pos, pc.t.size, pc.r).map((v, i) => v + pc.off[i]);
      place: for (const el of poolEls(J.pool)) {
        const T = template(el.element.location); if (!T) continue;
        for (let r = 0; r < 4; r++) for (const K of T.jig) {
          if (K.name !== J.target || rotDir(K.front, r) !== OPP[jf]) continue;
          if ((jf === 'up' || jf === 'down') && CW.includes(K.top) && rotDir(K.top, r) !== jt) continue;
          const kp = rotPos(K.pos, T.size, r), off = jp.map((v, i) => v + DIR[jf][i] - kp[i]), c = mk(el.element.location, r, off);
          if (pieces.some(q => q !== pc && hit(q.box, c.box))) continue; // 다른 조각과 겹치면 다른 방향·조각
          pieces.push(c); queue.push([c, depth + 1]); break place;
        }
      }
    }
  }
  return pieces;
}

// ---------- 블록 색: 블록 모델 -> 텍스처 평균색 ----------
function pngAvg(f) {
  const b = fs.readFileSync(f); let p = 8, w, h, bd, ct, plte, trns; const idat = [];
  while (p < b.length) { const n = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + n); p += 12 + n;
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; } else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], bpp = Math.max(1, ch * bd / 8), stride = Math.ceil(w * ch * bd / 8), raw = z.inflateSync(Buffer.concat(idat));
  let prev = Buffer.alloc(stride), sum = [0, 0, 0], wsum = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) { const a = i >= bpp ? line[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      line[i] = (line[i] + [0, a, up, (a + up) >> 1, (() => { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); return pa <= pb && pa <= pc ? a : pb <= pc ? up : c; })()][ft]) & 255; }
    for (let x = 0; x < w; x++) {
      let r, g, bl, al = 255;
      if (ct === 3) { const bit = x * bd, idx = bd === 8 ? line[x] : (line[bit >> 3] >> (8 - bd - (bit & 7))) & ((1 << bd) - 1); [r, g, bl] = [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2]]; if (trns && idx < trns.length) al = trns[idx]; }
      else if (bd !== 8) return null; // 16비트 텍스처는 없음
      else { const o = x * ch; if (ch <= 2) { r = g = bl = line[o]; if (ch === 2) al = line[o + 1]; } else { [r, g, bl] = [line[o], line[o + 1], line[o + 2]]; if (ch === 4) al = line[o + 3]; } }
      if (al < 16) continue; sum[0] += r * al; sum[1] += g * al; sum[2] += bl * al; wsum += al;
    }
    prev = line;
  }
  return wsum ? sum.map(v => v / wsum) : null;
}
const texFile = ref => { const [ns, p] = split(ref.replace(/^#/, '')); return last(`assets/${ns}/textures/${p.includes('/') ? p : 'block/' + p}.png`); };
function modelTex(ns, n) {
  let f = last(`assets/${ns}/models/block/${n}.json`); if (!f) return null;
  const tex = {}; let guard = 0;
  while (f && guard++ < 10) { const m = readJ(f); for (const [k, v] of Object.entries(m.textures || {})) tex[k] ??= v; if (!m.parent) break; const [pn, pp] = split(m.parent); f = last(`assets/${pn}/models/${pp}.json`); }
  const res = k => { let v = tex[k], g = 0; while (v && v.startsWith('#') && g++ < 10) v = tex[v.slice(1)]; return v; };
  for (const k of ['top', 'end', 'up', 'all', 'texture', 'cross', 'plant', 'particle', 'side', 'wool', 'pattern']) { const v = res(k); if (v && texFile(v)) return texFile(v); }
  return null;
}
// 모델이 없을 때 텍스처 이름 추측: 접두어(waxed_ 등)를 떼고, 계단·반블록·담장은 원래 블록(벽돌 계열은 끝에 s), 깃발은 같은 색 양털, 작물은 다 자란 단계
const FALL = n => [n, n.replace(/^(waxed_|stripped_)/, '')].flatMap(m => [m, m + '_top', m + '_0', m + '_stage3', m.replace(/_(stairs|slab|wall|fence_gate|fence|button|pressure_plate|carpet)$/, ''),
  m.replace(/_(stairs|slab|wall)$/, 's'), m.replace(/_(stairs|slab|fence_gate|fence|button|pressure_plate|(wall_)?(hanging_)?sign)$/, '_planks'), m.replace(/_(wall_)?banner$/, '_wool')]);
const TINT = { grass: [124, 189, 107], foliage: [89, 174, 48], spruce: [97, 153, 97], birch: [128, 167, 85], water: [63, 118, 228] };
const tintOf = n => /^(spruce)_leaves$/.test(n) ? TINT.spruce : /^birch_leaves$/.test(n) ? TINT.birch : /(?<!cherry|azalea|flowering_azalea)_leaves$/.test(n) && !/cherry|azalea/.test(n) || /^(vine|lily_pad)$/.test(n) ? TINT.foliage
  : /^(grass_block|short_grass|grass|tall_grass|fern|large_fern|sugar_cane)$/.test(n) ? TINT.grass : null;
const COL = {};
const colorOf = id => COL[id] ??= (() => {
  const [ns, n] = split(id);
  if (/^(water|bubble_column|kelp|kelp_plant|seagrass|tall_seagrass)$/.test(n)) return TINT.water;
  if (n === 'lava') return [207, 92, 15];
  let f = modelTex(ns, n); if (!f) for (const c of FALL(n)) if ((f = last(`assets/${ns}/textures/block/${c}.png`))) break;
  const avg = f && pngAvg(f); if (!avg) return [128, 128, 128]; // 텍스처를 못 찾은 모드 블록은 회색
  const t = tintOf(n); return t ? avg.map((v, i) => v * t[i] / 255) : avg;
})();

// ---------- PNG 저장 ----------
function pngWrite(f, w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]), crc = Buffer.alloc(4); crc.writeUInt32BE(z.crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(f, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}

// ---------- 위에서 본 그림 ----------
const SKIP = /^(minecraft:(air|cave_air|void_air|structure_void|jigsaw|barrier|light|structure_block)|lumymon:(ghost_barrier|summon_anchor|summon_trigger))$/; // 안 보이는 블록
function render(st) {
  const [ns, p] = split(st), sf = last(`data/${ns}/worldgen/structure/${p}.json`); if (!sf) return 'no structure';
  const s = readJ(sf); if (!s.start_pool) return 'not jigsaw';
  const pieces = assemble(s.start_pool, s.size ?? 7); if (!pieces.length) return 'no pieces';
  const top = new Map(); let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const pc of pieces) for (const bl of pc.t.blocks) {
    if (SKIP.test(bl.name)) continue;
    const [x, y, zz] = rotPos(bl.pos, pc.t.size, pc.r).map((v, i) => v + pc.off[i]), k = x + ',' + zz, cur = top.get(k);
    if (!cur || y > cur.y) top.set(k, { y, name: bl.name });
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, zz); z1 = Math.max(z1, zz);
  }
  const W = x1 - x0 + 1, H = z1 - z0 + 1, S = Math.max(2, Math.min(6, Math.floor(360 / Math.max(W, H))));
  const img = Buffer.alloc(W * S * H * S * 4);
  for (const [k, { y, name }] of top) {
    const [x, zz] = k.split(',').map(Number), n = top.get(x + ',' + (zz - 1));
    const shade = !n ? 220 : y > n.y ? 255 : y < n.y ? 180 : 220; // 바닐라 지도 명암 3단계
    const c = colorOf(name).map(v => Math.round(Math.min(255, v * shade / 255)));
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const o = (((zz - z0) * S + dy) * W * S + (x - x0) * S + dx) * 4; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255; }
  }
  pngWrite(path.join(OUT, st.replace(/[:/]/g, '_') + '.png'), W * S, H * S, img);
  return `${pieces.length}조각 ${W}x${H}칸`;
}

// 전설 탭 구조물 = legends.js 의 st (구조물 id) 전부. 미로처럼 무작위로 이어지는 지하 구조물은 그림이 매번 달라서 뺌
const NO = new Set(['legendarymonuments:turnback_cave']);
const ids = [...new Set(require('./legends.js').list.flatMap(e => [e.st, ...(e.via || []).map(v => v[1])]).filter(Boolean))].filter(id => !NO.has(id));
fs.mkdirSync(OUT, { recursive: true });
const res = ids.map(id => [id, render(id)]), bad = res.filter(([, r]) => !/조각/.test(r));
console.log(`구조물 지도 그림 ${res.length - bad.length}개`, bad.length ? '· 못 그림: ' + bad.map(x => x.join(' ')).join(', ') : '');
