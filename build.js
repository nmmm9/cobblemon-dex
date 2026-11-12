// raw/ -> data.js   (node build.js)
// raw/cv/NN_*        : COBBLEVERSE 1.7.42 인스턴스에서 뽑은 레이어 (extract-cv.sh). 코블몬 1.7.3 jar -> 애드온 jar -> 코블벌스 데이터팩
//                      번호 순 = 게임 로딩 순. 같은 경로 파일은 뒤 레이어가 덮어쓰고, 태그·언어는 합쳐짐
// raw/mc_ko_kr.json  : Minecraft 1.21.1 Korean lang
// raw/moves.json     : Showdown move data        raw/mc_tags, mc_biomes.txt : vanilla biome tags (misode/mcmeta 1.21.1)
// (raw/data, raw/ko_kr.json 은 예전 코블몬 1.8.4 기준 데이터. 지금은 안 씀)
const fs = require('fs'), path = require('path');

const VERSION = 'COBBLEVERSE 1.7.42 · 코블몬 1.7.3';
const RAW = path.join(__dirname, 'raw');
const LAYERS = fs.readdirSync(path.join(RAW, 'cv')).sort().map(d => path.join(RAW, 'cv', d));
// raw/cvx/N_*: 지방 추가 데이터팩(성도·호연·신오). 챔피언을 이겨야 켜지는 것이라 전설 탭(구조물·조합법)에서만 읽고 다른 탭에는 안 섞음
const XLAYERS = fs.existsSync(path.join(RAW, 'cvx')) ? fs.readdirSync(path.join(RAW, 'cvx')).sort().map(d => path.join(RAW, 'cvx', d)) : [];
const readJ = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, ''));
const walkJson = dir => { const out = []; if (!fs.existsSync(dir)) return out; (function w(d) { for (const f of fs.readdirSync(d)) { const q = path.join(d, f); if (fs.statSync(q).isDirectory()) w(q); else if (f.endsWith('.json')) out.push(q); } })(dir); return out; };
// data/<ns>/<kind>/** 를 레이어 순으로 겹침 (같은 상대경로는 뒤가 이김) -> [{ns, rel, f}]
const dataFiles = (kind, onlyNs, withExtra) => {
  const m = new Map();
  for (const L of withExtra ? [...LAYERS, ...XLAYERS] : LAYERS) {
    const d = path.join(L, 'data');
    if (fs.existsSync(d)) for (const ns of fs.readdirSync(d)) {
      if (onlyNs && ns !== onlyNs) continue;
      const k = path.join(d, ns, kind);
      for (const f of walkJson(k)) { const rel = path.relative(k, f).replace(/\\/g, '/'); m.set(ns + '/' + rel, { ns, rel, f }); }
    }
  }
  return [...m.values()];
};
// 태그는 레이어끼리 합쳐짐 (replace:true면 앞 내용 버림). 바닐라 바이옴 태그는 raw/mc_tags
const tagValues = (ns, kind, p, withExtra) => {
  let vals = [];
  const srcs = [...(ns === 'minecraft' && kind === 'worldgen/biome' ? [path.join(RAW, 'mc_tags', p + '.json')] : []), ...(withExtra ? [...LAYERS, ...XLAYERS] : LAYERS).map(L => path.join(L, 'data', ns, 'tags', kind, p + '.json'))];
  for (const f of srcs) if (fs.existsSync(f)) { const j = readJ(f); if (j.replace) vals = []; vals.push(...j.values); }
  return vals;
};
// 언어: 모든 레이어 en_us를 깔고 ko_kr로 덮음 (한국어 없는 애드온 문구는 영어로 남음)
const lang = {};
for (const lc of ['en_us', 'ko_kr']) for (const L of LAYERS) {
  const a = path.join(L, 'assets');
  if (fs.existsSync(a)) for (const ns of fs.readdirSync(a)) {
    const f = path.join(a, ns, 'lang', lc + '.json');
    if (!fs.existsSync(f)) continue;
    // 게임은 느슨하게 읽어서 쉼표 빠진 줄도 통과함 (메가 쇼다운 ko_kr). 같은 식으로 보정
    try { Object.assign(lang, readJ(f)); } catch { Object.assign(lang, JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/"\s*\n(\s*)"/g, '",\n$1"'))); }
  }
}
lang['item.legendarymonuments.origin_ingot'] ??= 'Origin Ingot'; // 모드에 아이템은 있는데 이름(언어 파일)이 빠져 있음
const mcLang = readJ(path.join(RAW, 'mc_ko_kr.json'));
const sd = readJ(path.join(RAW, 'moves.json'));

const L = (k, fb) => lang[k] ?? fb;
const idOf = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const STAT_KO = { hp: 'HP', attack: '공격', defence: '방어', special_attack: '특공', special_defence: '특방', speed: '스피드' };

// ---------- species ----------
const species = {};
for (const { f } of dataFiles('species', 'cobblemon')) species[path.basename(f, '.json')] = readJ(f);
// species_additions: 메가 쇼다운·코블벌스가 기존 종에 폼·구현 여부 등을 덧붙임. 폼은 이름이 같으면 합치고 없으면 추가
for (const { f } of dataFiles('species_additions')) {
  const a = readJ(f), sp = species[String(a.target).split(':').pop()];
  if (!sp) continue;
  for (const [k, v] of Object.entries(a)) {
    if (k === 'target') continue;
    if (k === 'forms') for (const fm of v) { const i = (sp.forms ??= []).findIndex(x => x.name === fm.name); i < 0 ? sp.forms.push(fm) : Object.assign(sp.forms[i], fm); }
    else sp[k] = v;
  }
}

const formKey = (sid, form) => sid + '-' + form.name.toLowerCase().replace(/[^a-z0-9]/g, '');
// a form worth its own entry: battle-relevant data differs from the base species (gmax/cosmetic forms share everything)
const realForm = (sp, fm) => {
  if (fm.name.endsWith('Gmax')) return false;
  const diff = (a, b) => a !== undefined && JSON.stringify(a) !== JSON.stringify(b);
  return diff(fm.primaryType, sp.primaryType) || diff(fm.secondaryType ?? null, sp.secondaryType ?? null)
    || diff(fm.baseStats, sp.baseStats) || diff(fm.abilities, sp.abilities) || diff(fm.moves, sp.moves);
};

// result "marowak alolan" / "cherrim blossom_form=overcast" -> entry id
function resolveResult(result) {
  const [sid, ...rest] = result.split(' ');
  const sp = species[sid];
  if (!sp) return null;
  for (const tok of rest) {
    const form = (sp.forms || []).find(fm => (fm.aspects || []).includes(tok) && realForm(sp, fm));
    if (form) return formKey(sid, form);
  }
  return sid;
}

// "cobblemon:x" / "minecraft:x" / "x" -> 한국어 이름
const itemKo = id => {
  const rod = id.match(/^(?:cobblemon:)?([a-z_]+)_rod$/);
  if (rod && !lang['item.cobblemon.' + rod[1] + '_rod']) return (lang['item.cobblemon.' + rod[1] + '_ball'] ?? rod[1]) + ' 낚싯대';
  const s = id.replace(/^#/, ''), [ns, bare] = s.includes(':') ? s.split(':') : ['cobblemon', s];
  if (ns === 'minecraft') return mcLang['item.minecraft.' + bare] ?? mcLang['block.minecraft.' + bare] ?? bare;
  return lang[`item.${ns}.${bare}`] ?? lang[`block.${ns}.${bare}`] ?? mcLang['item.minecraft.' + bare] ?? mcLang['block.minecraft.' + bare] ?? bare;
};
// 레시피 재료: {item} | {tag} | [..] -> 한국어 표시
const TAG_KO = { 'minecraft:trapdoors': '다락문', 'c:ingots/copper': '구리 주괴', 'c:ingots/iron': '철 주괴', 'c:ingots/gold': '금 주괴', 'c:ingots/netherite': '네더라이트 주괴', 'c:dusts/redstone': '레드스톤 가루', 'c:gems/diamond': '다이아몬드', 'c:gems/emerald': '에메랄드', 'c:gems/amethyst': '자수정 조각', 'c:gems/quartz': '네더 석영', 'c:crops/wheat': '밀', 'c:rods/wooden': '막대기', 'c:strings': '실', 'c:slime_balls': '슬라임 볼', 'c:eggs': '달걀', 'c:glass_blocks': '유리', 'c:chests': '상자', 'c:leathers': '가죽', 'c:feathers': '깃털', 'c:obsidians': '흑요석', 'c:storage_blocks/iron': '철 블록', 'c:storage_blocks/gold': '금 블록', 'c:storage_blocks/copper': '구리 블록', 'c:nuggets/gold': '금 조각', 'c:nuggets/iron': '철 조각', 'c:dyes': '염료', 'c:mushrooms': '버섯', 'c:seeds': '씨앗', 'c:bones': '뼈', 'c:gunpowders': '화약', 'c:ender_pearls': '엔더 진주', 'c:foods/milk': '우유', 'minecraft:planks': '판자', 'minecraft:logs': '원목', 'minecraft:wool': '양털', 'minecraft:coals': '석탄', 'minecraft:stone_crafting_materials': '조약돌', 'minecraft:wooden_slabs': '나무 반 블록', 'minecraft:leaves': '나뭇잎', 'minecraft:flowers': '꽃', 'minecraft:small_flowers': '꽃', 'minecraft:saplings': '묘목', 'minecraft:sand': '모래', 'minecraft:candles': '양초', 'cobblemon:berries': '열매', 'minecraft:chicken_food': '씨앗', 'cobblemon:held/terrain_seeds': '필드 시드' };
const ingKo = ing => {
  if (!ing) return '';
  if (Array.isArray(ing)) return ing.map(ingKo).join(' / ');
  if (ing.item) return itemKo(ing.item);
  if (ing.tag) {
    const t = ing.tag; if (TAG_KO[t]) return TAG_KO[t];
    const mem = tagItems(t), nm = mem.map(itemKo).find(x => !/^[a-z0-9_]+$/.test(x));
    if (nm) return nm + (mem.length > 1 ? ' 등' : ''); const tail = t.split(/[:/]/).pop(); return (itemKo('cobblemon:' + tail) !== tail ? itemKo('cobblemon:' + tail) : itemKo('minecraft:' + tail.replace(/s$/, ''))) + ' (종류 무관)'; }
  return '?';
};
const moveKo = id => L('cobblemon.move.' + id, sd[id]?.name ?? id);
const typeKo = t => L('cobblemon.type.' + t, t);
const monKo = target => {
  const sid = target.split(' ')[0];
  return L(`cobblemon.species.${sid}.name`, sid);
};
const TIME = { day: '낮', night: '밤', twilight: '해질녘·새벽', dusk: '해질녘', dawn: '새벽', morning: '아침', noon: '정오', afternoon: '오후', evening: '저녁', midnight: '자정' };
const MOON = { FULL_MOON: '보름달', NEW_MOON: '삭', FIRST_QUARTER: '상현', LAST_QUARTER: '하현' };

function reqText(r) {
  switch (r.variant) {
    case 'level': return `Lv.${r.minLevel}`;
    case 'friendship': return `친밀도 ${r.amount}+`;
    case 'time_range': return `${TIME[r.range] ?? r.range}에`;
    case 'biome': {
      const tag = r.biomeCondition ?? r.biomeAnticondition ?? '';
      const name = tag.split('/').pop().replace(/^#?cobblemon:|^#?minecraft:/, '');
      return (r.biomeAnticondition ? '바이옴 제외: ' : '바이옴: ') + name;
    }
    case 'negate': return `NOT(${reqText(r.inner)})`;
    case 'has_move_type': return `${typeKo(r.type)} 기술 보유`;
    case 'held_item': return `${itemKo(r.itemCondition)} 소지`;
    case 'has_move': return `${moveKo(r.move)} 보유`;
    case 'use_move': return `${moveKo(r.move)} ${r.amount}회 사용`;
    case 'battle_critical_hits': return `한 배틀 급소 ${r.amount}회`;
    case 'stat_compare': return `${STAT_KO[r.highStat]} > ${STAT_KO[r.lowStat]}`;
    case 'stat_equal': return `${STAT_KO[r.statOne]} = ${STAT_KO[r.statTwo]}`;
    case 'moon_phase': return `${MOON[r.moonPhase] ?? r.moonPhase}`;
    case 'properties': return r.target === 'gender=male' ? '수컷' : r.target === 'gender=female' ? '암컷' : r.target;
    case 'party_member': return `파티에 ${monKo(r.target)} ${r.contains === false ? '없음' : '있음'}`;
    case 'recoil': return `반동 피해 누적 ${r.amount}`;
    case 'defeat': return `${monKo(r.target)} ${r.amount}마리 처치`;
    case 'damage_taken': return `피해 누적 ${r.amount}`;
    case 'weather': return r.isRaining ? '비 올 때' : r.isThundering ? '천둥 칠 때' : '맑을 때';
    case 'structure': return r.structureCondition ? `구조물: ${r.structureCondition.split(':').pop()}` : `구조물 밖: ${r.structureAnticondition.split(':').pop()}`;
    case 'advancement': return `도전과제: ${r.requiredAdvancement.split(':').pop()}`;
    case 'blocks_traveled': return `${r.amount}블록 이동`;
    case 'property_range': return `${r.feature} ${r.range}`;
    default: return JSON.stringify(r);
  }
}

function evoText(e) {
  const parts = [];
  if (e.variant === 'item_interact') parts.push(`${itemKo(e.requiredContext ?? '')} 사용`);
  else if (e.variant === 'trade') parts.push(`교환 또는 ${itemKo('link_cable')} 사용` + (e.requiredContext ? `(${monKo(e.requiredContext)}와)` : ''));
  else parts.push('레벨업');
  for (const r of e.requirements || []) parts.push(reqText(r));
  return parts.join(' · ');
}

function splitMoves(list) {
  const lv = [], tm = [], egg = [], tutor = [], other = [];
  for (const m of list || []) {
    const [a, b] = m.split(':');
    if (/^\d+$/.test(a)) lv.push([+a, b]);
    else if (a === 'tm') tm.push(b);
    else if (a === 'egg') egg.push(b);
    else if (a === 'tutor') tutor.push(b);
    else other.push(b);
  }
  lv.sort((x, y) => x[0] - y[0]);
  const uniq = arr => [...new Set(arr)];
  return { lv, tm: uniq(tm), egg: uniq(egg), tutor: uniq(tutor), other: uniq(other) };
}

const stats6 = s => [s.hp, s.attack, s.defence, s.special_attack, s.special_defence, s.speed];
const abilities = {}; // id -> [ko, desc]
const abil = list => {
  const out = [];
  for (const a of list || []) {
    const id = a.replace(/^h:/, '');
    abilities[id] ??= [L('cobblemon.ability.' + id, id), L(`cobblemon.ability.${id}.desc`, '')];
    if (!out.some(x => x.id === id)) out.push({ id, h: a.startsWith('h:') });
  }
  return out;
};
const NATURES = ['hardy','lonely','brave','adamant','naughty','bold','docile','relaxed','impish','lax','timid','hasty','serious','jolly','naive','modest','mild','quiet','bashful','rash','calm','gentle','sassy','careful','quirky'];
const natures = Object.fromEntries(NATURES.map(n => [n, L('cobblemon.nature.' + n, n)]));

const mons = {};
for (const [sid, sp] of Object.entries(species)) {
  const base = {
    n: sp.nationalPokedexNumber, en: sp.name, ko: L(`cobblemon.species.${sid}.name`, sp.name),
    form: null, bo: false, imp: !!sp.implemented,
    lab: (sp.labels || []).find(l => ['legendary', 'mythical', 'ultra_beast', 'paradox'].includes(l)) || null,
    types: [sp.primaryType, sp.secondaryType].filter(Boolean),
    stats: stats6(sp.baseStats), abil: abil(sp.abilities), catch: sp.catchRate,
    pre: sp.preEvolution ? resolveResult(sp.preEvolution) : null,
    evos: (sp.evolutions || []).map(e => ({ to: resolveResult(e.result), how: evoText(e) })).filter(e => e.to),
    ...splitMoves(sp.moves),
  };
  mons[sid] = base;
  for (const fm of sp.forms || []) {
    if (!realForm(sp, fm)) continue;
    const key = formKey(sid, fm);
    mons[key] = {
      ...base,
      form: L(`cobblemon.ui.pokedex.info.form.${key}`, fm.name), bo: !!fm.battleOnly,
      types: fm.primaryType ? [fm.primaryType, fm.secondaryType].filter(Boolean) : base.types,
      stats: fm.baseStats ? stats6(fm.baseStats) : base.stats, abil: fm.abilities ? abil(fm.abilities) : base.abil,
      evos: fm.evolutions ? fm.evolutions.map(e => ({ to: resolveResult(e.result), how: evoText(e) })).filter(e => e.to) : base.evos,
      ...(fm.moves ? splitMoves(fm.moves) : { lv: base.lv, tm: base.tm, egg: base.egg, tutor: base.tutor, other: base.other }),
    };
  }
}

// ---------- 폼 그림 번호 ----------
// PokeAPI 는 폼(메가·리전폼 등)마다 번호(10001~)가 따로 있음. raw/pokeapi/pokemon.csv (extract-cv.sh 가 받아 둠) 의 이름(charizard-mega-x)을
// 같은 종 안에서 폼 키(charizard-megax)와 맞춰 mons[key].i 에 넣음. 못 맞춘 폼(코블벌스 전용 폼, 타입 폼 등)은 i 가 없어 기본 모습 그림을 씀
const IMG_ALIAS = { // 이름이 달라 자동으로 못 맞추는 폼 -> PokeAPI 이름
  'meowstic-f': 'meowstic-female', 'meowstic-mega': 'meowstic-male-mega', 'greninja-bond': 'greninja-battle-bond',
  'zygarde-10c': 'zygarde-10-power-construct', 'zygarde-50c': 'zygarde-50-power-construct', 'magearna-megao': 'magearna-original-mega',
  'tatsugiri-mega': 'tatsugiri-curly-mega', 'tatsugiri-megas': 'tatsugiri-stretchy-mega', 'tatsugiri-megad': 'tatsugiri-droopy-mega',
};
{
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, ''), bySp = {}, taken = new Set();
  for (const l of fs.readFileSync(path.join(RAW, 'pokeapi/pokemon.csv'), 'utf8').trim().split(/\r?\n/).slice(1)) {
    const [id, ident, sp, , , , , def] = l.split(',');
    if (def === '0') (bySp[sp] ??= []).push([norm(ident), +id]);
  }
  const forms = Object.keys(mons).filter(k => mons[k].form !== null), cand = k => bySp[mons[k].n] || [];
  const take = (k, hit) => { if (hit) { mons[k].i = hit[1]; taken.add(hit[1]); } };
  for (const k of forms) take(k, cand(k).find(r => r[0] === norm(IMG_ALIAS[k] ?? k))); // 이름이 똑같은 것 먼저
  for (const k of forms) { // 남은 것: 한쪽 이름이 다른 쪽의 앞부분이고 후보가 하나뿐일 때만 (tauros-paldeaaqua ~ tauros-paldea-aqua-breed)
    if (mons[k].i) continue;
    const c = cand(k).filter(r => !taken.has(r[1]) && (r[0].startsWith(norm(k)) || norm(k).startsWith(r[0])));
    if (c.length === 1) take(k, c[0]);
  }
}

// ---------- moves ----------
const used = new Set();
for (const m of Object.values(mons)) {
  m.lv.forEach(([, id]) => used.add(id));
  [...m.tm, ...m.egg, ...m.tutor, ...m.other].forEach(id => used.add(id));
}
const CAT = { Physical: 'P', Special: 'S', Status: 'T' };
const moves = {};
for (const id of used) {
  const m = sd[id];
  if (!m) continue;
  let f = '';
  if (m.flags?.charge || m.flags?.failinstruct) f += 'c';
  if (m.flags?.recharge) f += 'r';
  if (m.selfdestruct) f += 's';
  if (m.multihit) f += 'm';
  if (m.isNonstandard) f += 'n';
  if (m.heal || m.flags?.heal) f += 'h';
  if (m.boosts && m.target === 'self' && Object.values(m.boosts).some(v => v > 0)) f += 'b';
  if (m.priority > 0) f += 'p';
  if (m.recoil || m.mindBlownRecoil) f += 'k';
  const boosts = m.boosts && m.target === 'self' ? Object.keys(m.boosts).filter(k => m.boosts[k] > 0).join(',') : '';
  moves[id] = [moveKo(id), m.name, m.type.toLowerCase(), CAT[m.category], m.basePower, m.accuracy === true ? 0 : m.accuracy, m.pp, f, boosts, L(`cobblemon.move.${id}.desc`, ''), null];
}

// ---------- recipes ----------
const RTYPE = { 'minecraft:crafting_shaped': '조합대', 'minecraft:crafting_shapeless': '조합대', 'minecraft:smelting': '화로', 'minecraft:blasting': '용광로', 'minecraft:smoking': '훈연기', 'minecraft:campfire_cooking': '모닥불', 'minecraft:stonecutting': '석재 절단기', 'minecraft:smithing_transform': '대장장이 작업대', 'cobblemon:brewing_stand': '양조기', 'cobblemon:cooking_pot': '모닥불 냄비', 'cobblemon:cooking_pot_shapeless': '모닥불 냄비', 'lumymon:stark_forging': '강철산 용광로',
  // 배낭 모드: 모양은 일반 조합대 레시피와 같고, 이전 배낭의 내용물을 유지하는 것만 다름
  'sophisticatedbackpacks:basic_backpack': '조합대', 'sophisticatedbackpacks:backpack_upgrade': '조합대', 'sophisticatedcore:upgrade_next_tier': '조합대', 'sophisticatedbackpacks:smithing_backpack_upgrade': '대장장이 작업대' };
// 작업대 이름 -> 그 작업대 아이템 (레시피 머리글 그림용)
const STATION = { 조합대: 'minecraft:crafting_table', 화로: 'minecraft:furnace', 용광로: 'minecraft:blast_furnace', 훈연기: 'minecraft:smoker', 모닥불: 'minecraft:campfire', '석재 절단기': 'minecraft:stonecutter', '대장장이 작업대': 'minecraft:smithing_table', 양조기: 'minecraft:brewing_stand', '모닥불 냄비': 'cobblemon:campfire_pot_red', '강철산 용광로': 'lumymon:stark_forge' };
// 아이템 키: 코블몬 건 접두어 없이, 애드온 건 "ns:id"
const ikey = id => id.replace(/^cobblemon:/, '');
const ITEM_NS = ['cobblemon', 'mega_showdown', 'zamega', 'legendarymonuments'];
// 아이템 탭에 전부 넣는 모드: 설명·제작법이 없는 아이템·블록도 포함 (아래 "그 밖의 모드 아이템" 패스). 가구·콘크리트 같은 장식 모드는 raw/ 에 안 뽑아서 대상이 아님
const ALL_NS = [...ITEM_NS, 'lumymon', 'tmcraft', 'obc', 'cobblenav', 'rctmod', 'waystones', 'comforts', 'sophisticatedbackpacks', 'toms_storage'];
// ---------- 아이템 그림: 아이템 모델 -> 텍스처 png 를 img/<ns>/<id>.png 로 복사 (필요한 것만) ----------
const IMG = path.join(__dirname, 'img');
fs.rmSync(IMG, { recursive: true, force: true });
const assetFile = (ns, rel) => { for (let i = LAYERS.length - 1; i >= 0; i--) { const f = path.join(LAYERS[i], 'assets', ns, rel); if (fs.existsSync(f)) return f; } return null; };
// 모델의 텍스처: 아이템은 layer0, 블록은 all/side/top 등. 없으면 parent 모델을 따라감
function texOf(ref, depth = 0) {
  const [ns, p] = ref.includes(':') ? ref.split(':') : ['minecraft', ref], mf = assetFile(ns, `models/${p}.json`);
  if (!mf || depth > 6) return null;
  let j; try { j = readJ(mf); } catch { return null; }
  const t = j.textures || {}, res = v => { while (v && v.startsWith('#')) v = t[v.slice(1)]; return v; };
  for (const k of ['layer0', 'all', 'front', 'side', 'top', 'texture', 'cross', 'plant', 'particle', ...Object.keys(t)]) { const v = res(t[k]); if (v) return v; }
  return j.parent && !/generated|handheld|builtin/.test(j.parent) ? texOf(j.parent, depth + 1) : null;
}
// 블록 그림이 알아보기 어려운 것만 면을 직접 지정 (조합대는 격자가 보이는 윗면)
const ICON_TEX = { 'minecraft:crafting_table': 'minecraft:block/crafting_table_top' }; // 배낭은 3D 모델뿐이라 그림 없음
const iconCache = {}, ICONS = new Set(); // ICONS: 그림 있는 아이템 키
function icon(id) { // 'ns:name' (접두어 없으면 cobblemon) -> 'ns/name' (img/ 아래 경로) | null
  const full = id.includes(':') ? id : 'cobblemon:' + id;
  if (full in iconCache) return iconCache[full];
  const [ns, n] = full.split(':'), tx = ICON_TEX[full] ?? texOf(`${ns}:item/${n}`);
  const src = tx && assetFile(...(tx.includes(':') ? tx.split(':') : ['minecraft', tx]).map((x, i) => i ? `textures/${x}.png` : x));
  if (!src) return (iconCache[full] = null);
  const key = ns + '/' + n, dst = path.join(IMG, key + '.png');
  fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst);
  ICONS.add(ikey(full));
  return (iconCache[full] = key);
}
const tagItems = (tag, seen = new Set()) => {
  if (seen.has(tag)) return [];
  seen.add(tag);
  const [ns, p] = tag.split(':');
  if (ns === 'c') return [cTagItem(tag)];
  return tagValues(ns, 'item', p).flatMap(v => { const id = typeof v === 'string' ? v : v.id; return id.startsWith('#') ? tagItems(id.slice(1), seen) : [id]; });
};
// c: 태그(패브릭 공용)는 파일이 없어서 이름으로 바닐라 아이템을 추정: c:ingots/iron -> iron_ingot, c:strings -> string
const C_ONE = { glass_blocks: 'glass', concretes: 'white_concrete', fertilizers: 'bone_meal', seeds: 'wheat_seeds', chains: 'chain' };
const C_KIND = { glass_blocks: () => 'glass', ingots: m => m + '_ingot', nuggets: m => m + '_nugget', storage_blocks: m => m + '_block', raw_materials: m => 'raw_' + m, dyes: m => m + '_dye', rods: () => 'stick', chests: () => 'chest', barrels: () => 'barrel', drinks: m => m + '_bucket', foods: m => m === 'milk' ? 'milk_bucket' : m, buckets: m => m === 'empty' ? 'bucket' : m + '_bucket', gems: m => ({ amethyst: 'amethyst_shard', lapis: 'lapis_lazuli' })[m] ?? m };
const cTagItem = t => { const [k, m] = t.slice(2).split('/'); return 'minecraft:' + (m ? (C_KIND[k] ?? (x => x))(m) : C_ONE[k] ?? k.replace(/s$/, '')); };
// 재료 -> 대표 아이템 id (태그면 그림 있는 첫 아이템)
const ingId = ing => {
  if (!ing) return null;
  const ids = (Array.isArray(ing) ? ing.map(ingId) : ing.item ? [ing.item] : ing.tag ? tagItems(ing.tag) : []).filter(Boolean);
  return ids.find(x => icon(x)) ?? ids[0] ?? null;
};
const ingKey = ing => { const id = ingId(ing); return id ? ikey(id) : null; };

const recipes = {}; // item key -> [{w: 작업대, g: 3x3 이름 | null, gk: 칸별 아이템 키, i: 재료 목록, ik: 재료별 아이템 키, n: 개수, o: 결과물 키}]
function recipeOf(r) {
  const w = RTYPE[r.type];
  if (!w || !r.result) return null;
  let g = null, gk, i = [], ik = [];
  if (r.pattern) {
    const rows = r.pattern.map(row => [...row.padEnd(3)]);
    g = rows.map(row => row.map(ch => ch === ' ' ? '' : ingKo(r.key[ch])));
    gk = rows.map(row => row.map(ch => ch === ' ' ? null : ingKey(r.key[ch])));
    // 같은 재료를 다른 글자로 적은 레시피도 있어서 이름으로 셈
    const cnt = {}, ch1 = {}; r.pattern.join('').split('').filter(c => c !== ' ').forEach(c => { const k = ingKo(r.key[c]); cnt[k] = (cnt[k] || 0) + 1; ch1[k] ??= c; });
    i = Object.entries(cnt).map(([k, n]) => `${k} ×${n}`);
    ik = Object.keys(cnt).map(k => ingKey(r.key[ch1[k]]));
  } else if (r.ingredients) {
    const cnt = {}, first = {}; r.ingredients.forEach(x => { const k = ingKo(x); cnt[k] = (cnt[k] || 0) + 1; first[k] ??= x; });
    i = Object.entries(cnt).map(([k, n]) => `${k} ×${n}`);
    ik = Object.keys(cnt).map(k => ingKey(first[k]));
  } else if (r.type === 'cobblemon:brewing_stand') { i = [`${ingKo(r.bottle)} (병)`, `${ingKo(r.input)} (재료)`]; ik = [ingKey(r.bottle), ingKey(r.input)]; }
  else if (r.template) { i = [ingKo(r.template), ingKo(r.base), ingKo(r.addition)]; ik = [r.template, r.base, r.addition].map(ingKey); }
  else if (r.ingredient) { i = [ingKo(r.ingredient)]; ik = [ingKey(r.ingredient)]; }
  const out = r.result.id || r.result.item;
  icon(out);
  return { w, g, gk, i, ik, n: r.result.count || 1, o: ikey(out) };
}
Object.values(STATION).forEach(icon);
// 모든 레시피를 결과물별로 모아둠 (바닐라·TMCraft 포함)
const allR = new Map();
for (const { f } of dataFiles('recipe', null, true)) {
  const r = readJ(f), out = r.result?.id || r.result?.item;
  if (out && RTYPE[r.type]) { const k = ikey(out); if (!allR.has(k)) allR.set(k, []); allR.get(k).push(r); }
}

// ---------- 가이드 "가방·도구": [묶음, 설명, [[아이템 키, 한 줄 설명(비면 게임 툴팁)]]]. 칸 수·비용은 인스턴스 config 기본값 ----------
const TOOLS = [
  ['가방', '등에 메거나(기본 B키로 열기) 바닥에 놓고 우클릭. 다음 단계 배낭은 지금 배낭을 가운데 넣고 만들어서 안의 물건이 그대로 남음.', [
    ['sophisticatedbackpacks:backpack', '27칸 · 기능 칸 1개'], ['sophisticatedbackpacks:copper_backpack', '45칸 · 기능 칸 1개'],
    ['sophisticatedbackpacks:iron_backpack', '81칸 · 기능 칸 7개'], ['sophisticatedbackpacks:gold_backpack', '96칸 · 기능 칸 8개'],
    ['sophisticatedbackpacks:diamond_backpack', '108칸 · 기능 칸 9개'], ['sophisticatedbackpacks:netherite_backpack', '120칸 · 기능 칸 10개 (대장장이 작업대)']]],
  ['가방 기능', '배낭을 열면 왼쪽에 기능 칸이 있음. 끼우면 바로 작동. 전부 기능 틀이 재료.', [
    ['sophisticatedbackpacks:upgrade_base', '모든 기능의 재료'], ['sophisticatedbackpacks:pickup_upgrade', '바닥 아이템을 주우면 배낭으로 바로 들어감'],
    ['sophisticatedbackpacks:magnet_upgrade', '주변 아이템을 끌어당김'], ['sophisticatedbackpacks:crafting_upgrade', '배낭 안에서 3×3 조합'],
    ['sophisticatedbackpacks:stack_upgrade_starter_tier', '한 칸에 1.5배 쌓임 (1단계는 2배)'], ['sophisticatedbackpacks:tool_swapper_upgrade', '캐는 블록에 맞는 도구로 자동 교체'],
    ['sophisticatedbackpacks:void_upgrade', '고른 아이템을 자동으로 없앰 (잡템 정리)']]],
  ['이동 (전송석)', '마을 등에 생성된 전송석을 우클릭하면 등록됨. 등록한 전송석끼리 순간이동. 비용은 경험치 레벨: 100블록마다 1레벨(최대 27), 다른 차원은 27레벨, 전역 전송석은 무료. 대기 시간 없음.', [
    ['waystones:warp_stone', '들고 우클릭을 꾹 누르면 등록한 전송석 목록이 뜸. 계속 다시 씀'],
    ['waystones:warp_scroll', '1회용. 등록한 전송석 하나로 이동'], ['waystones:waystone', '직접 설치하는 전송석. 남이 설치한 건 주인만 수정 가능']]],
  ['포켓몬 찾기 (코블나브)', '', [
    ['cobblenav:pokenav_item_base', '지금 있는 곳에서 나올 수 있는 포켓몬과 확률을 보여주고, 골라서 추적'],
    ['cobblenav:pokefinder_item_red', '포켓내비에서 고른 종을 추적 (색만 다른 버전 여러 개)'], ['cobblenav:fishingnav_item', '낚시 중에 Shift+우클릭하면 그 물에서 낚이는 포켓몬 목록']]],
  ['창고 (톰스 스토리지)', '상자들을 인벤토리 커넥터에 붙이거나 케이블로 잇고 터미널을 연결하면, 상자 전체를 한 화면에서 검색해서 꺼냄.', [
    ['toms_storage:inventory_connector', '붙어 있는 상자들을 하나로 묶음'], ['toms_storage:inventory_cable', '떨어진 상자까지 연결'],
    ['toms_storage:storage_terminal', '묶인 상자 전체 검색·꺼내기'], ['toms_storage:crafting_terminal', '저장 터미널 + 조합대'],
    ['toms_storage:wireless_terminal', '떨어진 곳에서 터미널 열기 (범위 제한)']]],
  ['잠자리 (컴포츠)', '둘 다 낮·밤 언제든 사용 가능. 색 16가지.', [
    ['comforts:sleeping_bag_white', '휴대용 침대. 침대와 달리 리스폰 지점이 안 바뀜'], ['comforts:hammock_white', '밧줄과 못 2개 사이에 거는 해먹'],
    ['comforts:rope_and_nail', '해먹 설치용']]],
  ['트레이너 (RCT)', '체육관·사천왕 진행 모드. 트레이너 카드를 가지고 있어야 야생 트레이너가 나타나고, 16블록 안에서 눈에 띄면 대결이 걸림. 레벨 상한은 20에서 시작해 트레이너를 이길수록 오르고, 상한 위로는 레벨업 안 됨.', [
    ['rctmod:trainer_card', '진행 상황·레벨 상한·남은 트레이너 확인. 이게 있어야 트레이너가 나옴'],
    ['rctmod:trainer_repel_rod', '주변에 트레이너가 안 나오게 하는 블록 (집·농장용)']]],
  ['타고난 능력치 올리기 (병뚜껑)', '포켓몬은 같은 종류라도 타고난 능력치(개체값, 0~31)가 다 다름. 병뚜껑을 쓰면 그 수치를 최대로 올림. 능력치별 병뚜껑은 트레이너 대결 보상으로 나오고, 코블벌스 레시피로 만들 수도 있음.', [
    ['obc:bottle_cap_hp', '타고난 HP를 최대로. 공격·방어·특공·특방·스피드도 같은 방식'], ['obc:bottle_cap_gold', '타고난 능력치 6개를 전부 최대로'],
    ['obc:bottle_cap_speed_withered', '타고난 스피드를 0으로. 느린 쪽이 먼저 공격하는 트릭룸 전술용']]],
];

// ---------- 관장 위치 (코블벌스): 지도 안내인 거래표 = [탐색 아이템, 체육관 구조물 태그]. 탐색 아이템·지도 제작대도 레시피 수집 대상 ----------
const GYM_TRADES = dataFiles('trades', 'lumymon').flatMap(({ f }) => readJ(f).tiers.flatMap(t => t.groups.flatMap(g => g.trades)))
  .map(t => [t.cost_a.name, t.result.functions?.find(x => x.destination)?.destination]).filter(([, tag]) => tag);
const GYM_TABLES = ['kanto', 'nether', 'end'].map(r => `lumymon:${r}_cartography_table`);
const GYM_ITEMS = [...GYM_TRADES.map(t => t[0]), ...GYM_TABLES];
// ---------- 전설 포켓몬: legends.js(손으로 쓴 내용)에 나오는 아이템도 레시피 수집 대상 ----------
const LG = require('./legends.js');
const LG_COMMON = ['poke_radar', 'locator_chip', 'battle_seeker', 'nether_cartography_table', 'end_cartography_table', 'distortion_cartography_table'].map(x => 'lumymon:' + x);
const LG_ITEMS = [...new Set([...[...JSON.stringify(LG).matchAll(/\{([a-z_]+:[a-z0-9_]+)\}/g)].map(m => m[1]),
  ...LG.list.flatMap(e => [e.radar, ...e.need.map(n => n[0]), ...(e.gim || []).map(g => g[0]), ...(e.via || []).map(v => v[2])]), ...LG.plates.map(p => 'mega_showdown:' + p[0]), ...LG_COMMON].filter(Boolean))];

// ---------- TM (TMCraft: 조합대에서 빈 디스크 + 재료로 tm_<기술> 제작. 코블벌스 데이터팩이 레시피를 덮어씀) ----------
for (const { rel, f } of dataFiles('recipe', 'tmcraft')) {
  const id = rel.match(/^tm_([a-z0-9]+).json$/)?.[1];
  if (id && moves[id]) moves[id][10] = recipeOf(readJ(f));
}
// 코블몬·애드온 아이템 레시피 + 거기 재료로 쓰인 아이템(바닐라·빈 디스크 등)의 레시피까지 따라가며 수집
{
  const nsOf = k => k.includes(':') ? k.split(':')[0] : 'cobblemon';
  const queue = [...allR.keys()].filter(k => ALL_NS.includes(nsOf(k)));
  Object.values(moves).forEach(m => m[10]?.ik.forEach(k => k && queue.push(k)));
  TOOLS.forEach(([, , rows]) => rows.forEach(([id]) => queue.push(id)));
  queue.push(...GYM_ITEMS, ...LG_ITEMS);
  const done = new Set();
  while (queue.length) {
    const k = queue.pop();
    if (done.has(k)) continue;
    done.add(k);
    for (const r of allR.get(k) || []) { const x = recipeOf(r); if (x) { (recipes[k] ??= []).push(x); x.ik.forEach(q => q && !done.has(q) && queue.push(q)); } }
  }
}

// ---------- items (분류는 코블몬·메가 쇼다운 아이템 태그 기준) ----------
const itemTag = tag => tagItems(tag.includes(':') ? tag : 'cobblemon:' + tag).map(ikey);
const ICAT = [
  ['메가스톤', ['mega_showdown:mega_stone']], ['Z크리스탈', ['mega_showdown:z_crystal']], ['테라', ['mega_showdown:tera_shard', 'mega_showdown:tera_orb']],
  ['배틀 기믹 장비', ['mega_showdown:mega_bracelet', 'mega_showdown:z_ring', 'mega_showdown:dynamax_band', 'mega_showdown:omni_ring']], ['로토무 가전', ['mega_showdown:rotom_appliances']],
  ['몬스터볼', ['poke_balls']], ['진화 아이템', ['evolution_items', 'evolution_stones']],
  ['회복약', ['potions', 'revives', 'remedies', 'restores', 'full_heal_bottles', 'ethers']],
  ['성장·능력치', ['experience_candies', 'vitamins', 'feathers', 'iv_candies', 'mochis', 'ability_changers', 'candies']],
  ['민트', ['mints', 'mint_leaves']], ['지닌 물건', ['held/is_held_item']], ['열매', ['berries']],
  ['화석', ['fossils']], ['타입 젬', ['type_gems']], ['요리·간식', ['poke_food', 'regional_delicacies', 'aprijuices', 'sweets']],
  ['낚싯대', ['poke_rods']], ['배틀 아이템', ['battle_items']],
];
const catOf = {};
for (const [cat, tags] of ICAT) for (const t of tags) for (const id of itemTag(t)) catOf[id] ??= cat;
const items = {};
for (const key of Object.keys(lang)) {
  const m = key.match(/^(item|block)\.(cobblemon|mega_showdown|zamega|legendarymonuments)\.([a-z0-9_]+)$/);
  if (!m || (m[2] === 'legendarymonuments' && m[1] === 'block')) continue;
  // 메가 쇼다운·Z-A 메가는 설명을 tooltip.<ns>.<id>.tooltip 키에 둠. §7 같은 색 코드는 제거
  const id = ikey(m[2] + ':' + m[3]), tip = [...['tooltip', 'tooltip1', 'tooltip_1', 'tooltip2', 'tooltip_2', 'desc', 'description'].map(s => lang[`${key}.${s}`]), lang[`tooltip.${m[2]}.${m[3]}.tooltip`]]
    .filter(Boolean).join(' ').replace(/§./g, '');
  if (!tip && !recipes[id] && !catOf[id]) continue;
  if (items[id] && !tip) continue;
  items[id] = [lang[key], catOf[id] || (/메가스톤의 일종/.test(tip) ? '메가스톤' : m[2] === 'legendarymonuments' ? '전설 모뉴먼트' : m[1] === 'block' ? '블록·장치' : '기타'), tip];
  icon(id);
}
// 가이드 도구: 다른 모드 아이템이라 위 목록에 안 잡힘
for (const [, , rows] of TOOLS) for (const [id] of rows) {
  const [ns, n] = id.split(':'), lk = lang[`item.${ns}.${n}`] ? `item.${ns}.${n}` : `block.${ns}.${n}`;
  const nm = itemKo(id); // 색 버전(pokefinder_item_red)은 이름이 색 없는 키에 있음
  items[id] ??= [nm === n ? itemKo(id.replace(/_[a-z]+$/, '')) : nm, '가방·도구', (lang[lk + '.tooltip'] ?? '').replace(/§./g, '')];
  icon(id);
}

// 관장 탐색 아이템·지도 제작대 (lumymon도 위 목록에 안 잡힘)
for (const id of GYM_ITEMS) { items[id] ??= [itemKo(id), '관장 찾기', (lang[`tooltip.lumymon.${id.split(':')[1]}`] ?? '').replace(/§./g, '')]; icon(id); }
// 전설 탭 아이템 (소환 아이템·레이더 등). 이름이 없으면 legends.js 오타라서 멈춤
for (const id of LG_ITEMS) {
  const [ns, n] = id.split(':');
  if (!lang[`item.${ns}.${n}`] && !lang[`block.${ns}.${n}`]) throw new Error('legends.js: 없는 아이템 ' + id);
  items[ikey(id)] ??= [itemKo(id), '전설 포켓몬', (lang[`tooltip.${ns}.${n}`] ?? '').replace(/§./g, '')]; icon(id);
}

// 그 밖의 모드 아이템·블록 전부 (설명·제작법이 없어도): 아이템 탭에서 검색해 얻는 곳을 볼 수 있게.
// 아이템 모델이 있는 것만 넣음 (화분에 심은 것·작물 단계 같은 블록 상태, 언어 파일에만 있는 이름은 빠짐)
for (const key of Object.keys(lang)) {
  const m = key.match(/^(item|block)\.([a-z0-9_]+)\.([a-z0-9_]+)$/);
  if (!m || !ALL_NS.includes(m[2])) continue;
  const id = ikey(m[2] + ':' + m[3]);
  if (items[id] || typeof lang[key] !== 'string' || !assetFile(m[2], `models/item/${m[3]}.json`)) continue;
  const tip = [...['tooltip', 'tooltip1', 'tooltip_1', 'tooltip2', 'tooltip_2', 'desc', 'description'].map(x => lang[`${key}.${x}`]), lang[`tooltip.${m[2]}.${m[3]}.tooltip`], lang[`tooltip.${m[2]}.${m[3]}`]]
    .filter(x => typeof x === 'string').join(' ').replace(/§./g, '');
  items[id] = [lang[key], catOf[id] || (m[2] === 'legendarymonuments' ? '전설 모뉴먼트' : m[1] === 'block' ? '블록·장치' : '기타'), tip];
  icon(id);
}

// ---------- fossils / berries ----------
for (const { f } of dataFiles('fossils', 'cobblemon')) {
  const j = readJ(f), k = resolveResult(j.result);
  if (mons[k]) mons[k].fossil = j.fossils.map(itemKo);
}

// ---------- 기믹 (메가 쇼다운·Z-A 메가): 폼마다 [종류, 방법, 필요 아이템 키[]] ----------
// 받침 있으면 "을", 없거나 영문으로 끝나면 "를"
const eul = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return w + (c >= 0 && c < 11172 && c % 28 ? "을" : "를"); };
const addGm = (k, g) => { if (mons[k]) (mons[k].gm ??= []).push(g); };
const MS = id => 'mega_showdown:' + id;
// 메가스톤: data/<ns>/mega_showdown/mega/<아이템>.json 에 대상 포켓몬과 폼 aspect가 있음
for (const { ns, rel, f } of dataFiles('mega_showdown/mega')) {
  const j = readJ(f), stone = ikey(ns + ':' + path.basename(rel, '.json'));
  const asp = (j.aspect_conditions?.apply?.aspects || [])[0]?.split('=').pop();
  for (const name of j.pokemons || []) {
    const sid = idOf(name), fm = (species[sid]?.forms || []).find(x => (x.aspects || []).includes(asp));
    if (fm) addGm(formKey(sid, fm), ['메가진화', `메가링을 차고 ${monKo(sid)}에게 ${eul(itemKo(stone))} 지니게 한 뒤 배틀에서 메가진화`, [MS('mega_bracelet'), stone]]);
  }
}
// 나머지는 데이터에 연결 정보가 없고 아이템 설명에만 있어서 직접 연결
const FORM_GM = {
  'rayquaza-mega': ['메가진화', '화룡점정을 배운 상태로 메가링을 차고 배틀 (메가스톤 필요 없음)', [MS('mega_bracelet')]],
  'groudon-primal': ['원시회귀', '지니게 하고 배틀에 내보내면 자동으로 원시회귀', [MS('red_orb')]],
  'kyogre-primal': ['원시회귀', '지니게 하고 배틀에 내보내면 자동으로 원시회귀', [MS('blue_orb')]],
  'rotom-heat': ['폼 체인지', '오븐을 로토무에게 사용하거나 로토무 카탈로그로 변경', [MS('rotom_oven'), MS('rotom_catalogue')]],
  'rotom-wash': ['폼 체인지', '세탁기를 로토무에게 사용하거나 로토무 카탈로그로 변경', [MS('rotom_washing_machine'), MS('rotom_catalogue')]],
  'rotom-frost': ['폼 체인지', '냉장고를 로토무에게 사용하거나 로토무 카탈로그로 변경', [MS('rotom_fridge'), MS('rotom_catalogue')]],
  'rotom-fan': ['폼 체인지', '선풍기를 로토무에게 사용하거나 로토무 카탈로그로 변경', [MS('rotom_fan'), MS('rotom_catalogue')]],
  'rotom-mow': ['폼 체인지', '잔디깎이를 로토무에게 사용하거나 로토무 카탈로그로 변경', [MS('rotom_mow'), MS('rotom_catalogue')]],
  'necrozma-duskmane': ['합체', 'N-솔라라이저로 네크로즈마와 솔가레오를 합체', [MS('n_solarizer')]],
  'necrozma-dawnwings': ['합체', 'N-루나라이저로 네크로즈마와 루나아라를 합체', [MS('n_lunarizer')]],
  'necrozma-ultra': ['울트라버스트', '합체한 네크로즈마에게 울트라네크로Z를 지니게 하고 Z-링을 찬 채 배틀', [MS('ultranecrozium_z'), MS('z_ring')]],
  'kyurem-white': ['합체', '유전자쐐기로 큐레무와 레시라무를 합체', [MS('dna_splicer')]],
  'kyurem-black': ['합체', '유전자쐐기로 큐레무와 제크로무를 합체', [MS('dna_splicer')]],
  'calyrex-ice': ['합체', '유대의고삐로 버드렉스와 블리자포스를 합체', [MS('reins_of_unity')]],
  'calyrex-shadow': ['합체', '유대의고삐로 버드렉스와 레이스포스를 합체', [MS('reins_of_unity')]],
  'zacian-crowned': ['폼 체인지', '녹슨검을 지니게 하면 배틀에서 변신', [MS('rusted_sword')]],
  'zamazenta-crowned': ['폼 체인지', '녹슨방패를 지니게 하면 배틀에서 변신', [MS('rusted_shield')]],
  'hoopa-unbound': ['폼 체인지', '굴레의항아리를 후파에게 사용', [MS('prison_bottle')]],
  'shaymin-sky': ['폼 체인지', '그라시데아꽃을 쉐이미에게 사용', [MS('gracidea_flower')]],
  'ogerpon-wellspring': ['가면', '우물의가면을 지니게 하기', [MS('wellspring_mask')]],
  'ogerpon-hearthflame': ['가면', '화덕의가면을 지니게 하기', [MS('hearthflame_mask')]],
  'ogerpon-cornerstone': ['가면', '주춧돌의가면을 지니게 하기', [MS('cornerstone_mask')]],
};
for (const [k, g] of Object.entries(FORM_GM)) addGm(k, g);
// 아르세우스 플레이트: 설명에 "아르세우스"와 "<타입>타입"이 같이 있는 아이템
for (const t of TYPES) {
  const plate = Object.keys(items).find(id => /아르세우스/.test(items[id][2]) && items[id][2].includes(typeKo(t) + '타입'));
  if (plate && mons['arceus-' + t]) addGm('arceus-' + t, ['플레이트', `${eul(items[plate][0])} 지니게 하면 ${typeKo(t)}타입으로 변신`, [plate]]);
}
// 전용 Z크리스탈: 설명이 "<포켓몬>에게 지니게 하면"으로 시작하는 Z (타입 Z는 "포켓몬에게"라 제외됨)
for (const id of Object.keys(items)) {
  if (items[id][1] !== 'Z크리스탈') continue;
  const who = items[id][2].split('에게')[0];
  for (const ko of who.split(', ')) {
    const k = Object.keys(mons).find(x => !mons[x].form && mons[x].ko === ko);
    if (k) addGm(k, ['Z기술', items[id][2], [id, MS('z_ring')]]);
  }
}

// ---------- biomes (코블몬 태그 -> 실제 바닐라 바이옴) ----------
const MC_BIOMES = fs.readFileSync(path.join(RAW, 'mc_biomes.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
const biomeKo = id => mcLang['biome.minecraft.' + id] ?? id;
const tagCache = {};
function tagMembers(tag) {
  if (tagCache[tag]) return tagCache[tag];
  tagCache[tag] = new Set(); // cycle guard
  const [ns, p] = tag.replace(/^#/, '').split(':');
  const set = new Set();
  for (const v of tagValues(ns, 'worldgen/biome', p)) {
    const id = typeof v === 'string' ? v : v.id;
    if (id.startsWith('#')) tagMembers(id).forEach(b => set.add(b));
    else if (id.startsWith('minecraft:')) set.add(id.slice(10));
  }
  return (tagCache[tag] = set);
}
const biomeSet = b => b.startsWith('#') ? tagMembers(b) : new Set(b.startsWith('minecraft:') ? [b.slice(10)] : []);
const BIOME_TAG_KO = { is_overworld: '오버월드 전체', is_ocean: '바다', is_deep_ocean: '깊은 바다', is_warm_ocean: '따뜻한 바다', is_lukewarm_ocean: '미지근한 바다', is_cold_ocean: '차가운 바다', is_frozen_ocean: '얼어붙은 바다', is_temperate_ocean: '온화한 바다', is_jungle: '정글', is_swamp: '늪', is_forest: '숲', is_freshwater: '강·호수', is_river: '강', is_coast: '해안', is_beach: '해변', is_stony_beach: '돌 해안', is_tropical_island: '열대 섬', is_island: '섬', is_mirage_island: '신기루 섬', is_hills: '언덕', is_highlands: '고지대', is_mountain: '산', is_peak: '산봉우리', is_plateau: '고원', is_taiga: '타이가', is_snowy_taiga: '눈 덮인 타이가', is_temperate: '온대', is_arid: '건조 지대', is_desert: '사막', is_sandy: '모래 지대', is_badlands: '악지', is_savanna: '사바나', is_lush: '무성한 지대', is_magical: '신비로운 지대', is_floral: '꽃 지대', is_cherry_blossom: '벚나무 숲', is_mushroom: '버섯 지대', is_grassland: '초원', is_plains: '평원', is_shrubland: '관목 지대', is_sky: '하늘(고도)', is_snowy_forest: '눈 덮인 숲', is_snowy: '눈 지대', is_snowy_plains: '눈 덮인 평원', is_tundra: '툰드라', is_freezing: '혹한 지대', is_glacial: '빙하', is_cold: '추운 지대', is_spooky: '으스스한 지대', is_end: '엔드', is_bamboo: '대나무 정글', is_volcanic: '화산 지대', is_thermal: '온천·열 지대', is_dripstone: '점적석 동굴', is_lush_caves: '무성한 동굴', is_cave: '동굴', is_deep_dark: '깊은 어둠', 'nether/is_forest': '네더 숲', 'nether/is_overgrowth': '네더 무성지', 'nether/is_wasteland': '네더 황무지', 'nether/is_basalt': '현무암 삼각주', 'nether/is_fungus': '네더 버섯 숲', 'nether/is_desert': '네더 사막', 'nether/is_frozen': '네더 빙결지', 'nether/is_crimson': '진홍빛 숲', 'nether/is_quartz': '네더 석영 지대', 'nether/is_soul_fire': '영혼 불 지대', 'nether/is_warped': '뒤틀린 숲', 'nether/is_soul_sand': '영혼 모래 골짜기', 'nether/is_toxic': '네더 독성 지대', 'nether/is_mountain': '네더 산', is_nether: '네더 전체' };
const tagLabel = b => {
  const p = b.replace(/^#?[a-z_]+:/, '');
  if (!b.startsWith('#')) return biomeKo(p);
  if (BIOME_TAG_KO[p]) return BIOME_TAG_KO[p];
  if (p.startsWith('has_block/')) return `${itemKo('minecraft:' + p.slice(10))} 있는 바이옴`;
  const mem = [...biomeSet(b)].slice(0, 3).map(biomeKo);
  return mem.length ? mem.join('·') + (biomeSet(b).size > 3 ? ' 등' : '') : p;
};

// ---------- spawns ----------
const POS = { grounded: '땅', submerged: '물속', surface: '수면', seafloor: '해저', fishing: '낚시' };
const PRESET = { treetop: '나무 위', foliage: '나뭇잎 근처', urban: '도시(콘크리트) 근처', derelict: '어두운 폐허', mansion: '삼림 대저택', mansion_bedrooms: '대저택 침실', mansion_dining: '대저택 식당', redstone: '레드스톤 근처', webs: '거미줄 지대', trail_ruins: '오솔길 폐허', lava: '용암', ruined_portal: '파괴된 차원문', jungle_pyramid: '정글 사원', desert_pyramid: '사막 사원', ancient_city: '고대 도시', nether_fossil: '네더 화석', stronghold: '요새', salt: '소금 지대' };
const STRUCT_KO = { village: '마을', 'spawns/is_graveyard': '묘지', ancient_city: '고대 도시', stronghold: '요새', mansion: '삼림 대저택', ocean_ruin: '바다 폐허', shipwreck: '난파선', trail_ruins: '오솔길 폐허', desert_pyramid: '사막 사원', jungle_pyramid: '정글 사원', pillager_outpost: '약탈자 전초기지', igloo: '이글루', mineshaft: '폐광', ruined_portal: '파괴된 차원문', bastion_remnant: '보루 잔해', fortress: '네더 요새', end_city: '엔드 시티', trial_chambers: '시련의 회당', swamp_hut: '마녀의 오두막', ocean_monument: '바다 유적', graveyard: '묘지', civilization: '마을·인공 구조물', illager_structure: '일리저 구조물', illager_outpost: '약탈자 전초기지', witch_structure: '마녀 구조물', ocean_ruins: '바다 폐허', jungle_monument: '정글 사원', desert_monument: '사막 사원', ruins: '폐허', 'ruins/arch': '아치 폐허', 'ruins/luna_henge_ruins': '루나 헨지 폐허', 'ruins/sol_henge_ruins': '솔 헨지 폐허', 'ruins/stonjourner_henge_ruins': '돌헨진 헨지 폐허', shipwreck_cove: '난파선 만', 'shipwreck_coves/lush_shipwreck_cove': '무성한 난파선 만', 'shipwreck_coves/submerged_shipwreck_cove': '물에 잠긴 난파선 만', end_structure: '엔드 구조물', nether_structure: '네더 구조물', dungeon: '던전', desert_well: '사막 우물' };
const structKo = s => { const p = s.replace(/^#?[a-z_]+:/, ''); return STRUCT_KO[p] ?? STRUCT_KO[p.replace(/^spawns\/is_|^is_/, '')] ?? p.replace(/^spawns\/is_/, '').replace(/_/g, ' '); };
const BLOCK_TAG_KO = { 'cobblemon:apricorns': '규토리 나무', 'cobblemon:saccharine_trees': '사카린 나무', 'minecraft:corals': '산호', 'minecraft:coral_blocks': '산호 블록', 'cobblemon:dead_coral': '죽은 산호', 'cobblemon:gemstones': '보석 블록', 'minecraft:iron_ores': '철 광석', 'minecraft:coal_ores': '석탄 광석', 'minecraft:redstone_ores': '레드스톤 광석', 'c:redstone_ores': '레드스톤 광석', 'minecraft:diamond_ores': '다이아몬드 광석', 'minecraft:lava': '용암', 'minecraft:water': '물', 'minecraft:beehives': '벌집', 'cobblemon:flowers': '꽃', 'cobblemon:red_flowers': '빨간 꽃', 'cobblemon:yellow_flowers': '노란 꽃', 'cobblemon:orange_flowers': '주황 꽃', 'cobblemon:blue_flowers': '파란 꽃', 'cobblemon:white_flowers': '하얀 꽃', 'cobblemon:pink_flowers': '분홍 꽃', 'minecraft:sand': '모래', 'c:sand': '모래', 'cobblemon:berries': '열매 나무', 'cobblemon:concrete_blocks': '콘크리트', 'cobblemon:natural': '자연 블록', 'cobblemon:trees': '나무', 'minecraft:leaves': '나뭇잎' };
const blockKo = b => b.startsWith('#') ? (BLOCK_TAG_KO[b.slice(1)] ?? ingKo({ tag: b.slice(1) }).replace(' (종류 무관)', ' 류')) : itemKo(b);
const MOONS = ['보름달', '하현 직후', '하현', '그믐', '삭', '초승', '상현', '상현 직후'];
function condText(c = {}, anti = false) {
  const t = [];
  if (c.timeRange) t.push(TIME[c.timeRange] ?? c.timeRange);
  if (c.isRaining === true) t.push('비'); if (c.isRaining === false && !anti) t.push('비 안 올 때');
  if (c.isThundering) t.push('뇌우');
  if (c.canSeeSky === true) t.push('하늘 보이는 곳'); if (c.canSeeSky === false) t.push('하늘 안 보이는 곳');
  if (c.maxSkyLight !== undefined && c.maxSkyLight < 8) t.push('햇빛 안 드는 곳');
  if (c.maxLight !== undefined && c.maxLight <= 7) t.push('어두운 곳'); if (c.minLight >= 8) t.push('밝은 곳');
  if (c.minY !== undefined) t.push(`Y ${c.minY} 이상`); if (c.maxY !== undefined) t.push(`Y ${c.maxY} 이하`);
  if (c.moonPhase !== undefined) t.push(String(c.moonPhase).split(',').map(x => MOONS[+x] ?? x).join('/'));
  if (c.structures) t.push('구조물: ' + c.structures.map(structKo).join('/'));
  if (c.neededNearbyBlocks) t.push('근처: ' + c.neededNearbyBlocks.map(blockKo).join('/'));
  if (c.neededBaseBlocks) t.push('바닥: ' + c.neededBaseBlocks.map(blockKo).join('/'));
  if (c.isSlimeChunk) t.push('슬라임 청크');
  if (c.isPokeSnack) t.push('포케스낵 전용');
  if (c.minLureLevel) t.push(`미끼 레벨 ${c.minLureLevel}+`); if (c.maxLureLevel !== undefined) t.push(`미끼 레벨 ${c.maxLureLevel} 이하`);
  if (c.rodType) t.push(itemKo(c.rodType)); if (c.bait) t.push('미끼: ' + itemKo(c.bait));
  return t;
}
const multText = s => [...(s.weightMultiplier ? [s.weightMultiplier] : []), ...(s.weightMultipliers || [])]
  .map(w => { const c = condText(w.condition).map(x => x.replace('포케스낵 전용', '포케스낵 사용')); return c.length ? `${c.join('·')} 시 출현 ×${w.multiplier}` : ''; }).filter(Boolean);
const BIOME_IDX = Object.fromEntries(MC_BIOMES.map((b, i) => [b, i]));
// 코블벌스 전설: 구조물 안 바이옴을 cobbleverse:custom_spawn/<장소>로 바꿔 두고 가중치 0 = 야생 자연 출현 없음, 그 구조물에서만 만남
const PLACE_KO = { articuno_tower: '프리져 탑', zapdos_tower: '썬더 탑', moltres_tower: '파이어 탑', team_rocket_radio: '로켓단 전파탑', origin_temple: '기원의 신전', whirl_island: '소용돌이섬', bell_tower: '방울탑', ilex_shrine: '너도밤나무숲 사당', regirock_temple: '레지락 신전', regice_temple: '레지아이스 신전', registeel_temple: '레지스틸 신전', secret_garden: '비밀의 정원', kyogre_temple: '가이오가 신전', groudon_vulcano: '그란돈 화산', sky_pillar: '하늘기둥', jirachi_structure: '지라치 구조물', deoxys_meteorite: '테오키스 운석', newmoon_island: '초승달섬', flower_paradise: '꽃의 낙원', sinnoh_temple: '신오 신전', eternatus_cocoon: '무한다이노 고치', split_decision_temple: '갈림길 신전', crown_spire: '왕관 첨탑', crown_cemetery: '왕관 묘지', grasswither_shrine: '시든 풀 사당', icerend_shrine: '얼음 균열 사당', groundblight_shrine: '마른 대지 사당', firescoruge_shrine: '불꽃 재앙 사당' };
Object.assign(STRUCT_KO, { dyna_tree: '다이나트리', burned_tower: '불탄탑', dawn_tower: '새벽의 탑', dusk_tower: '황혼의 탑', crown_spire: '왕관 첨탑', crown_cemetery: '왕관 묘지', monument: '바다 유적', ruin: '폐허' });
const blabel = {}; // 바이옴 라벨 -> 실제 바이옴 인덱스
const spawns = []; // [monKey, alpha, bucket, level, pos, biomeLabels, biomeIdx[], conds, antiConds]
for (const { f } of dataFiles('spawn_pool_world')) {
  const j = readJ(f);
  if (j.enabled === false) continue; // 코블벌스 구성에선 neededInstalledMods 조건 쓰는 파일 없음
  for (const s of j.spawns || []) {
    if (s.type !== 'pokemon') continue;
    const k = resolveResult(s.pokemon);
    if (!mons[k]) continue;
    const c = s.condition || {}, a = s.anticondition || {};
    const place = (c.biomes || []).find(b => b.startsWith('cobbleverse:custom_spawn'));
    if (place && s.weight === 0) { mons[k].ev ??= PLACE_KO[place.split('/')[1]] ?? '코블벌스 전설 구조물'; continue; }
    if (s.weight === 0) continue; // 꺼둔 출현
    const any = !(c.biomes || []).length; // 바이옴 조건 없음 = 어디서나 (보통 구조물 조건만 있는 출현)
    const bs = any ? ['#cobblemon:is_overworld', '#cobblemon:is_nether', '#cobblemon:is_end'] : c.biomes.filter(b => /^#?(cobblemon|minecraft):/.test(b));
    if (!bs.length) continue; // 다른 모드 바이옴 전용
    const inc = new Set(); bs.forEach(b => biomeSet(b).forEach(x => inc.add(x)));
    (a.biomes || []).forEach(b => biomeSet(b).forEach(x => inc.delete(x)));
    const conds = [...(s.presets || []).filter(p => PRESET[p]).map(p => PRESET[p]), ...condText(c), ...multText(s)];
    const anti = [...(a.biomes || []).filter(b => /^#?(cobblemon|minecraft):/.test(b)).map(b => tagLabel(b) + ' 제외'), ...condText(a, true).map(x => x + ' 제외')];
    spawns.push([k, /alpha=true/.test(s.pokemon) ? 1 : 0, s.bucket, s.level, POS[s.spawnablePositionType] ?? s.spawnablePositionType,
      any ? ['바이옴 무관'] : bs.map(tagLabel), [...inc].map(b => BIOME_IDX[b]).filter(x => x !== undefined), conds, anti]);
    if (any) blabel['바이옴 무관'] = MC_BIOMES.map((_, i) => i);
    else for (const b of bs) { const l = tagLabel(b); const set = new Set(blabel[l] || []); biomeSet(b).forEach(x => BIOME_IDX[x] !== undefined && set.add(BIOME_IDX[x])); blabel[l] = [...set]; }
  }
}
const spawnCfg = readJ(dataFiles('spawning', 'cobblemon').find(x => x.rel === 'best-spawner-config.json').f);
const cfg = {
  version: VERSION, world: Object.fromEntries(spawnCfg.buckets.map(b => [b.name, b.weight])), // 1.7.3엔 낚시 전용 등급표 없음
  biomes: MC_BIOMES.map(b => [b, biomeKo(b)]),
};

// ---------- 관장 위치: 체육관 구조물(바이옴·높이) + RCT 트레이너(팀). 거래표의 구조물 태그 이름이 <지방>_<관장>_gym ----------
const ELITE_KO = { Lorelei: '칸나', Bruno: '시바', Agatha: '국화', Lance: '목호', Blue: '그린' }; // 사천왕·챔피언은 탐색 아이템이 없어서 한국어 이름을 직접 적음
const GYM_BIOME = { '#minecraft:has_structure/ancient_city': 'minecraft:deep_dark' }; // raw/mc_tags에 has_structure 태그가 없음
const DIM_KO = { 'minecraft:the_nether': '네더', 'minecraft:the_end': '엔드' };
const rctTrainers = Object.fromEntries(dataFiles('trainers', 'rctmod').map(x => [x.rel.replace(/\.json$/, ''), x.f]));
const gymStruct = Object.fromEntries(dataFiles('worldgen/structure', 'cobbleverse').map(x => [x.rel.replace(/\.json$/, ''), x.f]));
const teamOf = id => { const t = readJ(rctTrainers[id]); return [t.name?.literal ?? id, t.team.map(p => [resolveResult([p.species.replace(/^cobblemon:/, ''), ...(p.aspects || [])].join(' ')) ?? p.species, p.level])]; };
const topLv = team => Math.max(...team.map(p => p[1]));
const gyms = GYM_TRADES.map(([item, tag]) => {
  const region = tag.split(':')[1].split('_')[0], st = tagValues('cobbleverse', 'worldgen/structure', tag.split(':')[1])[0], sid = st.split(':')[1];
  const s = readJ(gymStruct[sid]), y = s.start_height?.absolute ?? 0;
  // 관장은 <지방>_<구조물 이름>, 리그 구조물은 그 지방의 사천왕·챔피언 전부
  const ids = rctTrainers[`${region}_${sid}`] ? [`${region}_${sid}`] : Object.keys(rctTrainers).filter(k => k.startsWith(region + '_league_') || k.startsWith(region + '_champion_'));
  const tr = ids.map(teamOf).sort((a, b) => topLv(a[1]) - topLv(b[1]));
  return {
    ko: (lang[`tooltip.lumymon.${item.split(':')[1]}`] ?? '').match(/§.(.+?)§r/)?.[1] ?? tr[0][0], it: item, st,
    bi: [].concat(s.biomes).map(b => tagLabel(GYM_BIOME[b] ?? (b.includes(':') ? b : 'minecraft:' + b))).join(' · '),
    en: [].concat(s.biomes).map(b => (GYM_BIOME[b] ?? b).split(/[:/]/).pop().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' · '), // 바닐라 바이옴은 영어 이름 = id를 띄어 쓴 것
    dim: DIM_KO[allR.get(item)?.[0]?.result?.components?.['lumymon:dimension_id']] ?? '',
    // 지표에 맞춰 놓는 구조물은 start_height가 지표 기준, 아니면 절대 높이
    // 지표 기준 음수(이슬 -21)는 기초가 내려가는 깊이일 뿐. misty.nbt는 높이 40, 체육관 바닥이 23층이라 건물은 수면 위로 나옴 (NBT로 확인)
    at: s.project_start_to_heightmap ? (y < 0 ? '수면 위로 솟은 건물' : '') : s.type === 'minecraft:jigsaw' ? `지하 Y ${y} 근처` : '',
    tr: tr.map(([n, team]) => [ELITE_KO[n] ?? n, team]),
  };
}).sort((a, b) => topLv(a.tr[0][1]) - topLv(b.tr[0][1]));

// ---------- 전설 포켓몬: 구조물 파일에서 바이옴·차원, 트레이너 파일에서 이름·레벨을 채움 ----------
// Terralith 바이옴은 한국어 번역이 없어서 직접 옮김 (게임 F3 화면에는 terralith:snowy_badlands 처럼 영어 id로 나옴)
const TERRA_KO = { snowy_badlands: '눈 덮인 악지', lush_desert: '무성한 사막', alpine_highlands: '고산 고원', blooming_plateau: '꽃 핀 고원', sakura_grove: '벚꽃 숲', sakura_valley: '벚꽃 계곡', glacial_chasm: '빙하 협곡', arid_highlands: '메마른 고원', wintry_lowlands: '겨울 저지대', cold_shrubland: '추운 관목지', hot_shrubland: '더운 관목지', steppe: '스텝 초원', desert_oasis: '사막 오아시스' };
const lgStruct = Object.fromEntries(dataFiles('worldgen/structure', null, true).map(x => [x.ns + ':' + x.rel.replace(/\.json$/, ''), x.f]));
const titleEn = id => id.split(/[:/]/).pop().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const lgBiomes = b => {
  if (!b.startsWith('#')) return [b.includes(':') ? b : 'minecraft:' + b];
  if (b === '#cobblemon:is_overworld') return [b];
  const [ns, p] = b.slice(1).split(':');
  return tagValues(ns, 'worldgen/biome', p, true).flatMap(v => lgBiomes(typeof v === 'string' ? v : v.id));
};
const lgWhere = st => {
  if (!lgStruct[st]) throw new Error('legends.js: 없는 구조물 ' + st);
  const bs = [].concat(readJ(lgStruct[st]).biomes).flatMap(lgBiomes);
  if (!bs.length) throw new Error('legends.js: 바이옴을 못 읽음 ' + st);
  const ko = b => b.startsWith('#') ? '오버월드 어디든' : b.includes('distortion') ? '왜곡세계' : b.startsWith('terralith:') ? (TERRA_KO[b.slice(10)] ?? titleEn(b)) : biomeKo(b.split(':')[1]);
  const en = b => b.startsWith('#') ? '' : b.includes('distortion') ? 'Distortion World' : titleEn(b) + (b.startsWith('terralith:') ? ' (Terralith)' : '');
  const dim = bs.some(b => /nether_wastes|crimson|warped|soul_sand|basalt/.test(b)) ? '네더' : bs.some(b => /:(end_|small_end_|the_end)/.test(b)) ? '엔드' : bs.some(b => b.includes('distortion')) ? '왜곡세계' : '';
  return { st, bi: bs.map(ko).join(' · '), en: bs.map(en).filter(Boolean).join(' · '), dim };
};
// {@트레이너} -> "게임 표기 이름 · 최고 Lv N", {ns:item} -> {아이템 키}
const lgT = s => s.replace(/\{@([a-z0-9_]+)\}/g, (m, id) => { if (!rctTrainers[id]) throw new Error('legends.js: 없는 트레이너 ' + id); const [n, team] = teamOf(id); return `${n} · 최고 Lv ${topLv(team)}`; })
  .replace(/\{([a-z_]+:[a-z0-9_]+)\}/g, (m, id) => `{${ikey(id)}}`);
// 레이드 굴 보스 중 전설 계열 (6·7단계). 폼만 다른 보스는 같은 종으로 묶음
const raidBoss = {};
for (const { f } of dataFiles('raid/boss', 'cobblemonraiddens')) {
  const j = readJ(f), k = String(j.pokemon?.species ?? '').replace(/^cobblemon:/, ''), tier = { TIER_SIX: 6, TIER_SEVEN: 7 }[j.raid_tier];
  if (tier && mons[k]?.lab) (raidBoss[tier] ??= new Set()).add(k);
}
const legends = {
  stages: LG.stages, common: LG_COMMON.map(ikey), plates: LG.plates.map(([p, w]) => ['mega_showdown:' + p, w]),
  raid: Object.fromEntries(Object.entries(raidBoss).map(([t, s]) => [t, [...s].sort((a, b) => mons[a].n - mons[b].n)])),
  list: LG.list.map(e => {
    for (const k of e.mons) if (!mons[k]) throw new Error('legends.js: 없는 포켓몬 ' + k);
    return { id: e.id, s: e.s, mons: e.mons, place: e.place, ...(e.st && { w: lgWhere(e.st) }), ...(e.radar && { radar: ikey(e.radar) }), ...(e.find && { find: lgT(e.find) }),
      ...(e.via && { via: e.via.map(([n, st, r]) => [n, lgWhere(st), ikey(r)]) }), need: e.need.map(([i, x]) => [ikey(i), lgT(x)]), steps: e.steps.map(lgT), lv: e.lv, shiny: e.shiny,
      ...(e.note && { note: e.note.map(lgT) }), ...(e.gim && { gim: e.gim.map(([i, x]) => [ikey(i), lgT(x)]) }) };
  }),
};

// ---------- 얻는 법: 포켓몬 드롭 · 블록 캐기 · 몹 처치 · 상자/보상 (루트 테이블) ----------
const src = {}; // item key -> {d: [[포켓몬 키, 확률]], b: [블록], e: [몹], l: [상자·보상]}
const addSrc = (k, t, v) => { const a = ((src[k] ??= {})[t] ??= []); if (!a.some(x => JSON.stringify(x) === JSON.stringify(v))) a.push(v); };
for (const [sid, sp] of Object.entries(species)) if (mons[sid]) for (const e of sp.drops?.entries || [])
  addSrc(ikey(e.item), 'd', [sid, e.percentage ? e.percentage + '%' : (e.quantityRange || 1) + '개']);
// 루트 테이블: 아이템 항목과 다른 테이블 참조를 모음. 다른 테이블이 참조하지 않는 것(뿌리)만 출처로 표시
const LT = {};
for (const { ns, rel, f } of dataFiles('loot_table')) {
  const t = LT[ns + ':' + rel.replace(/.json$/, '')] = { items: new Set(), refs: new Set() };
  const walk = e => {
    if (!e || typeof e !== 'object') return;
    if (Array.isArray(e)) return e.forEach(walk);
    const ty = String(e.type || '').replace('minecraft:', '');
    if (ty === 'item' && e.name) t.items.add(e.name);
    if (ty === 'tag' && e.name) tagItems(e.name).forEach(x => t.items.add(x));
    if (ty === 'loot_table' && typeof (e.value ?? e.name) === 'string') t.refs.add(e.value ?? e.name);
    ['pools', 'entries', 'children'].forEach(k => walk(e[k]));
  };
  try { walk(readJ(f)); } catch {}
  t.crop = fs.readFileSync(f, 'utf8').includes('"age"'); // 자라는 블록(규토리·열매·작물)
}
const refd = new Set(Object.values(LT).flatMap(t => [...t.refs]));
const ltItems = (id, seen = new Set()) => { if (seen.has(id) || !LT[id]) return []; seen.add(id); return [...LT[id].items, ...[...LT[id].refs].flatMap(r => ltItems(r, seen))]; };
const LT_KO = { chests: '', village: '마을', villages: '마을', desert_pyramid: '사막 사원', jungle_temple: '정글 사원', simple_dungeon: '던전', abandoned_mineshaft: '폐광', shipwreck_treasure: '난파선 보물', shipwreck_supply: '난파선 보급품', shipwreck_map: '난파선 지도', buried_treasure: '묻힌 보물', ruined_portal: '파괴된 차원문', bastion_treasure: '보루 보물', bastion_other: '보루', bastion_bridge: '보루 다리', bastion_hoglin_stable: '호글린 우리', nether_bridge: '네더 요새', end_city_treasure: '엔드 시티', stronghold_corridor: '요새 복도', stronghold_crossing: '요새 교차로', stronghold_library: '요새 서재', ancient_city: '고대 도시', ancient_city_ice_box: '고대 도시 얼음 상자', trial_chambers: '시련의 회당', woodland_mansion: '삼림 대저택', pillager_outpost: '약탈자 전초기지', igloo_chest: '이글루', underwater_ruin_big: '큰 바다 폐허', underwater_ruin_small: '작은 바다 폐허', spawn_bonus_chest: '보너스 상자', archaeology: '고고학(붓질)', desert_well: '사막 우물', ocean_ruin_cold: '차가운 바다 폐허', ocean_ruin_warm: '따뜻한 바다 폐허', trail_ruins_common: '오솔길 폐허', trail_ruins_rare: '오솔길 폐허(희귀)', gameplay: '', inject: '', fishing: '낚시', fish: '물고기', treasure: '보물', junk: '잡동사니', piglin_bartering: '피글린 물물교환', hero_of_the_village: '마을의 영웅 선물', cat_morning_gift: '고양이 아침 선물', sniffer_digging: '스니퍼 발굴', ruins: '폐허', shipwreck_coves: '난파선 만', fossils: '화석', injection: '', raid: '레이드', structures: '구조물', gilded_chests: '금빛 상자', village_weaponsmith: '무기 대장장이', village_toolsmith: '도구 대장장이', village_armorer: '갑옷 제조인', village_cartographer: '지도 제작자', village_mason: '석공', village_shepherd: '양치기', village_butcher: '도살업자', village_fletcher: '화살 제조인', village_fisher: '어부', village_tannery: '가죽 세공인', village_temple: '성직자', village_desert_house: '사막 집', village_plains_house: '평원 집', village_taiga_house: '타이가 집', village_snowy_house: '설원 집', village_savanna_house: '사바나 집', spawners: '시련의 생성기', general: '건물 상자', attic: '다락', bedroom: '침실', kitchen: '부엌', blacksmith: '대장간', sittingroom: '거실', workshop: '작업장', support_tables: '보조 상자', archaeological_site: '고고학 유적', reward: '보상', ominous: '불길한', vault: '금고' };
const LT_MOD = { cobblemon: '', sophisticatedbackpacks: '', minecraft: '', bca: '', mega_showdown: '메가 쇼다운 ', cobbleverse: '코블벌스 ', cobblemonraiddens: '', legendarymonuments: '전설 모뉴먼트 ' };
const ltLabel = id => { const [ns, p] = id.split(':'); return ((LT_MOD[ns] ?? ns + ' ') + p.split('/').map(w => LT_KO[w] ?? w.replace(/_/g, ' ')).filter(Boolean).join(' · ')).trim(); };
// ---------- 블록이 있는 곳: 광석 생성(worldgen) + 구조물 안 ----------
// bwhere[아이템 키] = [설명, ...]. 아이템 탭의 "있는 곳"과, 그 블록을 캐서 얻는 아이템의 "블록 캐기" 줄에 붙음
const bwhere = {};
const addW = (blk, t) => { const a = (bwhere[ikey(blk)] ??= []); if (!a.includes(t)) a.push(t); };
// 광석: configured_feature(ore) 가 놓는 블록 <- placed_feature 의 높이. 코블몬 진화의 돌 광석은 has_ore/ore_<돌>_<normal|rare|nether|dripstone> 태그로 바이옴까지
{
  const oreOf = {}; // feature id -> [[블록, 바탕(블록 id 또는 태그)]]
  for (const { ns, rel, f } of dataFiles('worldgen/configured_feature')) { const j = readJ(f); if (/:(scattered_)?ore$/.test(j.type)) oreOf[ns + ':' + rel.replace(/\.json$/, '')] = j.config.targets.map(t => [t.state.Name, t.target.block]); }
  const yv = v => v.absolute ?? (v.above_bottom !== undefined ? '바닥+' + v.above_bottom : v.below_top !== undefined ? '천장-' + v.below_top : '?');
  const agg = {}; // 블록|바이옴 글 -> [min, max, 바탕]
  for (const { ns, rel, f } of dataFiles('worldgen/placed_feature')) {
    const j = readJ(f), ore = typeof j.feature === 'string' && oreOf[j.feature]; if (!ore) continue;
    const h = j.placement.find(p => p.type === 'minecraft:height_range')?.height;
    const m = ns === 'cobblemon' && rel.match(/^ore\/([a-z]+_stone)_(upper|lower|nether|dripstone)(_rare)?\.json$/);
    const kind = m && (m[3] ? 'rare' : /upper|lower/.test(m[2]) ? 'normal' : m[2]);
    const bio = m ? tagValues('cobblemon', 'worldgen/biome', `has_ore/ore_${m[1]}_${kind}`).map(v => tagLabel(typeof v === 'string' ? v : v.id)).join(', ') : '';
    const head = kind === 'nether' ? '네더' : kind === 'rare' ? `드물게: ${bio} 바이옴` : kind ? `${bio} 바이옴` : '자연 생성';
    for (const [blk, base] of ore) {
      const o = (agg[blk + '|' + head] ??= [h ? yv(h.min_inclusive) : null, h ? yv(h.max_inclusive) : null, base]);
      if (h && typeof o[0] === 'number' && typeof h.min_inclusive.absolute === 'number') { o[0] = Math.min(o[0], h.min_inclusive.absolute); o[1] = Math.max(o[1], h.max_inclusive.absolute); }
    }
  }
  for (const [k, [lo, hi, base]] of Object.entries(agg)) { const [blk, head] = k.split('|'); addW(blk, `${head}${base ? ` (${itemKo(base)} 속)` : ''}${typeof lo === 'number' && typeof hi === 'number' ? ` · Y ${lo}~${hi}` : ''}`); }
}
// 구조물: NBT 의 블록 개수. 제작법이 없는(= 찾아야 하는) 모드 블록만. 구조물 이름은 전설 탭 장소 이름 -> 아래 표 -> 드롭 표와 같은 방식(ltLabel) 순
{
  const nbt = buf => { // gzip 푼 구조물 NBT -> 객체 (긴 배열 내용은 버림)
    let o = 0;
    const str = () => { const n = buf.readUInt16BE(o); o += 2; const t = buf.toString('utf8', o, o + n); o += n; return t; };
    const val = t => {
      switch (t) {
        case 1: return buf.readInt8(o++);
        case 2: o += 2; return buf.readInt16BE(o - 2);
        case 3: o += 4; return buf.readInt32BE(o - 4);
        case 4: o += 8; return 0;
        case 5: o += 4; return 0;
        case 6: o += 8; return 0;
        case 7: { const n = buf.readInt32BE(o); o += 4 + n; return null; }
        case 8: return str();
        case 9: { const tt = buf.readInt8(o++), n = buf.readInt32BE(o); o += 4; const a = []; for (let i = 0; i < n; i++) a.push(val(tt)); return a; }
        case 10: { const c = {}; for (;;) { const tt = buf.readInt8(o++); if (!tt) return c; const k = str(); c[k] = val(tt); } }
        case 11: { const n = buf.readInt32BE(o); o += 4 + n * 4; return null; }
        case 12: { const n = buf.readInt32BE(o); o += 4 + n * 8; return null; }
        default: throw new Error('nbt tag ' + t);
      }
    };
    const t = buf.readInt8(o++); str(); return val(t);
  };
  const zlib = require('zlib');
  const ST_NAME = { 'mega_showdown:megaroid': '메가운석', 'mega_showdown:mega_site': '메가스톤 정동' }; // 모드 한국어 발전과제 표기
  const LG_PLACE = Object.fromEntries(LG.list.filter(e => e.st).map(e => [e.st, e.place]));
  const stName = sid => LG_PLACE[sid] ?? ST_NAME[sid] ?? ltLabel(sid);
  // 구조물 조각(nbt id) -> [구조물 이름, 높이]. worldgen/structure 의 start_pool 에 바로 들어 있는 조각만 (가지 조각은 경로 이름으로)
  const poolFile = Object.fromEntries(dataFiles('worldgen/template_pool', null, true).map(x => [x.ns + ':' + x.rel.replace(/\.json$/, ''), x.f]));
  const procFile = Object.fromEntries(dataFiles('worldgen/processor_list', null, true).map(x => [x.ns + ':' + x.rel.replace(/\.json$/, ''), x.f]));
  const piece = {}, stLabel = {}, swapped = {}; // swapped: 블록 키 -> 조각을 놓을 때 그 블록으로 바뀌는 구조물 이름들
  for (const { ns, rel, f } of dataFiles('worldgen/structure', null, true)) {
    const j = readJ(f), sid = ns + ':' + rel.replace(/\.json$/, ''), pf = poolFile[j.start_pool]; if (!pf) continue;
    const h = j.start_height, abs = v => typeof v?.absolute === 'number';
    const y = j.project_start_to_heightmap || !h ? '' : abs(h.min_inclusive) && abs(h.max_inclusive) ? `Y ${h.min_inclusive.absolute}~${h.max_inclusive.absolute}` : abs(h) ? `Y ${h.absolute}` : '';
    const label = stLabel[sid] = stName(sid) + (y ? ` (${y})` : '');
    for (const el of readJ(pf).elements || []) for (const e of [el.element, ...(el.element?.elements || [])]) {
      if (typeof e?.location !== 'string') continue;
      piece[e.location] ??= label;
      // 조각을 놓을 때 블록 일부를 다른 블록으로 바꾸는 규칙 (메가스톤 정동의 진화의 돌 광석, 폐허의 모으령 상자)
      const pr = typeof e.processors === 'string' && procFile[e.processors];
      if (pr) for (const p of readJ(pr).processors || []) for (const r of p.rules || []) if (r.output_state?.Name && !r.output_state.Name.startsWith('minecraft:')) (swapped[ikey(r.output_state.Name)] ??= new Set()).add(label);
    }
  }
  for (const [k, set] of Object.entries(swapped)) (bwhere[k] ??= []).push('구조물이 생길 때 블록 일부가 이걸로 바뀜: ' + [...set].slice(0, 4).join(', ') + (set.size > 4 ? ` 외 ${set.size - 4}곳` : ''));
  // 가지 조각(start_pool 에 없는 것)은 경로가 구조물 id 로 시작하면 그 구조물 이름
  const stIds = Object.keys(stLabel).sort((x, y) => y.length - x.length);
  const byPrefix = sid => { const hit = stIds.find(s => sid === s || sid.startsWith(s + '/') || sid.startsWith(s + '_')); return hit && stLabel[hit]; };
  const walkNbt = (d, acc = []) => { if (fs.existsSync(d)) for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walkNbt(p, acc) : e.name.endsWith('.nbt') && acc.push(p); } return acc; };
  const found = {}; // 블록 키 -> {구조물 이름: 개수}
  for (const L of [...LAYERS, ...XLAYERS]) {
    const dd = path.join(L, 'data'); if (!fs.existsSync(dd)) continue;
    for (const ns of fs.readdirSync(dd)) { const root = path.join(dd, ns, 'structure'); for (const f of walkNbt(root)) {
      let r; try { r = nbt(zlib.gunzipSync(fs.readFileSync(f))); } catch { continue; }
      const pal = r.palette ?? r.palettes?.[0] ?? [], cnt = {};
      for (const blk of r.blocks || []) { const nm = pal[blk.state]?.Name; if (nm && !nm.startsWith('minecraft:')) cnt[nm] = (cnt[nm] || 0) + 1; }
      const rel = path.relative(root, f).split(path.sep).join('/').slice(0, -4), sid = ns + ':' + rel;
      const label = piece[sid] ?? byPrefix(sid) ?? (/^villages?[_/]/.test(rel) ? '마을' : ltLabel(ns + ':' + rel.split('/').slice(0, rel.includes('/') ? -1 : 1).slice(0, 2).join('/')));
      for (const [blk, c] of Object.entries(cnt)) { const k = ikey(blk); if (items[k] && !recipes[k]) { const o = (found[k] ??= {}); o[label] = Math.max(o[label] || 0, c); } }
    } }
  }
  for (const [k, o] of Object.entries(found)) {
    const e = Object.entries(o).sort((x, y) => y[1] - x[1]);
    (bwhere[k] ??= []).push('구조물 안: ' + e.slice(0, 4).map(([l, c]) => `${l} ${c}개`).join(', ') + (e.length > 4 ? ` 외 ${e.length - 4}곳` : ''));
  }
}
// 손으로 쓴 설명이 더 자세한 것 (구조물 파일로 확인)
Object.assign(bwhere, {
  'mega_showdown:mega_stone_crystal': ['지하 Y -19~5 의 "메가스톤 정동" 안에 1개. 정동은 메가운석 블록으로 된 13칸 크기 덩어리'],
  'mega_showdown:keystone_ore': ['지하 Y -32~-20 의 "메가운석" 안에 1개. 메가운석 블록으로 된 13칸 크기 덩어리'],
});
const srcB = {}; // 아이템 키 -> Map(블록이 있는 곳 -> [블록 이름]). 루프가 끝나면 src[k].b 로 옮김
for (const id of Object.keys(LT)) {
  if (refd.has(id)) continue;
  const [ns, p] = id.split(':'), its = new Set(ltItems(id).map(ikey));
  if (p.startsWith('blocks/')) {
    // 광석은 떨구는 다른 아이템만. 규토리·열매·작물처럼 자라는 블록은 자기 자신도 "다 자라면 수확"
    // 블록이 있는 곳(bwhere)이 같은 블록끼리는 한 줄로 묶음: "불꽃의돌 광석 · 심층암 불꽃의돌 광석 — 사막 … 바이옴 · Y -64~320"
    const b = ikey(ns + ':' + p.slice(7)), nm = itemKo(b), w = bwhere[b] ? bwhere[b].slice(0, 2).join(' / ') : '';
    its.forEach(k => { if (k !== b || LT[id].crop) ((srcB[k] ??= new Map()).get(w) ?? srcB[k].set(w, []).get(w)).push(nm + (k === b ? ' (다 자라면 수확)' : '')); });
  }
  else if (p.startsWith('entities/')) { if (ns === 'minecraft') { const nm = mcLang['entity.minecraft.' + p.slice(9).split('/')[0]] ?? p.slice(9); its.forEach(k => addSrc(k, 'e', nm)); } }
  else if (ns === 'rctmod') its.forEach(k => addSrc(k, 'l', '트레이너 대결 보상')); // 트레이너별 표가 수백 개라 하나로
  else if (!/^(equipment|shearing|pots|dispensers|placeholder)/.test(p)) its.forEach(k => addSrc(k, 'l', ltLabel(id)));
}
for (const [k, m] of Object.entries(srcB)) for (const [w, names] of m) addSrc(k, 'b', [...new Set(names)].join(' · ') + (w ? ' — ' + w : ''));
// 도감에서 보여줄 아이템(아이템 탭·레시피 재료·결과물·기믹)만 남기고, 목록이 길면 자름
const shown = new Set([...Object.keys(items), ...Object.keys(recipes), ...Object.values(recipes).flat().flatMap(r => [...r.ik, ...(r.gk || []).flat()]),
  ...Object.values(moves).flatMap(m => m[10] ? [...m[10].ik, ...(m[10].gk || []).flat()] : [])].filter(Boolean));
for (const k of Object.keys(src)) {
  if (!shown.has(k)) { delete src[k]; continue; }
  for (const t of Object.keys(src[k])) if (src[k][t].length > 14) src[k][t] = [...src[k][t].slice(0, 14), `외 ${src[k][t].length - 14}곳`];
}

// ---------- self-check ----------
const ids = new Set(Object.keys(mons));
let bad = 0;
for (const [k, m] of Object.entries(mons)) {
  if (m.pre && !ids.has(m.pre)) { console.error('bad pre', k, m.pre); bad++; }
  for (const e of m.evos) if (!ids.has(e.to)) { console.error('bad evo', k, e.to); bad++; }
  for (const [, id] of m.lv) if (!moves[id]) { console.error('bad move', k, id); bad++; }
}
if (bad) process.exit(1);

const order = Object.keys(mons).sort((a, b) => mons[a].n - mons[b].n || (mons[a].form ? 1 : 0) - (mons[b].form ? 1 : 0) || a.localeCompare(b));
const types = Object.fromEntries(TYPES.map(t => [t, typeKo(t)]));
const out = `window.DEX=${JSON.stringify({ types, moves, mons, order, abilities, natures, items, recipes, src, bw: Object.fromEntries(Object.entries(bwhere).filter(([k]) => items[k])), tools: TOOLS, ic: [...ICONS], st: Object.fromEntries(Object.entries(STATION).map(([w, id]) => [w, ikey(id)])), spawns, cfg, blabel, gyms, gt: GYM_TABLES, legends })};`;
fs.writeFileSync(path.join(__dirname, 'data.js'), out);
const cats = {}; Object.values(items).forEach(i => cats[i[1]] = (cats[i[1]] || 0) + 1);
console.log(`Cobblemon ${VERSION}: mons ${order.length} (species ${Object.keys(species).length}), moves ${Object.keys(moves).length}, tm ${Object.values(moves).filter(m => m[10]).length}, items ${Object.keys(items).length}, recipes ${Object.keys(recipes).length}, spawns ${spawns.length}, data.js ${(out.length / 1048576).toFixed(1)} MB`);
console.log('item cats', cats);
