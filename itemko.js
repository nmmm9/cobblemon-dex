// 한국어 언어 파일이 없는 모드(장식·요리·인형 등)의 아이템 이름을 한국어로 바꿈. build.js가 씀
// 1) 게임 언어 파일의 영어·한국어 쌍(바닐라·코블몬·모드)으로 구문을 먼저 바꾸고 2) 남는 단어는 아래 W로 바꿈. 사전에 없는 단어(플레이어 이름 등)는 영어로 둠
// 배지 이름: 우만위키 "체육관 배지" 문서 기준
const BADGE = { Boulder: '회색', Cascade: '블루', Thunder: '오렌지', Rainbow: '무지개', Soul: '핑크', Marsh: '골드', Volcano: '진홍색', Earth: '그린',
  Zephyr: '윙', Hive: '인섹트', Plain: '레귤러', Fog: '팬텀', Storm: '쇼크', Mineral: '스틸', Glacier: '아이스', Rising: '라이징',
  Stone: '스톤', Knuckle: '너클', Dynamo: '다이나모', Heat: '히트', Balance: '밸런스', Feather: '깃털', Mind: '마인드', Rain: '레인',
  Coal: '콜', Forest: '포리스트', Cobble: '코블', Fen: '팬', Relic: '레릭', Mine: '마인', Icicle: '글레이셔', Beacon: '비컨' };
const KANTO = { Brock: '웅', Misty: '이슬', 'Lt. Surge': '마티스', Erika: '민화', Koga: '독수', Sabrina: '초련', Blaine: '강연', Giovanni: '비주기', 'Tell & Pat': '풍 & 란' };
// 통째로 먼저 바꿀 구문 (대소문자 그대로)
const H = [['Pokemon Egg', '포켓몬 알'], ['Silver Bottle Cap', '은색왕관'], ['Gold Bottle Cap', '금색왕관'], ['Bottle Cap', '은색왕관'], ['(Special Attack)', '(특수공격)'], ['(Special Defense)', '(특수방어)'],
  ['(Attack)', '(공격)'], ['(Defense)', '(방어)'], ['(Speed)', '(스피드)'], ['Bucket of Experience', '경험치 양동이'], ['Spawn Egg', '스폰 알'], ['au Lait', '오레'], ['Five Alarm', '파이브 알람'],
  ['Infinity Upgrade (Admin)', '무한 업그레이드 (관리자)'], ['Chimechite', '치렁나이트'], ['Trainer Repel Rod', '트레이너 퇴치 막대'], ['Old PokéNav', '낡은 포케내비'], ['PokéNav', '포케내비'],
  ['Fence Gate', '울타리 문'], ['Pressure Plate', '압력판'], ['Washing Machine', '세탁기'], ['Grandfather Clock', '괘종시계'], ['Wall Clock', '벽시계'], ['Shaved Ice', '빙수'], ['Stir-Fry', '볶음'],
  ['(Cobble Entertainment System)', '(코블 엔터테인먼트 시스템)']];
const W = {
  stairs: '계단', slab: '반 블록', plank: '판자', planks: '판자', tiles: '타일', tile: '타일', pokemon: '포켓몬', pokémon: '포켓몬', pokedoll: '인형', block: '블록', pattern: '무늬', small: '작은', diagonal: '대각선',
  shiny: '이로치', paving: '포장', gigantic: '거대', rotated: '회전된', squares: '사각', large: '큰', chiseled: '조각된', beams: '들보', stripes: '줄무늬', bordered: '테두리', dotted: '점박이', wavy: '물결',
  purpur: '퍼퍼', mosaic: '모자이크', pillar: '기둥', pillars: '기둥', wall: '담장', woven: '엮은', dark: '짙은', polished: '윤나는', smooth: '매끄러운', sink: '싱크대', quartz: '석영', counter: '조리대',
  crate: '나무상자', flooring: '바닥재', table: '테이블', chair: '의자', drawer: '서랍', fountain: '분수', patterned: '무늬 새긴', copper: '구리', gold: '금', fence: '울타리', badge: '배지', poké: '포케',
  wool: '양털', stool: '스툴', redstone: '레드스톤', distortion: '왜곡', cabinet: '수납장', shake: '셰이크', lamp: '램프', roasted: '구운', salad: '샐러드', sofa: '소파', netherite: '네더라이트',
  amethyst: '자수정', boards: '널빤지', sandwich: '샌드위치', bathtub: '욕조', chimney: '굴뚝', circles: '원형', dented: '움푹한', scales: '비늘', curry: '카레', spout: '수도꼭지', gate: '문',
  button: '버튼', portstone: '포트스톤', waystone: '웨이스톤', bean: '콩', carpet: '카펫', curtain: '커튼', stove: '스토브', cabinetry: '찬장', armchair: '안락의자', upper: '위쪽', carved: '조각한',
  inverted: '뒤집힌', crushed: '부순', panel: '패널', panels: '패널', bottle: '병', cap: '뚜껑', decorated: '장식된', crosses: '십자', soul: '영혼', night: '밤', stand: '스탠드', support: '받침',
  trapped: '함정', weathered: '풍화된', lines: '선', rows: '줄', striped: '줄무늬', figurine: '피규어', cupboard: '찬장', shelf: '선반', storage: '수납', mirror: '거울', stump: '그루터기',
  pulverized: '가루', stack: '스택', tier: '단계', spicy: '매운', jewel: '보석', animated: '움직이는', slanted: '비스듬한', compacted: '압축된', gears: '톱니', fabric: '천', blobs: '얼룩',
  clumps: '덩어리', clovers: '클로버', spiral: '나선', withered: '시든', sweet: '달콤한', ominous: '불길한', crystal: '수정', downgrade: '다운그레이드', upgrade: '업그레이드', bitter: '쓴', dry: '건조',
  low: '낮은', medium: '중간', high: '높은', regular: '보통', deluxe: '디럭스', cobbled: '조약돌', plating: '도금', poképuff: '포플레', malasada: '말라사다', trophy: '트로피', statue: '동상',
  apricorn: '규토리', saccharine: '달콤한', undead: '언데드', mossy: '이끼 낀', endstone: '엔드 돌', galar: '가라르', galarian: '가라르', particle: '입자', seal: '봉인', shrine: '사당', stake: '말뚝',
  infinity: '무한', salty: '짠', sour: '신', fruit: '과일', golden: '황금', candied: '설탕 절임', badges: '배지 상자', league: '리그', posing: '포즈', head: '머리', cushion: '쿠션', family: '가족',
  trim: '장식', cut: '깎은', edged: '모서리', cone: '원뿔', cracked: '금 간', ovals: '타원', bars: '창살', shafts: '축', cubes: '큐브', grid: '격자', rhombuses: '마름모', chunks: '덩어리', soil: '흙',
  tilled: '경작된', waxed: '밀랍칠한', mesh: '망', framed: '액자형', pipes: '파이프', processed: '가공된', glossy: '광택', indented: '홈 파인', face: '얼굴', spotted: '반점', jagged: '들쭉날쭉한',
  organic: '유기적', sided: '면', compressed: '압축된', path: '길', waves: '물결', origin: '오리진', trainer: '트레이너', icerend: '파오젠', groundblight: '딩루', firescourge: '위유이', grasswither: '총지엔',
  ore: '광석', filter: '필터', muddy: '진흙', violet: '보라', mix: '믹스', medley: '모둠', mushroom: '버섯', honey: '꿀', tofu: '두부', poke: '포켓', raid: '레이드', floor: '바닥', ceramic: '도자기',
  portal: '포털', griseous: '백금', key: '열쇠', advanced: '고급', omega: '오메가', survival: '서바이벌', scroll: '두루마리', shard: '조각', spice: '향신료', pepper: '후추', leek: '대파', butter: '버터',
  ninja: '닌자', cheese: '치즈', ham: '햄', vegetable: '채소', iced: '아이스', grain: '곡물', earthy: '흙내음', verdant: '푸릇한', coral: '산호', kanto: '관동', johto: '성도', hoenn: '호연', sinnoh: '신오',
  cobble: '코블', basket: '바구니', fishbowl: '어항', voucher: '교환권', summer: '여름', porcelain: '도자기', fridge: '냉장고', toilet: '변기', corner: '모서리', rocky: '바위', bundled: '묶은', ribs: '갈비',
  skull: '해골', sheared: '깎은', diamonds: '마름모', grooves: '홈', plated: '도금된', reinforced: '강화', sheets: '판', swirling: '소용돌이', meteoric: '운석', slated: '슬레이트', raw: '원석', ingot: '주괴',
  pokefinder: '포켓파인더', fishingnav: '피싱내비', card: '카드', rod: '막대', old: '낡은', log: '원목', leaves: '잎', plate: '판', hanging: '매다는', door: '문', trapdoor: '다락문', tree: '나무',
  sapling: '묘목', cocoon: '고치', elevator: '엘리베이터', silver: '은색', spawner: '스포너', smithing: '대장장이', basic: '기본', interface: '인터페이스', filing: '서류', polymorphic: '다형', tag: '태그',
  configurator: '설정기', inventory: '인벤토리', ender: '엔더', nether: '네더', blank: '빈', dormant: '휴면', crumbling: '부서지는', attuned: '조율된', twinbound: '쌍결속', epitaph: '비문', paintbrush: '붓',
  decoration: '장식', experience: '경험치', seeds: '씨앗', seed: '씨앗', indigo: '남색', variety: '모둠', whipped: '휘핑', cream: '크림', herb: '허브', boiled: '삶은', frozen: '냉동', 'dry-smoked': '훈제',
  drought: '가뭄', katsu: '가츠', 'dream-eater': '꿈먹기', mild: '순한', 'zing-zap': '찌릿찌릿', beanburger: '콩버거', pickle: '피클', zesty: '상큼한', jam: '잼', veggie: '채소', jambon: '잠봉', beurre: '뵈르',
  claw: '발톱', noodle: '국수', tower: '탑', hefty: '푸짐한', fillet: '필레', dessert: '디저트', smoky: '스모키', mixed: '믹스', tail: '꼬리', spore: '포자', cloak: '망토', ceasar: '시저', gluttony: '먹보',
  veil: '베일', superpower: '엄청난힘', extreme: '익스트림', snoozy: '졸린', tomato: '토마토', moomoo: '모모', caprese: '카프레제', contrary: '심술꾸러기', chocolate: '초콜릿', meat: '고기', overheat: '오버히트',
  ginger: '생강', fancy: '고급', immunity: '면역', dazzling: '눈부신', wave: '웨이브', greengrass: '그린그래스', calm: '차분한', fury: '분노', attack: '공격', corn: '옥수수', cross: '크로스', chop: '촙',
  defiant: '오기', 'coffee-dressed': '커피 드레싱', petal: '꽃잎', blizzard: '눈보라', layered: '레이어드', acid: '애시드', 'yoghurt-dressed': '요구르트 드레싱', mint: '민트', citrus: '시트러스', mocha: '모카',
  coffee: '커피', bouncy: '탱글탱글', soda: '소다', punch: '펀치', floral: '플로럴', tea: '차', smoothie: '스무디', kantonian: '관동식', crêpe: '크레이프', alolan: '알로라식', pickled: '절인', and: '와',
  cucumber: '오이', hoennian: '호연식', eclair: '에클레어', fruity: '과일향', flan: '플랑', ceviche: '세비체', dubious: '수상한', food: '음식', twin: '쌍둥이', berry: '열매', salt: '소금', merchant: '상인',
  spawn: '스폰', coin: '코인', nickel: '니켈', dime: '다임', pass: '패스', radiant: '빛나는', token: '토큰', furni: '가구', crafter: '제작대', kitchen: '주방', azure: '하늘빛', vanilla: '바닐라', goldenrod: '금빛',
  lab: '연구소', minted: '민트', pale: '창백한', pool: '수영장', bonsai: '분재', plant: '식물', potted: '화분', pothos: '스킨답서스', mini: '미니', topiary: '토피어리', desk: '책상', ancient: '고대',
  dye: '염료', vat: '통', telescope: '망원경', paint: '페인트', hay: '건초', trader: '상인', stripped: '껍질 벗긴', staff: '지팡이', oran: '오랭', jukebox: '주크박스', hopper: '깔때기',
  item: '아이템', piglin: '피글린', creeper: '크리퍼', skeleton: '스켈레톤', ironlace: '아이언레이스', zenith: '제니스', 'no-ice': '얼음 없는', of: '', '&': '&', hp: 'HP', pc: 'PC', tv: 'TV', tnt: 'TNT', bb: 'BB',
};
module.exports = (pairs, leader) => {
  const P = {};
  // 나무·색 이름: 바닐라 "OO 판자"·"OO 양털"에서 앞부분만 뽑음 (Oak -> 참나무, Magenta -> 자홍색)
  for (const [e, k] of pairs) { const m = /^(.+) (Planks|Wool)$/.exec(e), n = / (판자|양털)$/.exec(k); if (m && n) P[m[1].toLowerCase()] = k.slice(0, -n[0].length); }
  for (const [e, k] of pairs) if (!/[%(]/.test(e) && e.split(' ').length <= 4 && /[가-힣]/.test(k)) P[e.toLowerCase()] ??= k;
  const who = n => KANTO[n] ?? leader[n]?.[0] ?? n;
  return s => {
    const b = /^(\w+) Badge \((.+)\)$/.exec(s);
    if (b && BADGE[b[1]]) return `${BADGE[b[1]]}배지 (${who(b[2])})`;
    for (const [a, c] of H) s = s.split(a).join(c);
    const w = s.split(/\s+/), out = [];
    for (let i = 0; i < w.length;) {
      let j = Math.min(w.length, i + 4);
      for (; j > i; j--) { const p = w.slice(i, j).join(' ').toLowerCase(); if (P[p] && (j - i > 1 || !(p in W))) { out.push(P[p]); break; } }
      if (j > i) { i = j; continue; }
      const t = w[i].toLowerCase();
      out.push(t in W ? W[t] : w[i]); i++;
    }
    return out.filter(Boolean).join(' ');
  };
};
