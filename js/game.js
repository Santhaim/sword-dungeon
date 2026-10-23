// 던전 원정대(옛 이름 검사의 던전) 본체(10-21~22 사용자 «핵앤슬래시» · «전부 순수하게 새로 만들어서» · «설계대로 끝까지»)
//   그림 = window.ART(art/ · 우리가 그린 것만) · 숫자 = DATA · 판 밖 기록 = SAVE · 소리 = SFX
//   이동은 직접 · 사거리 안 적에 일반 공격 자동 · 스킬 2 · 게이지 필살기 · 회피(무적 잠깐)
//   판 안: 레벨 업 카드(등급) · 자동 능력·진화 · 정예·상자 · 12분(3·9분 정예 무리 · 6분 중간 보스 · 12분 마지막 보스)
//   몬스터는 굼뜬 공격 동작(예고 → 공격 → 쉼) · 원거리는 느린 탄 · 보스는 빨간 바닥 예고 뒤 기술, 체력 절반 아래로 거칠게
'use strict';
const HNS = (() => {
  const D = DATA;
  const STEP = 1 / 60;
  const TILE = 16, CHUNK = 16 * TILE;
  const ROWS = ['down', 'left', 'right', 'up'];
  let A = null;
  const base = 'art/';
  const imgs = {};
  let cv, scr = null, ctx = null, low = null, lctx = null, dpr = 1, S = 2, VW = 480, VH = 320;
  let zoomAdj = 0;
  let G = null;
  let hooks = {};
  const chunks = new Map(), infos = new Map(), tintCache = new Map();
  let joy = null, ctrl = 'auto', dest = null;
  const keys = new Set();
  let botMove = null, simming = false;

  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const angDiff = (a, b) => { let d = a - b; return Math.atan2(Math.sin(d), Math.cos(d)); };
  function wpick(list, w) { let s = 0; for (const x of list) s += w(x); let r = Math.random() * s; for (const x of list) { r -= w(x); if (r <= 0) return x; } return list[list.length - 1]; }
  function img(p) {                     // ART.ver = 그림 묶음 판(바뀌면 브라우저가 예전 그림을 버림)
    if (!imgs[p]) { const im = new Image(); im.src = base + p + '?v=' + A.ver; imgs[p] = im; }
    return imgs[p];
  }
  const ready = im => im.complete && im.naturalWidth > 0;
  const sfx = n => { if (!simming && window.SFX) SFX.play(n); };

  // ── 화면: 짧은 쪽에 원본 약 300px · 정수 배율 · 세상은 작은 판(low)에 1:1 로 그리고 화면엔 한 번에 S배(최적화)
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = cv.parentElement.getBoundingClientRect();
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    S = Math.max(1, Math.round(Math.min(cv.width, cv.height) / 300) + zoomAdj);
    VW = cv.width / S; VH = cv.height / S;
  }

  // ── 바닥·항아리·세운 장식(256px 덩어리마다 같은 씨앗 → 늘 같은 배치)
  //   10-23 사용자 «경험치 먹느라 주변만 왔다갔다 → 벽(기둥)을 없애고 항아리를 많이» → 기둥은 더 안 놓음(충돌·그리기 코드는 남김)
  //   항아리 = 무리 지어 · 닿거나 때리면 깨짐(회복약·자석·금화·드물게 숨은 상자) · 깨진 건 G.potsBroken 에 적어 덩어리를 다시 만들어도 안 돌아옴
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function chunkInfo(cx, cy) {
    const key = cx + ',' + cy;
    let inf = infos.get(key);
    if (inf) return inf;
    const r = seeded(Math.floor(hash(cx * 31 + 7 + G.seed, cy * 17 + 3) * 4294967296));
    inf = { solid: [] };
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const clear = (x, y, m) => Math.hypot(x, y) > 70 && inf.solid.every(o => Math.abs(o.x - x) > m + 18 || Math.abs(o.y - y) > m + 18);
    if (r() < 0.045 && Math.hypot(cx, cy) > 1) {        // 제단(해머워치식 발견): 밟으면 잠깐 힘이 남
      const x = ox + 40 + Math.floor(r() * (CHUNK - 80)), y = oy + 40 + Math.floor(r() * (CHUNK - 80));
      if (clear(x, y, 16)) inf.solid.push({ kind: 'shrine', x, y, r: 0, type: SHRINES[Math.floor(r() * SHRINES.length)] });
    }
    const T = D.POT;
    let pk = 0;
    const pot = (x, y) => {                             // 모양·번호는 늘 같은 순서로 뽑음(깨진 것도 자리는 차지 → 다시 만들어도 배치 그대로)
      const id = key + '#' + (pk++), u = r(), v = u < 0.45 ? 0 : u < 0.7 ? 1 : 2;
      if (Math.hypot(x, y) > 70 && inf.solid.every(o => Math.hypot(o.x - x, o.y - y) > (o.kind === 'pot' ? 13 : 27)))
        inf.solid.push({ kind: 'pot', id, x, y, v, gone: G.potsBroken.has(id) });
    };
    if (r() < T.group) {                                // 무리: 가운데에서 22px 안에 2~4개
      const gx = ox + 30 + r() * (CHUNK - 60), gy = oy + 30 + r() * (CHUNK - 60);
      for (let k = 0, n = T.groupN[0] + Math.floor(r() * (T.groupN[1] - T.groupN[0] + 1)); k < n; k++) {
        const a = r() * Math.PI * 2, d = 6 + r() * 16;
        pot(Math.round(gx + Math.cos(a) * d), Math.round(gy + Math.sin(a) * d * 0.7));
      }
    }
    if (r() < T.single) pot(ox + 20 + Math.floor(r() * (CHUNK - 40)), oy + 20 + Math.floor(r() * (CHUNK - 40)));
    const names = Object.keys(A.props);
    for (let k = 0, n = Math.floor(r() * 4); k < n; k++) {
      const name = names[Math.floor(r() * names.length)], o = A.props[name];
      const x = ox + 16 + Math.floor(r() * (CHUNK - 32)), y = oy + 16 + Math.floor(r() * (CHUNK - 24));
      if (clear(x, y, 12)) inf.solid.push({ kind: 'prop', name, x, y, r: name === 'bones' ? 0 : o.r });
    }
    infos.set(key, inf);
    if (infos.size > 300) infos.delete(infos.keys().next().value);
    return inf;
  }
  function chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = chunks.get(key);
    if (c) return c;
    const t = A.tiles[G.dun.key] || A.tiles.crypt, im = img(t.file);
    if (!ready(im)) return null;
    c = document.createElement('canvas'); c.width = c.height = CHUNK;
    const g = c.getContext('2d');
    const tot = t.weights.reduce((a, b) => a + b, 0);
    for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
      let rr = hash(cx * 16 + tx + G.seed, cy * 16 + ty) * tot, k = 0;
      while (k < t.n - 1 && rr >= t.weights[k]) { rr -= t.weights[k]; k++; }
      g.drawImage(im, k * TILE, 0, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
    }
    chunks.set(key, c);
    if (chunks.size > 48) chunks.delete(chunks.keys().next().value);
    return c;
  }
  // 제단 다섯: 색 · 이름 · 효과(밟는 순간)
  const SHRINES = ['fury', 'swift', 'magnet', 'gold', 'life'];
  const SHRINE = {
    fury: { name: '분노의 제단', c: '#ff5a3a', say: '30초 동안 공격력 +50%' },
    swift: { name: '바람의 제단', c: '#6ae0ff', say: '30초 동안 이동·공격 속도 +35%' },
    magnet: { name: '끌림의 제단', c: '#7aff8a', say: '보석과 금화를 모두 끌어옴' },
    gold: { name: '황금 제단', c: '#ffd34a', say: '금화가 쏟아짐' },
    life: { name: '생명의 샘', c: '#ff8ad0', say: '체력을 모두 채움' },
  };
  function useShrine(o) {
    o.used = true;
    const S = SHRINE[o.type], p = G.p;
    if (o.type === 'fury') G.buff.fury = 30;
    else if (o.type === 'swift') G.buff.swift = 30;
    else if (o.type === 'magnet') { for (const g of G.gems) g.pull = true; for (const c of G.coins) c.pull = true; }
    else if (o.type === 'gold') for (let i = 0; i < 16; i++) G.coins.push({ x: o.x + rand(-20, 20), y: o.y + rand(-14, 14), v: 2 + Math.floor(G.dun.tier), pull: false });
    else if (o.type === 'life') heal(p.maxHp);
    G.run.shrines = (G.run.shrines || 0) + 1;
    G.fx.push({ k: 'sparkle', x: o.x, y: o.y - 14, t: 0, dur: 1, c: S.c });
    G.fx.push({ k: 'ring', x: o.x, y: o.y - 4, r: 40, t: 0, dur: 0.5, c: S.c });
    sfx('legend');
    hooks.toast && hooks.toast(`${S.name} — ${S.say}`);
  }
  // 기둥(사각)·장식(원)에 부딪히면 밀어냄 — 밀린 쪽(법선 합)을 돌려줌
  function solve(ent, r) {
    const cx = Math.floor(ent.x / CHUNK), cy = Math.floor(ent.y / CHUNK);
    let nx = 0, ny = 0;
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (const o of chunkInfo(gx, gy).solid) {
        if (o.gone) continue;
        if (o.kind === 'pillar') {
          const qx = Math.max(o.x0, Math.min(ent.x, o.x1)), qy = Math.max(o.y0, Math.min(ent.y, o.y1));
          const dx = ent.x - qx, dy = ent.y - qy, d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 > 1e-4) { const d = Math.sqrt(d2); ent.x += dx / d * (r - d); ent.y += dy / d * (r - d); nx += dx / d; ny += dy / d; }
          else { const up = ent.y - o.y0 < o.y1 - ent.y; ent.y = up ? o.y0 - r : o.y1 + r; ny += up ? -1 : 1; }
        } else if (o.r) {
          const dx = ent.x - o.x, dy = ent.y - o.y, d2 = dx * dx + dy * dy, rr = r + o.r;
          if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2), ux = d > 1e-3 ? dx / d : 1, uy = d > 1e-3 ? dy / d : 0;
          ent.x += ux * (rr - d); ent.y += uy * (rr - d); nx += ux; ny += uy;
        }
      }
    }
    return nx || ny ? { x: nx, y: ny } : null;
  }
  function pillarAt(x, y) {                           // 그 점이 기둥 안이면 그 기둥
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    for (const o of chunkInfo(cx, cy).solid) if (!o.gone && o.kind === 'pillar' && x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) return o;
    return null;
  }

  // ── 능력치: 직업 기본 × (축복 + 장비 + 판 안 패시브)
  const STAT0 = () => ({ dmg: 0, hp: 0, speed: 0, atkspd: 0, crit: 0, critdmg: 0, cdr: 0, lifesteal: 0, armor: 0, xp: 0, gold: 0, pickup: 0, area: 0, skill: 0, ultc: 0, regen: 0, reroll: 0, revive: 0, pierce: 0 });
  function blessStats() {
    const s = STAT0(), P = SAVE.P;
    for (const k in P.bless) { const b = D.BLESS[k]; if (b) s[b.stat] += b.v * P.bless[k]; }
    return s;
  }
  // 그 직업이 낀 장비(칸 순서 = D.SLOTS) — 10-22 판 안에서도 이 장비를 그대로 끼고 시작(해머워치2처럼 하나의 장비)
  function equippedItems(clsKey) {
    const P = SAVE.P, eq = P.equip[clsKey] || {};
    return Object.keys(D.SLOTS).map(s => P.stash.find(i => i.id === eq[s]) || null);
  }
  // 능력치 출처별(10-22 사용자 «전체 능력치 + 레벨업 스킬·장비로 오른 몫은 () 안에»): 축복 · 장비 · 레벨업(패시브 카드)
  function statParts(worn, pass) {
    const gear = STAT0(), card = STAT0();
    for (const it of worn) if (it) for (const a of it.aff) gear[a.k] = (gear[a.k] || 0) + a.v * D.affixScale(it.ilvl, it.up);
    for (const k in pass || {}) card[D.PASSIVES[k].stat] += pass[k].v;
    return { bless: blessStats(), gear, card };
  }
  function profileStats(clsKey) {                    // 마을 표시용: 축복 + 낀 장비
    const s = blessStats(), uniq = new Set();
    for (const it of equippedItems(clsKey)) {
      if (!it) continue;
      for (const a of it.aff) s[a.k] = (s[a.k] || 0) + a.v * D.affixScale(it.ilvl, it.up);
      if (it.uniq) uniq.add(it.uniq);
    }
    return { s, uniq };
  }
  function recalc() {
    const st = Object.assign(STAT0(), G.base);
    for (const k in G.pass) st[D.PASSIVES[k].stat] += G.pass[k].v;
    for (const it of G.worn) if (it) for (const a of it.aff) st[a.k] = (st[a.k] || 0) + a.v * D.affixScale(it.ilvl, it.up);
    st.cdr = Math.min(0.6, st.cdr); st.armor = Math.min(0.7, st.armor); st.crit = Math.min(0.75, st.crit);
    G.st = st;
    G.uniq = new Set(G.baseUniq);
    for (const it of G.worn) if (it && it.uniq) G.uniq.add(it.uniq);
    const p = G.p, old = p.maxHp;
    p.maxHp = Math.round(G.C.hp * (1 + st.hp));
    if (old) p.hp = Math.min(p.maxHp, p.hp + Math.max(0, p.maxHp - old));
  }
  const dmgMul = () => (1 + G.st.dmg) * (G.buff.fury > 0 ? 1.5 : 1);
  const swiftMul = () => (G.buff.swift > 0 ? 1.35 : 1);
  const cdMul = () => (1 - G.st.cdr);

  // ── 새 판
  function start(clsKey, dunKey) {
    const C = D.CLASSES[clsKey], dun = D.DUNGEONS.find(d => d.key === dunKey) || D.DUNGEONS[0];
    const bs = blessStats();
    G = {
      t: 0, seed: Math.floor(Math.random() * 100000), cls: clsKey, C, dun, H: A.heroes[clsKey] || A.heroes.swordsman,
      p: { x: 0, y: 0, vx: 0, vy: 1, hp: C.hp, maxHp: 0, dir: 'down', walkT: 0, moving: false, hurtT: 0, r: 6,
           atk: null, combo: 0, lastAtk: -9, dash: null, inv: 0, hop: 0, shotCd: 0 },
      // base = 축복만 · worn = 지금 낀 장비(마을에서 낀 것으로 시작 · 판 안에서 바꾸면 끝날 때 그대로 남음)
      base: bs, baseUniq: new Set(), worn: equippedItems(clsKey), st: null, uniq: new Set(),
      lv: 1, xp: 0, kills: 0, gold: 0, ultCd: D.ULT_FIRST, ultMax: 1, cds: [0, 0], cdMax: [1, 1], dodgeCd: 0, dodgeMax: 1, rerolls: Math.round(bs.reroll), revived: false,
      skLv: { basic: 1, s0: 1, s1: 1, ult: 1 }, skBonus: { basic: 0, s0: 0, s1: 0, ult: 0 },
      abil: [], evo: {}, pass: {}, basicHits: 0,
      enemies: [], eproj: [], pproj: [], tele: [], sched: [], gems: [], coins: [], drops: [], ghosts: [], fx: [], nums: [], parts: [],
      bag: [], spawnT: 0.5, eliteT: 60, waves: {}, midDone: false, bossDone: false, boss: null, cleared: false, buff: { fury: 0, swift: 0 },
      ammo: D.GUN.mag, reloadT: 0, barrage: null, blizzard: null,
      levelQueue: 0, paused: false, over: false, god: false, uid: 1, hitStop: 0, shake: 0, potsBroken: new Set(),
      run: { elites: 0, chests: 0, legends: 0, evos: 0, dodges: 0, ultKillsMax: 0, goblins: 0, secrets: 0, pots: 0, kills: {}, bosses: {} },
    };
    recalc();
    G.p.hp = G.p.maxHp;
    G.ultMax = Math.max(ultCdOf(), G.ultCd);
    chunks.clear(); infos.clear(); dest = null;
    hooks.hud && hooks.hud(G);
  }

  // ── 적 그리드(가까운 적 찾기)
  let grid = new Map();
  const GC = 32;
  function rebuildGrid() {
    grid = new Map();
    for (const e of G.enemies) {
      const k = Math.floor(e.x / GC) * 100003 + Math.floor(e.y / GC);
      let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(e);
    }
  }
  function near(x, y, r, fn) {
    const x0 = Math.floor((x - r) / GC), x1 = Math.floor((x + r) / GC), y0 = Math.floor((y - r) / GC), y1 = Math.floor((y + r) / GC);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const a = grid.get(gx * 100003 + gy);
      if (a) for (const e of a) if (e.hp > 0) fn(e);
    }
  }
  const sheetOf = name => A.mons[name] || null;
  function mobArts(k) { const m = D.MONSTERS[k]; return m ? m.art.filter(a => A.mons[a]) : []; }

  // ── 적 만들기
  function makeEnemy(k, x, y, opt) {
    const m = D.MONSTERS[k], arts = mobArts(k);
    if (!m || !arts.length) return null;
    const vi = Math.min(arts.length - 1, Math.floor(Math.random() * (1 + G.t / 150)));
    const sh = sheetOf(opt && opt.art && arts.includes(opt.art) ? opt.art : arts[vi]), sc = D.enemyScale(G.dun.tier, G.t);
    const e = { id: G.uid++, k, m, sh, x, y, hp: m.hp * sc.hp, dmg: m.dmg * sc.dmg, speed: m.speed * rand(0.9, 1.1) * (1 + 0.025 * Math.min(12, G.t / 60)), xp: m.xp,
                r: Math.max(5, Math.min(sh.wh[0], sh.wh[1]) * 0.36), row: 0, animT: Math.random() * 2, flash: 0, kx: 0, ky: 0,
                st: 'move', at: 0, cd: rand(0.6, 1.6), scale: 1, slow: 0, freeze: 0, z: 0, elite: null };
    if (opt && opt.elite) {
      const af = opt.elite === true ? pick(Object.keys(D.AFFIX)) : opt.elite, a = D.AFFIX[af];
      e.elite = af; e.hp *= D.ELITE.hp * (a.hp || 1); e.dmg *= D.ELITE.dmg; e.speed *= D.ELITE.speed * (a.speed || 1);
      e.scale = sh.wh[1] < 32 ? 2 : 1; e.r *= e.scale; e.xp *= D.ELITE.xp;      // 도트가 고르게: 정수 배율만(큰 몸은 그대로 + 금빛 테두리)
    }
    e.maxHp = e.hp;
    G.enemies.push(e);
    return e;
  }
  function spawnRing(R) {                             // 화면 테두리 바로 밖 한 점(움직이는 쪽에 조금 더) — 가로 화면이라 위아래는 가깝게
    const p = G.p, a = p.moving && Math.random() < 0.55 ? Math.atan2(p.vy, p.vx) + rand(-1.1, 1.1) : rand(0, Math.PI * 2);   // 앞쪽 쏠림을 조금 줄이고 폭을 넓힘(10-22)
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    const rr = R || Math.min((VW / 2 + 12) / Math.max(c, 1e-3), (VH / 2 + 30) / Math.max(s, 1e-3)) + rand(8, 28);
    return { x: p.x + Math.cos(a) * rr, y: p.y + Math.sin(a) * rr };
  }
  function mobPool() {
    return G.dun.mobs.filter(([k, from]) => G.t >= from && mobArts(k).length);
  }
  function spawnPack() {
    // 10-22 사용자 «리스폰 때 너무 뭉쳐 나옴 → 고르게»: 무리(4~8)를 한 점(±24)에 몰지 않고 3~4마리씩 화면 둘레 여러 자리로 나눔
    //   (한 마리씩 사방에 흩으면 포위돼 봇이 훨씬 자주 죽었음 — 검사·궁수 지하 묘지 정복률 ↓)
    const pool = mobPool();
    if (!pool.length) return;
    let left = irand(D.PACK[0], D.PACK[1]);
    while (left > 0) {
      const g = Math.min(left, irand(3, 4)), [k] = wpick(pool, x => x[2]), c = spawnRing();
      for (let i = 0; i < g; i++) {
        const e = { x: c.x + rand(-14, 14), y: c.y + rand(-14, 14) };
        if (!solve(e, 8)) makeEnemy(k, e.x, e.y);
      }
      left -= g;
    }
  }
  function spawnElite(where) {
    const pool = mobPool();
    if (!pool.length) return null;
    const [k] = wpick(pool, x => x[2] * (D.MONSTERS[x[0]].hp > 20 ? 2 : 1));
    const c = where || spawnRing();
    const e = makeEnemy(k, c.x, c.y, { elite: true });
    if (e) sfx('warn');
    return e;
  }

  // ── 피해
  // kind = 'atk'(평타 · 흰) · 'skill'(주황 · 크게) · 'ult'(노랑 · 아주 크게) · 'abil'(하늘색 · 작게)
  function hurtEnemy(e, dmg, kx, ky, kind) {
    if (e.hp <= 0) return false;
    const st = G.st, crit = Math.random() < D.CRIT.chance + st.crit;
    let n = dmg * rand(0.9, 1.1) * (crit ? D.CRIT.mul + st.critdmg : 1);
    if (kind === 'skill' || kind === 'ult') n *= 1 + st.skill;
    n = Math.max(1, Math.round(n));
    const real = Math.min(n, e.hp);                   // 흡혈은 실제로 깎은 만큼만(넘친 피해 빼고)
    e.hp -= n; e.flash = 0.1;
    if (!e.boss) { e.kx += kx || 0; e.ky += ky || 0; }
    if (e.goblin && Math.random() < 0.35) G.coins.push({ x: e.x + rand(-6, 6), y: e.y + rand(-4, 4), v: 1 + Math.floor(G.dun.tier), pull: false });   // 맞을 때마다 금화를 흘림
    if (st.lifesteal && (kind === 'atk' || kind === 'skill')) leech(real * st.lifesteal);
    if (crit && G.uniq.has('vampcrit')) leech(real * 0.05);
    if (crit && G.uniq.has('thunderhit') && Math.random() < 0.35 && kind !== 'abil') zapAt(e, dmgBase() * 1.5);
    if (G.nums.length < 48 && (G.numsNow || 0) < 10) {   // 피해 숫자: 떠 있는 건 48개 · 한 걸음에 새로 10개까지(한꺼번에 수십 개는 폰에서 무거움)
      G.numsNow = (G.numsNow || 0) + 1;
      const big = kind === 'ult' ? 2 : (kind === 'skill' || crit ? 1 : 0);
      G.nums.push({ x: e.x + rand(-3, 3), y: e.y - e.sh.wh[1] * 0.8 * e.scale, n: crit ? n + '!' : n, t: 0, big,
                    c: kind === 'ult' ? '#ffe45a' : crit ? '#fff07a' : kind === 'skill' ? '#ffa04a' : kind === 'abil' ? '#9ae0ff' : '#ffffff' });
    }
    if ((G.sparksNow || 0) < 12) {                     // 불꽃도 한 걸음에 12개까지(필살 한 번에 90개씩 쌓였음)
      G.sparksNow = (G.sparksNow || 0) + 1;
      G.fx.push({ k: 'spark', x: e.x + rand(-3, 3), y: e.y - e.sh.wh[1] * 0.45 * e.scale + rand(-3, 3), t: 0, dur: 0.16 });
    }
    sfx(crit ? 'crit' : 'hit');
    if (e.hp <= 0) killEnemy(e, kind);
    return true;
  }
  function killEnemy(e, kind) {
    G.kills++;
    G.run.kills[e.k] = (G.run.kills[e.k] || 0) + 1;
    if (kind === 'ult') G.ultKillsNow = (G.ultKillsNow || 0) + 1;
    if (G.ghosts.length < 32 || e.boss || e.elite) G.ghosts.push({ sh: e.sh, x: e.x, y: e.y, row: e.row, t: 0, scale: e.scale });   // 사라지는 잔상은 32개까지
    sfx('kill');
    if (e.goblin) return goblinLoot(e);
    if (e.boss) return bossDeath(e);
    G.gems.push({ x: e.x + rand(-3, 3), y: e.y + rand(-3, 3), v: e.xp, pull: false });
    const gr = D.GOLD_DROP * (G.uniq.has('goldrush') ? 2 : 1);
    if (Math.random() < gr) G.coins.push({ x: e.x + rand(-4, 4), y: e.y + rand(-4, 4), v: irand(1, 2 + Math.floor(G.dun.tier)), pull: false });
    if (Math.random() < D.HEAL_DROP) G.drops.push({ k: 'potion', x: e.x, y: e.y, t: 0 });
    if (Math.random() < D.ITEM_DROP.mob) dropItem(e.x, e.y, 0);
    if (e.elite) {
      G.run.elites++;
      G.drops.push({ k: 'chest', n: 1, x: e.x, y: e.y, t: 0 });
      for (let i = 0, n = irand(D.ELITE.gold[0], D.ELITE.gold[1]) / 4; i < n; i++) G.coins.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), v: 4, pull: false });
      if (Math.random() < D.ITEM_DROP.elite) dropItem(e.x, e.y, 1);
      if (e.elite === 'volatile') {                    // 폭발하는 정예: 죽은 자리 0.8초 뒤 터짐
        teleCircle(e.x, e.y, 34, 0.8, () => { hitPlayerCircle(e.x, e.y, 34, e.dmg * 1.2); G.fx.push({ k: 'boom', x: e.x, y: e.y, r: 34, t: 0, dur: 0.4 }); sfx('slam'); });
      }
    }
  }
  function heal(v, quiet) {
    const p = G.p;
    if (v <= 0 || p.hp >= p.maxHp) return;
    p.hp = Math.min(p.maxHp, p.hp + v);
    if (!quiet) G.nums.push({ x: p.x, y: p.y - 42, n: '+' + Math.round(v), t: 0, c: '#8dffb4' });
  }
  // 흡혈 통(10-22 사용자 «가만히 있어도 안 죽음» — 재 보니 무리 속 광역기 흡혈이 초당 10 넘게 채워 줌):
  //   초당 최대 체력의 LEECH_CAP 만큼만 차는 통에서 꺼내 씀 → 적이 많을수록 더 사는 일은 없음
  function leech(v) {
    const g = Math.min(v, G.leechBank);
    if (g > 0) { G.leechBank -= g; heal(g, true); }
  }
  function hurtPlayer(dmg, src) {
    const p = G.p;
    if (G.god || p.inv > 0 || G.over || G.cleared) return false;
    const n = Math.max(1, Math.round(dmg * (1 - G.st.armor)));
    p.hp -= n; p.hurtT = 0.25; p.inv = D.HURT_INV;
    G.run.hits = (G.run.hits || 0) + 1; G.run.taken = (G.run.taken || 0) + n;
    G.nums.push({ x: p.x, y: p.y - 42, n, t: 0, c: '#ff6a5a' });
    G.shake = Math.max(G.shake, 0.1);
    sfx('hurt');
    if (p.hp <= 0) {
      if (!G.revived && (G.st.revive > 0 || G.uniq.has('phoenix'))) {        // 두 번째 목숨 · 불사조 깃털
        G.revived = true; p.hp = Math.round(p.maxHp * 0.5); p.inv = 2;
        G.fx.push({ k: 'sparkle', x: p.x, y: p.y - 18, t: 0, dur: 1, c: '#ffd36a' });
        slashArc(0, 70, 360, dmgBase() * 4, 200, 'ult');
        hooks.toast && hooks.toast('다시 일어섰다!');
        return true;
      }
      p.hp = 0; G.over = true; sfx('lose');
      hooks.over && hooks.over(G);
    }
    return true;
  }
  // 플레이어가 그 모양 안에 있으면 피해(회피 무적이면 안 맞음)
  //   바닥 예고는 위아래로 납작(SQ)하게 그리므로 맞는 판정도 같은 납작한 원 — 보이는 그대로 맞고, 보이는 밖은 안 맞음
  //   sq = 1 이면 납작하지 않음(일반 몬스터 휘두르기처럼 몸 둘레 공격)
  const SQ = 0.6;
  const sqAng = (ang, sq) => Math.atan2(Math.sin(ang) / sq, Math.cos(ang));     // 세상 방향 → 납작한 원 위 각도
  function hitPlayerCircle(x, y, r, dmg) { const p = G.p; if (Math.hypot(p.x - x, (p.y - y) / SQ) < r + p.r) return hurtPlayer(dmg); return false; }
  function hitPlayerSector(x, y, r, ang, arc, dmg, sq) {
    sq = sq || SQ;
    const p = G.p, dx = p.x - x, dy = (p.y - y) / sq, d = Math.hypot(dx, dy);
    if (d > r + p.r) return false;
    if (d > p.r && Math.abs(angDiff(Math.atan2(dy, dx), sqAng(ang, sq))) > arc * Math.PI / 360 + Math.atan2(p.r, d)) return false;
    return hurtPlayer(dmg);
  }

  // ── 바닥 예고(빨간 모양 · dur 뒤 fn) · 예약 실행
  function tele(o, fn) { o.t = 0; G.tele.push(o); if (fn) after(o.dur, fn); return o; }
  const teleCircle = (x, y, r, dur, fn) => tele({ k: 'circle', x, y, r, dur }, fn);
  function after(dt, fn) { G.sched.push({ at: G.t + dt, fn }); }

  // ── 주인공: 일반 공격(3연타 · 활) · 스킬 · 필살기 · 회피
  const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) * 0.9 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  const dirVec = d => ({ down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[d]);
  const rowOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
  // 시트 줄: 방향 없음 = 0 · 옆모습만(네 발 짐승) = 왼·오른 · 그 밖 = 아래·왼·오른·위
  const rowFor = (sh, dx, dy) => sh.dirs === 1 ? 0 : sh.side ? (dx < 0 ? 1 : 2) : rowOf(dx, dy);
  function nearestEnemy(maxR) {
    let best = null, bd = Infinity;
    const p = G.p;
    near(p.x, p.y, maxR + 16, e => {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < maxR && d < bd && !e.hidden) { bd = d; best = e; }
    });
    return best;
  }
  function slashArc(ang, range, arc, dmg, kb, kind) {
    const p = G.p, half = arc * Math.PI / 360;
    let n = 0;
    near(p.x, p.y, range + 30, e => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d - e.r > range) return;
      if (half < Math.PI && Math.abs(angDiff(Math.atan2(dy, dx), ang)) > half + Math.atan2(e.r, Math.max(d, 1))) return;
      const ux = d > 0.1 ? dx / d : Math.cos(ang), uy = d > 0.1 ? dy / d : Math.sin(ang);
      if (hurtEnemy(e, dmg, ux * kb, uy * kb, kind || 'atk')) n++;
    });
    breakPots(p.x, p.y, range, ang, arc);
    if (n) {
      // 화면 전체 멈춤(타격 정지)은 일반 공격만 — 스킬·필살은 흔들림·번쩍임으로(10-22 «스킬 쓰면 끊김»: 멈춤이 겹쳐 0.06~0.16초씩 섰음)
      if (!kind || kind === 'atk') G.hitStop = Math.max(G.hitStop, D.HIT_STOP);
      else G.shake = Math.max(G.shake, 0.12);
    }
    return n;
  }
  function breakPots(x, y, range, ang, arc) {         // 베기·폭발 범위 안 항아리를 깸(부채꼴이면 그 방향만)
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) for (const o of chunkInfo(gx, gy).solid) {
      if (o.kind !== 'pot' || o.gone) continue;
      const qy = o.y - 5, d = Math.hypot(o.x - x, qy - y);
      if (d > range + 6) continue;
      if (arc < 360 && d > 6 && Math.abs(angDiff(Math.atan2(qy - y, o.x - x), ang)) > arc * Math.PI / 360 + 0.4) continue;
      smashPot(o);
    }
  }
  function smashPot(o) {                              // 항아리 깨짐: 조각이 튀고 · 하나만 나옴(숨은 상자 → 자석 → 회복약 → 금화 → 빈 것)
    if (o.gone) return;
    o.gone = true; G.potsBroken.add(o.id); G.run.pots++;
    const pal = D.POT_ART.pals[G.dun.key] || D.POT_ART.pals.crypt;
    burst(o.x, o.y - 4, 10, [pal[3], pal[4], pal[2], pal[1]], { spd: [25, 75], up: [30, 80], life: [0.35, 0.65], size: 2 });
    G.fx.push({ k: 'shards', x: o.x, y: o.y, t: 0, dur: 2.2, c: pal.slice(1, 5), seed: Math.abs(o.x * 7 + o.y * 13) % 97 });
    sfx('pot');
    const T = D.POT, u = Math.random();
    if (u < T.chest) {
      G.run.secrets++;
      G.drops.push({ k: 'chest', n: 1, x: o.x, y: o.y, t: 0, secret: true });
      hooks.toast && hooks.toast('항아리 속에 숨은 상자!');
    } else if (u < T.chest + T.magnet) G.drops.push({ k: 'magnet', x: o.x, y: o.y, t: 0 });
    else if (u < T.chest + T.magnet + T.heal) G.drops.push({ k: 'potion', x: o.x, y: o.y, t: 0 });
    else if (u < T.chest + T.magnet + T.heal + T.gold) {
      for (let i = 0, n = 1 + (Math.random() < 0.5 ? 1 : 0); i < n; i++) G.coins.push({ x: o.x + rand(-6, 6), y: o.y + rand(-4, 3), v: 1 + Math.floor(G.dun.tier), pull: false });
    }
  }
  function playAct(act, fd, hit, onHit, ang) {
    // 하던 동작의 타격이 아직이면 먼저 터뜨림 — 10-23 사용자 «움직이며 검사 필살 → 안 나감»: 자동 대지 가르기가 같은 동작(B)으로 필살 동작을 덮어
    //   필살 타격(3번째 칸)이 영영 안 나왔음(재사용 대기만 돎) · 이제 무엇이 덮어도 타격은 사라지지 않음
    const old = G.p.atk;
    if (old && !old.done) { old.done = true; old.onHit && old.onHit(old); }
    const fds = (Array.isArray(fd) ? fd : [fd, fd, fd, fd, fd, fd]);
    const n = G.H.acts[act] ? G.H.acts[act].len[0] : fds.length;
    G.p.atk = { act, fds: fds.slice(0, n), hit: Math.min(hit, n - 1), onHit, ang, t: 0, fi: 0, done: false, total: fds.slice(0, n).reduce((a, b) => a + b, 0) };
  }
  function dmgBase() { return G.C.dmg * dmgMul(); }
  const magSize = () => D.GUN.mag + (basicLvl(4) ? 6 : 0) + (G.uniq.has('bigmag') ? 10 : 0);   // 권총 탄창(큰 탄창 전설 +10)
  function basicLvl(i) { return G.skLv.basic >= i; }
  function startBasic(tg) {
    const p = G.p, dx = tg.x - p.x, dy = tg.y - p.y, ang = Math.atan2(dy, dx);
    p.dir = dirOf(dx, dy);
    const bonus = 1 + (basicLvl(2) ? 0.2 : 0) + G.skBonus.basic, spd = (1 + G.st.atkspd) * (basicLvl(3) ? 1.15 : 1) * swiftMul();
    if (G.C.attack === 'bow') {
      const b = D.BOW;
      playAct(b.act, b.fd.map(f => f / spd), b.hit, a => {
        const n = 1 + (basicLvl(4) ? 1 : 0) + (G.uniq.has('splitshot') ? 2 : 0), pierce = b.pierce + (basicLvl(5) ? 2 : 0);   // 갈래 화살(전설) +2
        for (let i = 0; i < n; i++) shootArrow(a.ang + (i - (n - 1) / 2) * 0.12, dmgBase() * bonus, pierce, 'atk');
        sfx('shot'); onBasicHit(a.ang);
      }, ang);
      return;
    }
    if (G.C.attack === 'gun') {                       // 권총: 한 발씩 빠르게 · 탄창이 비면 장전(그동안 못 쏨)
      const g = D.GUN;
      playAct(g.act, g.fd.map(f => f / spd), g.hit, a => {
        shootBullet(a.ang + rand(-0.05, 0.05), dmgBase() * bonus, g.pierce + (basicLvl(5) ? 1 : 0) + (G.uniq.has('pierceround') ? 2 : 0), 'atk');   // 관통탄(전설) +2
        if (--G.ammo <= 0) { G.reloadT = g.reload / (1 + G.st.atkspd * 0.5) * (G.uniq.has('bigmag') ? 0.6 : 1); sfx('reload'); }
        sfx('gun'); onBasicHit(a.ang);
      }, ang);
      return;
    }
    if (G.C.attack === 'magic') {                     // 마법탄: 적을 쫓아가 닿으면 작게 터짐
      const m = D.MAGIC;
      playAct(m.act, m.fd.map(f => f / spd), m.hit, a => {
        const n = (basicLvl(5) ? 2 : 1) + (G.uniq.has('twinbolt') ? 1 : 0);   // 쌍둥이 마법탄(전설) +1
        for (let i = 0; i < n; i++) shootMissile(a.ang + (i - (n - 1) / 2) * 0.5, dmgBase() * bonus, m.aoe * (basicLvl(4) ? 1.3 : 1) * (1 + G.st.area), tg, 'atk');
        sfx('zap'); onBasicHit(a.ang);
      }, ang);
      return;
    }
    if (G.t - p.lastAtk > D.COMBO_RESET) p.combo = 0;
    const c = D.COMBO[p.combo], last = p.combo === D.COMBO.length - 1;
    const range = c.range * (1 + G.st.area) * (basicLvl(4) ? 1.2 : 1);
    playAct(c.act, c.fd.map(f => f / spd), c.hit, a => {
      sfx('swing');
      slashArc(a.ang, range, c.arc, dmgBase() * c.mul * bonus, c.kb, 'atk');
      if (last && basicLvl(5)) {                      // 마지막 타격 충격파
        const fx = p.x + Math.cos(a.ang) * 30, fy = p.y + Math.sin(a.ang) * 30;
        G.fx.push({ k: 'boom', x: fx, y: fy - 6, r: 30, t: 0, dur: 0.3, c: '#bfe8ff' });
        near(fx, fy, 40, e => { if (Math.hypot(e.x - fx, e.y - fy) < 30 + e.r) hurtEnemy(e, dmgBase() * 1.2 * bonus, 0, 0, 'atk'); });
      }
      if (last && G.uniq.has('whirlblade')) {         // 회오리 칼날(전설): 마지막 타격이 둘레로 충격파
        const r = 52 * (1 + G.st.area);
        slashArc(0, r, 360, dmgBase() * 0.9 * bonus, 80, 'abil');
        shockAt(p.x, p.y, r, '#bfefff', 0.35);
      }
      onBasicHit(a.ang);
    }, ang);
    p.combo = (p.combo + 1) % D.COMBO.length;
  }
  // 화살·총알은 관통 패시브(10-22 · 궁수·권총수)만큼 더 꿰뚫음
  function shootArrow(ang, dmg, pierce, kind, o) {
    const p = G.p;
    G.pproj.push(Object.assign({ k: 'arrow', x: p.x + Math.cos(ang) * 6, y: p.y - 12 + Math.sin(ang) * 6, vx: Math.cos(ang) * D.BOW.speed, vy: Math.sin(ang) * D.BOW.speed,
                                 life: D.BOW.life, dmg, pierce: pierce + Math.round(G.st.pierce), kind, hit: new Set(), r: 4 }, o || {}));
  }
  function shootBullet(ang, dmg, pierce, kind, o) {
    const p = G.p, g = D.GUN;
    G.pproj.push(Object.assign({ k: 'bullet', x: p.x + Math.cos(ang) * 8, y: p.y - 13 + Math.sin(ang) * 8, vx: Math.cos(ang) * g.speed, vy: Math.sin(ang) * g.speed,
                                 life: g.life, dmg, pierce: pierce + Math.round(G.st.pierce), kind, hit: new Set(), r: 3 }, o || {}));
  }
  function shootMissile(ang, dmg, aoe, target, kind) {
    const p = G.p, m = D.MAGIC;
    G.pproj.push({ k: 'missile', x: p.x + Math.cos(ang) * 6, y: p.y - 16 + Math.sin(ang) * 6, vx: Math.cos(ang) * m.speed, vy: Math.sin(ang) * m.speed,
                   life: m.life, dmg, pierce: 0, kind, hit: new Set(), r: 4, aoe, home: target });
  }
  function blastAt(x, y, r, dmg, kind, c) {           // 둥근 폭발(마법탄·수류탄·메테오)
    G.fx.push({ k: 'boom', x, y: y - 3, r, t: 0, dur: 0.32, c: c || '#c89aff' });
    if (kind === 'skill' || kind === 'ult') {         // 스킬 폭발은 충격파 + 불꽃·파편 + 연기
      shockAt(x, y, r * 1.25, c || '#ffd0a0');
      burst(x, y, Math.min(22, 8 + Math.round(r / 3)), [c || '#ffb070', '#ffe6a0', '#ffffff'], { spd: [r * 0.8, r * 2.2], up: [20, 80], life: [0.3, 0.65] });
      burst(x, y, 5, ['#6a6070', '#8a8296'], { spd: [8, 24], up: [12, 26], g: -6, life: [0.5, 0.9], size: 2 });
    }
    near(x, y, r + 20, e => { if (Math.hypot(e.x - x, (e.y - y) / SQ) < r + e.r) hurtEnemy(e, dmg, (e.x - x) * 0.8, (e.y - y) * 0.8, kind); });
    breakPots(x, y, r * 0.8, 0, 360);
  }
  // 스킬 이펙트(10-22 사용자 «스킬 이펙트가 너무 없음»): 입자 터짐 · 충격파 고리 · 화면 번쩍임
  //   burst = 바닥 (x, y) 에서 n 개를 사방으로(속도 spd · 위로 up · 중력 g · 수명 life) — 260 개를 넘으면 더 안 만듦(폰)
  function burst(x, y, n, cols, o) {
    o = o || {};
    const [s0, s1] = o.spd || [30, 90], [u0, u1] = o.up || [10, 50], [l0, l1] = o.life || [0.3, 0.6];
    for (let i = 0; i < n && G.parts.length < 260; i++) {
      const a = rand(0, Math.PI * 2), s = rand(s0, s1);
      G.parts.push({ x, y, z: o.z || 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s * SQ, vz: rand(u0, u1), g: o.g === undefined ? 140 : o.g,
                     t: 0, life: rand(l0, l1), c: cols[i % cols.length], s: o.size || (i % 3 ? 1 : 2) });
    }
  }
  function shockAt(x, y, r, c, dur) { G.fx.push({ k: 'shock', x, y, r, c, t: 0, dur: dur || 0.4 }); }
  function flashScreen(c, a, dur) { G.fx.push({ k: 'flash', c, a, t: 0, dur: dur || 0.25 }); }
  function onBasicHit(ang) {                           // 검기(자동 능력)는 일반 공격에 붙어 나감
    G.basicHits++;
    const w = G.abil.find(a => a.k === 'wave');
    if (!w) return;
    const AB = D.ABILITIES.wave;
    if (G.evo.heaven) {
      for (const da of [-0.32, 0, 0.32]) fireWave(ang + da, dmgBase() * 2.4, 1.6, true);
    } else if (G.basicHits % AB.every[w.lv] === 0) fireWave(ang, dmgBase() * AB.mul[w.lv] * (1 + w.bonus), AB.size[w.lv], false);
  }
  function fireWave(ang, dmg, size, evo) {
    const p = G.p;
    G.pproj.push({ k: 'wave', x: p.x, y: p.y - 10, vx: Math.cos(ang) * 230, vy: Math.sin(ang) * 230, ang, life: 0.55, dmg, pierce: 999,
                   kind: 'abil', hit: new Set(), r: 9 * size * (1 + G.st.area), size, evo });
  }
  function facingAng() {
    const p = G.p;
    if (p.moving) return Math.atan2(p.vy, p.vx);
    const [x, y] = dirVec(p.dir);
    return Math.atan2(y, x);
  }
  const busy = () => !G || G.over || G.paused || G.cleared;
  const AUTO_R = { dash: 110, rift: 110, volley: 150, grenade: 150, meteor: 170, spin: 60 };   // 자동 스킬: 이 거리 안에 적이 있으면(회피 자리 몸 옮기기는 손으로만)
  // 대지 가르기 모양(10-22 사용자 «가르기 이펙트 밋밋 · 다른 거나 더 화려하게») — data 의 rift.look 으로 고름
  //   A 빛 기둥(금을 따라 푸른 빛줄기가 차례로 솟음) · B 바위 폭발(큰 바위 + 돌 조각 + 붉은 금) · C 빛의 검(빛으로 된 검이 금을 따라 위에서 꽂힘)
  //   c1·c2·cw = 바닥 금의 빛·속·굵기 · slam = 내려찍는 자리 · pop = 금을 따라 하나씩
  const RIFT_LOOK = {
    A: { c1: '#7fdcff', c2: '#ffffff', cw: 2,
         slam(x, y) { shockAt(x, y, 34, '#9ae6ff', 0.3); burst(x, y, 10, ['#ffffff', '#9ae6ff', '#5ac8ff'], { spd: [30, 90], up: [20, 60], life: [0.25, 0.5] }); },
         pop(x, y, big, rr) {
           G.fx.push({ k: 'pillar', x, y, s: big ? 1.5 : rand(0.85, 1.1), t: 0, dur: big ? 0.6 : 0.45 });
           burst(x, y, big ? 10 : 5, ['#ffffff', '#bfefff', '#5ac8ff'], { spd: [6, 24], up: [50, 110], g: 40, life: [0.4, 0.8] });   // 솟아 흩날리는 빛가루
           if (big) shockAt(x, y, rr * 1.5, '#9ae6ff', 0.4);
         } },
    B: { c1: '#ff8a3a', c2: '#ffe6a0', cw: 3,
         slam(x, y) { shockAt(x, y, 34, '#ffb070', 0.3); burst(x, y, 12, ['#a89878', '#6a5c4c', '#ffb070'], { spd: [40, 100], up: [30, 80], g: 260, life: [0.35, 0.6], size: 2 }); },
         pop(x, y, big, rr) {
           const s = big ? 2 : rand(1.15, 1.5);
           G.fx.push({ k: 'rock', x, y, s, t: 0, dur: 0.6, glow: '#ff9a4a' });
           G.fx.push({ k: 'rock', x: x - 7 * s, y: y + 2, s: s * 0.55, t: 0, dur: 0.55, glow: '#ff9a4a' });
           G.fx.push({ k: 'rock', x: x + 6 * s, y: y + 1, s: s * 0.45, t: 0, dur: 0.5, glow: '#ff9a4a' });
           burst(x, y, big ? 14 : 7, ['#8a7a66', '#6a5c4c', '#d8c8a8', '#ff9a4a'], { spd: [30, 90], up: [60, 130], g: 300, life: [0.4, 0.7], size: 2 });   // 튀는 돌 조각
           burst(x, y, 3, ['#8a8296', '#6a6070'], { spd: [8, 20], up: [8, 20], g: -6, life: [0.5, 0.9], size: 2 });                                   // 흙먼지
           if (big) { shockAt(x, y, rr * 1.6, '#ffb070', 0.4); G.shake = Math.max(G.shake, 0.12); }
         } },
    C: { c1: '#bfe8ff', c2: '#ffffff', cw: 1,
         slam(x, y) { shockAt(x, y, 30, '#bfefff', 0.3); burst(x, y, 8, ['#ffffff', '#bfefff'], { spd: [30, 80], up: [20, 50], life: [0.25, 0.45] }); },
         pop(x, y, big, rr) {
           G.fx.push({ k: 'lsword', x, y, s: big ? 1.6 : rand(0.9, 1.1), t: 0, dur: big ? 0.7 : 0.55 });
           after(0.06, () => {                        // 검이 바닥에 닿는 순간
             burst(x, y, big ? 12 : 6, ['#ffffff', '#bfefff', '#7fd8ff'], { spd: [30, 80], up: [20, 60], life: [0.25, 0.45] });
             shockAt(x, y, big ? rr * 1.5 : rr * 0.9, '#bfefff', 0.3);
           });
         } },
  };
  function skillDef(i) { return D.SKILLS[G.C.skills[i]]; }
  function skillCd(i) { const sk = skillDef(i), lv = G.skLv['s' + i]; return sk.cd * (lv >= 4 ? 0.8 : 1) * cdMul(); }
  function useSkill(i, auto) {                        // auto = 자동 발동(돌진은 움직이는 쪽이 아니라 가까운 적 쪽으로)
    const p = G && G.p;
    if (busy() || !G.C.skills[i] || G.cds[i] > 0 || p.dash) return false;   // 스킬이 하나뿐인 직업(검사)은 두 번째 칸이 없음
    const sk = skillDef(i), lv = G.skLv['s' + i], key = G.C.skills[i];
    const mul = sk.mul * (lv >= 2 ? 1.3 : 1) * (1 + G.skBonus['s' + i]);
    G.cdMax[i] = G.cds[i] = skillCd(i);
    if (G.uniq.has('twinspin')) G.ultCd = Math.max(0, G.ultCd - 2);       // 질풍(전설)
    const tg = nearestEnemy(170);
    let ang = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : facingAng();
    sfx('skill');
    if (key === 'spin') {                             // (지금은 쓰는 직업 없음 · 10-22 검사에서 뺌)
      const r = sk.r * (lv >= 3 ? 1.2 : 1) * (1 + G.st.area), twice = lv >= 5;
      playAct(sk.act, sk.fd, 2, () => slashArc(0, r, 360, dmgBase() * mul, sk.kb, 'skill'), ang);
      G.fx.push({ k: 'ring', x: p.x, y: p.y - 8, r, t: 0, dur: 0.32 });
      if (twice) after(0.28, () => { slashArc(0, r, 360, dmgBase() * mul * 0.8, sk.kb, 'skill'); G.fx.push({ k: 'ring', x: G.p.x, y: G.p.y - 8, r, t: 0, dur: 0.32 }); sfx('swing'); });
    } else if (key === 'dash') {
      if (p.moving && !(auto && tg)) ang = Math.atan2(p.vy, p.vx);
      p.dir = dirOf(Math.cos(ang), Math.sin(ang));
      const dist = sk.dist * (lv >= 3 ? 1.25 : 1);
      // 끝 폭발은 1단계부터(10-22 회전 베기를 빼며 검사의 무리 처리 몫) · 5단계는 범위 +40%
      p.dash = { t: 0, dur: sk.dur, ux: Math.cos(ang), uy: Math.sin(ang), spd: dist / sk.dur, hit: new Set(), sk, mul, boom: true, boomR: (lv >= 5 ? 62 : 44) * (1 + G.st.area), x0: p.x, y0: p.y };
      p.inv = Math.max(p.inv, sk.dur + 0.1);
      playAct(sk.act, sk.fd, 99, null, ang);
      burst(p.x, p.y, 8, ['#e8fbff', '#9ae6ff'], { spd: [20, 60], up: [6, 20], life: [0.2, 0.4] });
      sfx('dash');
    } else if (key === 'rift') {                      // 검사 자동(10-22 «자동 스킬이 전부 돌진» → 제자리 기술): 내려찍으면 적이 몰린 쪽으로 땅이 갈라지며 바위가 차례로 솟음
      const len = sk.len * (lv >= 3 ? 1.25 : 1), r = sk.r * (1 + G.st.area), lines = lv >= 5 ? 3 : 1, n = Math.round(len / 20);
      const t2 = densest(len) || tg, a0 = t2 ? Math.atan2(t2.y - p.y, t2.x - p.x) : ang;
      p.dir = dirOf(Math.cos(a0), Math.sin(a0));
      const look = RIFT_LOOK[sk.look] || RIFT_LOOK.A;
      playAct(sk.act, sk.fd, 3, () => {
        const q = G.p, x0 = q.x, y0 = q.y, hit = new Set();
        let hits = 0, healed = 0;
        const fx0 = x0 + Math.cos(a0) * 12, fy0 = y0 + Math.sin(a0) * 12;   // 칼끝이 땅에 닿는 자리
        look.slam(fx0, fy0);
        G.shake = Math.max(G.shake, 0.1); sfx('slam');
        for (let l = 0; l < lines; l++) {
          const aa = a0 + (l - (lines - 1) / 2) * 0.45, ca = Math.cos(aa), sa = Math.sin(aa);
          G.fx.push({ k: 'crack', x: x0, y: y0, ca, sa, len, open: n * 0.04, t: 0, dur: n * 0.04 + 0.6, c1: look.c1, c2: look.c2, w: look.cw,
                      jit: Array.from({ length: Math.ceil(len / 7) + 2 }, () => rand(-2.5, 2.5)) });
          for (let i = 1; i <= n; i++) after(i * 0.04, () => {
            const d = 8 + (len - 8) * i / n, x = x0 + ca * d, y = y0 + sa * d, big = i === n, rr = r * (big ? 1.4 : 1);
            look.pop(x, y, big, rr);
            near(x, y, rr + 24, e => {
              if (hit.has(e.id) || Math.hypot(e.x - x, (e.y - y) / SQ) > rr + e.r) return;
              hit.add(e.id);
              const dx = e.x - x, dy = e.y - y, dl = Math.hypot(dx, dy) || 1;
              if (hurtEnemy(e, dmgBase() * mul, dx / dl * sk.kb, dy / dl * sk.kb, 'skill')) hits++;
              // 솟은 바위에 걸려 비틀 — 하던 공격 예고가 끊김(보스 빼고) · 봇(10-22): 몸이 안 움직이는 대신 이걸로 버팀(돌진의 무적·빠져나감 몫)
              if (sk.stagger && !e.boss && e.hp > 0 && e.st === 'wind') { e.st = 'rec'; e.stT = 0; e.at = sk.stagger; }
            });
            if (G.uniq.has('bloodedge') && Math.min(5, hits) > healed) { heal(G.p.maxHp * 0.02 * (Math.min(5, hits) - healed), true); healed = Math.min(5, hits); }   // 피의 칼날(전설)
            breakPots(x, y, rr * 0.8, 0, 360);
          });
        }
      }, a0);
    } else if (key === 'volley') {
      const n = sk.n + (lv >= 3 ? 3 : 0), pierce = 1 + (lv >= 5 ? 2 : 0);
      playAct(sk.act, sk.fd, 1, a => {
        for (let k = 0; k < n; k++) shootArrow(a.ang + (k - (n - 1) / 2) * (sk.spread * Math.PI / 180) / (n - 1), dmgBase() * mul, pierce, 'skill');
        const q = G.p;                                // 시위를 놓는 자리 불꽃 + 부채꼴 바람
        burst(q.x + Math.cos(a.ang) * 8, q.y + Math.sin(a.ang) * 6, 10, ['#ffe6a0', '#ffffff', '#9ae6ff'], { spd: [40, 100], up: [10, 30], life: [0.2, 0.4], z: 10 });
        G.fx.push({ k: 'bigslash', x: q.x, y: q.y - 10, r: 34, ang: sqAng(a.ang, SQ), arc: sk.spread + 20, t: 0, dur: 0.22 });
        sfx('shot');
      }, ang);
    } else if (key === 'thrust') {                    // 검사(10-22 회피 자리 · 사용자 «찌르기로»): 움직이는 쪽(서 있으면 가까운 적 쪽)으로 찌르며 내달림 · 무적 · 지나간 적을 꿰뚫음
      const a2 = p.moving ? Math.atan2(p.vy, p.vx) : ang;
      p.dir = dirOf(Math.cos(a2), Math.sin(a2));
      const dist = sk.dist * (lv >= 3 ? 1.25 : 1);
      p.dash = { t: 0, dur: sk.dur, ux: Math.cos(a2), uy: Math.sin(a2), spd: dist / sk.dur, hit: new Set(), sk, mul, boom: lv >= 5, boomR: 40 * (1 + G.st.area), x0: p.x, y0: p.y };
      p.inv = Math.max(p.inv, sk.dur + 0.15);
      playAct(sk.act, sk.fd, 99, null, a2);
      burst(p.x, p.y, 6, ['#e8fbff', '#9ae6ff'], { spd: [20, 50], up: [6, 16], life: [0.2, 0.35] });
      sfx('dash');
    } else if (key === 'leap') {                      // 궁수(회피 자리): 움직이는 쪽(서 있으면 적 반대쪽)으로 뛰며 가까운 적에게 쏨
      const back = p.moving ? Math.atan2(p.vy, p.vx) : ang + Math.PI, dist = sk.dist;
      p.dash = { t: 0, dur: sk.dur, ux: Math.cos(back), uy: Math.sin(back), spd: dist / sk.dur, dodge: true, back: !p.moving };
      p.inv = Math.max(p.inv, sk.dur + 0.15);
      const n = sk.n + (lv >= 3 ? 3 : 0), x0 = p.x, y0 = p.y;
      playAct(sk.act, sk.fd, 1, a => { for (let k = 0; k < n; k++) shootArrow(ang + (k - (n - 1) / 2) * 0.16, dmgBase() * mul, 2, 'skill'); sfx('shot'); }, ang);
      if (lv >= 5) teleCircle(x0, y0, 40, 0.35, () => { G.fx.push({ k: 'boom', x: x0, y: y0 - 6, r: 40, t: 0, dur: 0.35 }); near(x0, y0, 50, e => { if (Math.hypot(e.x - x0, e.y - y0) < 40 + e.r) hurtEnemy(e, dmgBase() * mul * 1.5, 0, 0, 'skill'); }); sfx('slam'); });
    } else if (key === 'roll') {                      // 권총수: 구르고(무적) 끝에서 사방으로 난사
      let ux, uy;
      if (p.moving) { ux = p.vx; uy = p.vy; } else { ux = -Math.cos(ang); uy = -Math.sin(ang); }
      const l = Math.hypot(ux, uy) || 1, n = sk.n + (lv >= 3 ? 5 : 0), x0 = p.x, y0 = p.y;
      p.dash = { t: 0, dur: sk.dur, ux: ux / l, uy: uy / l, spd: sk.dist / sk.dur, dodge: true, back: false,
                 onEnd: () => { for (let k = 0; k < n; k++) shootBullet(k * Math.PI * 2 / n + rand(0, 0.3), dmgBase() * mul, 1, 'skill'); sfx('gun'); } };
      p.dir = dirOf(ux, uy);
      p.inv = Math.max(p.inv, sk.dur + 0.15);
      if (lv >= 5) after(0.3, () => { blastAt(x0, y0, 44 * (1 + G.st.area), dmgBase() * mul * 2.5, 'skill', '#ffb070'); sfx('slam'); });
      sfx('dash');
    } else if (key === 'grenade') {                   // 권총수: 가장 가까운 적 쪽으로 던짐 → 잠깐 뒤 폭발
      const n = lv >= 5 ? 3 : 1, r = sk.r * (lv >= 3 ? 1.2 : 1) * (1 + G.st.area);
      const tx0 = tg ? tg.x : p.x + Math.cos(ang) * 80, ty0 = tg ? tg.y : p.y + Math.sin(ang) * 80;
      const d0 = Math.min(sk.range, Math.hypot(tx0 - p.x, ty0 - p.y)), a0 = Math.atan2(ty0 - p.y, tx0 - p.x);
      playAct(sk.act, sk.fd, 1, () => {
        for (let k = 0; k < n; k++) {
          const aa = a0 + (k - (n - 1) / 2) * 0.45, tx = G.p.x + Math.cos(aa) * d0, ty = G.p.y + Math.sin(aa) * d0;
          G.fx.push({ k: 'lob', x: G.p.x, y: G.p.y - 14, x2: tx, y2: ty, t: 0, dur: sk.fuse });
          after(sk.fuse, () => { blastAt(tx, ty, r, dmgBase() * mul, 'skill', '#ffb070'); G.shake = Math.max(G.shake, 0.2); sfx('slam'); });
        }
      }, ang);
    } else if (key === 'meteor') {                    // 마법사: 가장 많이 모인 곳에 표시 → 불덩이가 떨어짐
      const r = sk.r * (lv >= 3 ? 1.2 : 1) * (1 + G.st.area);
      const t2 = densest(sk.range) || (tg ? { x: tg.x, y: tg.y } : { x: p.x + Math.cos(ang) * 70, y: p.y + Math.sin(ang) * 70 });
      playAct(sk.act, sk.fd, 1, () => {
        G.fx.push({ k: 'mark', x: t2.x, y: t2.y, r, t: 0, dur: sk.delay });
        G.fx.push({ k: 'meteor', x: t2.x, y: t2.y, t: 0, dur: sk.delay });
        after(sk.delay, () => {
          blastAt(t2.x, t2.y, r, dmgBase() * mul, 'skill', '#ff8a3a');
          G.shake = Math.max(G.shake, 0.3); sfx('slam');
          if (lv >= 5) {                              // 불바다: 3초 동안 지글지글
            G.fx.push({ k: 'fire', x: t2.x, y: t2.y, r: r * 0.8, t: 0, dur: 3 });
            for (let tt = 0.3; tt < 3; tt += 0.3) after(tt, () => near(t2.x, t2.y, r, e => { if (Math.hypot(e.x - t2.x, (e.y - t2.y) / SQ) < r * 0.8 + e.r) hurtEnemy(e, dmgBase() * mul * 0.08, 0, 0, 'skill'); }));
          }
        });
      }, ang);
    } else if (key === 'blink') {                     // 마법사: 움직이는 쪽(서 있으면 적 반대쪽)으로 순간 이동 · 떠난 자리에 서리
      const jump = () => {
        const q = G.p;
        let ux, uy;
        if (q.moving) { ux = q.vx; uy = q.vy; } else { const t3 = nearestEnemy(120); if (t3) { ux = q.x - t3.x; uy = q.y - t3.y; } else [ux, uy] = dirVec(q.dir); }
        const l = Math.hypot(ux, uy) || 1, x0 = q.x, y0 = q.y;
        let dd = sk.dist * (lv >= 3 ? 1.3 : 1);
        while (dd > 10 && pillarAt(q.x + ux / l * dd, q.y + uy / l * dd)) dd -= 10;
        G.fx.push({ k: 'sparkle', x: x0, y: y0 - 14, t: 0, dur: 0.5, c: '#c89aff' });
        q.x += ux / l * dd; q.y += uy / l * dd; solve(q, 5);
        G.fx.push({ k: 'sparkle', x: q.x, y: q.y - 14, t: 0, dur: 0.5, c: '#c89aff' });
        q.inv = Math.max(q.inv, 0.35);
        novaAt(x0, y0, sk.r * (1 + G.st.area), dmgBase() * mul, 1.5, 0, 'skill');
        sfx('dash');
      };
      playAct(sk.act, sk.fd, 0, null, ang);
      jump();
      if (lv >= 5) after(0.35, jump);
    }
    hooks.hud && hooks.hud(G);
    return true;
  }
  function densest(range) {                           // 사거리 안에서 둘레(40) 적이 가장 많은 적 자리
    const p = G.p;
    let best = null, bn = 0;
    near(p.x, p.y, range, e => {
      if (Math.hypot(e.x - p.x, e.y - p.y) > range) return;
      let n = 0;
      near(e.x, e.y, 40, o => { if (Math.hypot(o.x - e.x, o.y - e.y) < 40) n++; });
      if (n > bn) { bn = n; best = { x: e.x, y: e.y }; }
    });
    return best;
  }
  function ultCdOf() { return D.ULTS[G.C.ult].cd * (G.skLv.ult >= 4 ? 0.8 : 1) * cdMul() / (1 + G.st.ultc); }
  function useUlt() {
    const p = G && G.p;
    if (busy() || G.ultCd > 0) return false;
    if (p.dash) { G.ultQ = 0.6; return true; }      // 찌르기·구르기 중이면 끝나자마자 나감(update)
    const u = D.ULTS[G.C.ult], lv = G.skLv.ult, mul = u.mul * (lv >= 2 ? 1.35 : 1) * (1 + G.skBonus.ult), r = u.r * (lv >= 3 ? 1.2 : 1) * (1 + G.st.area);
    G.ultMax = G.ultCd = ultCdOf(); G.ultKillsNow = 0;
    p.inv = Math.max(p.inv, 0.7);
    sfx('ult');
    const finish = () => after(0.6, () => { G.run.ultKillsMax = Math.max(G.run.ultKillsMax, G.ultKillsNow || 0); });
    if (G.C.ult === 'storm') {
      const blast = k => {
        slashArc(0, r, 360, dmgBase() * mul * (k ? 0.6 : 1), u.kb, 'ult'); G.fx.push({ k: 'storm', x: G.p.x, y: G.p.y - 8, r, t: 0, dur: 0.55 }); G.shake = 0.35;
        flashScreen('#e8fbff', 0.35); shockAt(G.p.x, G.p.y, r * 1.1, '#9ae6ff', 0.5); shockAt(G.p.x, G.p.y, r * 0.6, '#ffffff', 0.35);
        burst(G.p.x, G.p.y, 30, ['#ffffff', '#9ae6ff', '#bfe8ff', '#ffe6a0'], { spd: [r * 0.8, r * 2], up: [30, 90], life: [0.35, 0.7] });
      };
      playAct(u.act, u.fd, 3, () => { blast(0); if (lv >= 5) { after(0.35, () => blast(1)); after(0.7, () => blast(2)); } finish(); }, facingAng());
    } else if (G.C.ult === 'barrage') {               // 총알 폭풍: 몇 초 동안 둘레 적을 노려 마구 쏨(움직일 수 있음) — 진행은 update 의 G.barrage
      const dur = u.dur + (lv >= 3 ? 1 : 0);
      G.barrage = { t: dur, acc: 0, n: 0, wave: 0.5, ang: facingAng(), two: lv >= 5, dmg: dmgBase() * mul, r };
      playAct(u.act, u.fd, 0, null, facingAng());
      flashScreen('#ffe6a0', 0.25); shockAt(p.x, p.y, 70, '#ffb070');
      burst(p.x, p.y, 16, ['#fff2b0', '#ffb04a', '#ff7a2a'], { spd: [60, 140], up: [10, 40], life: [0.25, 0.45] });
      after(dur, finish);
    } else if (G.C.ult === 'blizzard') {              // 눈보라: 둘레에 몇 초 동안 얼음 폭풍(느려짐 · 5단계는 얼림)
      G.blizzard = { t: u.dur, tick: 0, r, dmg: dmgBase() * mul, freeze: lv >= 5 };
      playAct(u.act, u.fd, 1, null, facingAng());
      G.shake = 0.2;
      flashScreen('#cfefff', 0.35); shockAt(p.x, p.y, r, '#bfefff', 0.5);
      burst(p.x, p.y, 26, ['#ffffff', '#bfefff', '#8fd8ff'], { spd: [r * 0.6, r * 1.6], up: [20, 60], g: 40, life: [0.5, 0.9] });
      after(u.dur, finish);
    } else {                                          // 화살비: 가장 많이 모인 곳(없으면 앞)에 쏟아짐
      const spots = [];
      const tg = nearestEnemy(220);
      spots.push(tg ? { x: tg.x, y: tg.y } : { x: p.x + Math.cos(facingAng()) * 60, y: p.y + Math.sin(facingAng()) * 60 });
      if (lv >= 5) { const t2 = G.enemies[Math.floor(Math.random() * G.enemies.length)]; if (t2) spots.push({ x: t2.x, y: t2.y }); }
      playAct(u.act, u.fd, 1, () => {
        for (const s of spots) {
          G.fx.push({ k: 'rain', x: s.x, y: s.y, r, t: 0, dur: u.dur });
          shockAt(s.x, s.y, r, '#ffe6a0', 0.45);
          for (let tt = 0; tt < u.dur; tt += u.tick) after(tt, () => {
            near(s.x, s.y, r + 10, e => { if (Math.hypot(e.x - s.x, e.y - s.y) < r + e.r && Math.random() < 0.55) hurtEnemy(e, dmgBase() * mul, 0, 0, 'ult'); });
            const a = rand(0, Math.PI * 2), rr = rand(0, r);   // 꽂히는 자리 흙·불꽃
            burst(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr * SQ, 3, ['#ffe6a0', '#c8a070', '#ffffff'], { spd: [15, 45], up: [15, 35], life: [0.2, 0.35] });
          });
        }
        flashScreen('#fff2c8', 0.2);
        G.shake = 0.25; finish();
      }, facingAng());
    }
    hooks.toast && hooks.toast(u.name + '!');
    hooks.hud && hooks.hud(G);
    return true;
  }
  function useMove() {                                // 회피 버튼 = 그 직업의 몸 옮기기 스킬(10-22) · 없으면 예전 회피
    if (!G) return false;
    const i = G.C.manual ? G.C.skills.indexOf(G.C.manual) : -1;
    if (i < 0) return dodge();
    const ok = useSkill(i);
    if (ok) {
      G.run.dodges++;
      if (G.uniq.has('frostdodge')) novaAt(G.p.x, G.p.y, 60, dmgBase() * 1.2, 1.2, false);   // 서리 걸음(전설)
    }
    return ok;
  }
  function dodge() {
    const p = G && G.p, dg = D.DODGE;
    if (busy() || G.dodgeCd > 0 || p.dash) return false;
    G.dodgeMax = G.dodgeCd = dg.cd * cdMul();
    let ux, uy, back = false;
    if (p.moving) { ux = p.vx; uy = p.vy; } else { const [fx, fy] = dirVec(p.dir); ux = -fx; uy = -fy; back = true; }
    const l = Math.hypot(ux, uy) || 1;
    p.atk = null;
    p.dash = { t: 0, dur: dg.dur, ux: ux / l, uy: uy / l, spd: dg.dist / dg.dur, dodge: true, back };
    if (!back) p.dir = dirOf(ux, uy);
    p.inv = Math.max(p.inv, dg.inv);
    G.run.dodges++;
    G.fx.push({ k: 'dust', x: p.x, y: p.y, t: 0, dur: 0.3 });
    if (G.uniq.has('frostdodge')) novaAt(p.x, p.y, 60, dmgBase() * 1.2, 1.2, false);
    sfx('dodge');
    hooks.hud && hooks.hud(G);
    return true;
  }

  // ── 자동 능력(검기는 일반 공격에 붙음)
  function zapAt(e, dmg) {
    G.fx.push({ k: 'bolt', x: e.x, y: e.y - 6, t: 0, dur: 0.26 });
    burst(e.x, e.y, 6, ['#ffffff', '#fff6a0', '#7fb8ff'], { spd: [40, 100], up: [20, 60], life: [0.2, 0.4] });   // 맞은 자리 불꽃(10-22 화려하게)
    hurtEnemy(e, dmg, 0, 0, 'abil');
    sfx('zap');
  }
  function novaAt(x, y, r, dmg, slow, freeze, kind) {
    G.fx.push({ k: 'nova', x, y: y - 6, r, t: 0, dur: 0.45 });
    burst(x, y, 12, ['#ffffff', '#bfefff', '#5ac8ff'], { spd: [r * 0.8, r * 1.8], up: [10, 40], life: [0.3, 0.55] });   // 흩날리는 눈가루
    sfx('frost');
    near(x, y, r + 16, e => {
      if (Math.hypot(e.x - x, e.y - y) > r + e.r) return;
      hurtEnemy(e, dmg, 0, 0, kind || 'abil');
      e.slow = Math.max(e.slow, slow * 2);
      if (freeze && !e.boss) e.freeze = Math.max(e.freeze, freeze);
    });
  }
  function updAbilities(dt) {
    const p = G.p;
    for (const a of G.abil) {
      const AB = D.ABILITIES[a.k];
      if (a.k === 'orbit') {
        const evo = G.evo.barrier, n = evo ? 7 : AB.n[a.lv], r = (evo ? 46 : AB.r) * (1 + G.st.area * 0.5), spin = evo ? 4.5 : AB.spin[a.lv];
        a.ang = (a.ang || 0) + spin * dt;
        a.blades = []; a.rr = r;
        for (let i = 0; i < n; i++) {
          const an = a.ang + i * Math.PI * 2 / n, bx = p.x + Math.cos(an) * r, by = p.y - 10 + Math.sin(an) * r * 0.8;
          a.blades.push({ x: bx, y: by, an });
          near(bx, by + 10, 14, e => {
            if (Math.hypot(e.x - bx, e.y - e.sh.wh[1] * 0.4 - by) > 8 + e.r) return;
            a.hit = a.hit || new Map();
            const last = a.hit.get(e.id) || -9;
            if (G.t - last < 0.4) return;
            a.hit.set(e.id, G.t);
            hurtEnemy(e, dmgBase() * (evo ? 1.6 : AB.mul[a.lv]) * (1 + a.bonus), Math.cos(an) * 60, Math.sin(an) * 60, 'abil');
            burst(bx, by + 10, 3, evo ? ['#fff2c0', '#ffcf5a'] : ['#ffffff', '#ffb060'], { spd: [30, 70], up: [10, 30], life: [0.15, 0.3], z: 10 });   // 맞힐 때 불꽃
          });
          if (evo) for (const b of G.eproj) if (!b.dead && Math.hypot(b.x - bx, b.y - by) < 9) { b.dead = true; G.fx.push({ k: 'spark', x: b.x, y: b.y, t: 0, dur: 0.15 }); }
        }
      } else if (a.k === 'bolt') {
        const evo = G.evo.thunder;
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          a.t = (evo ? 1.2 : AB.cd[a.lv]) * cdMul();
          const vis = G.enemies.filter(e => !e.hidden && Math.abs(e.x - p.x) < VW / 2 && Math.abs(e.y - p.y) < VH / 2);
          vis.sort((x, y) => dist2(x, p) - dist2(y, p));
          // 10-23 사용자 «낮춰»: 뇌신 4.5배·튐 0.6 일 땐 다른 진화의 2~3배(측정 8,400) → 2.3배·튐 0.45
          const n = evo ? 4 : AB.n[a.lv], dmg = dmgBase() * (evo ? 2.3 : AB.mul[a.lv]) * (1 + a.bonus);
          for (const e of vis.slice(0, n)) {
            zapAt(e, dmg);
            if (evo) {                                 // 뇌신: 3번 튐
              let from = e;
              for (let j = 0; j < 3; j++) {
                let nx = null, bd = 60 * 60;
                near(from.x, from.y, 60, o => { if (o !== from && o.hp > 0) { const d = dist2(o, from); if (d < bd) { bd = d; nx = o; } } });
                if (!nx) break;
                G.fx.push({ k: 'chain', x: from.x, y: from.y - 6, x2: nx.x, y2: nx.y - 6, t: 0, dur: 0.18 });
                hurtEnemy(nx, dmg * 0.45, 0, 0, 'abil'); from = nx;
              }
            }
          }
        }
      } else if (a.k === 'knives') {
        const evo = G.evo.tempest;
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          a.t = (evo ? 0.5 : AB.cd[a.lv]) * cdMul();
          const knife = (an, dmg, pierce) => G.pproj.push({ k: 'knife', x: p.x, y: p.y - 12, vx: Math.cos(an) * 250, vy: Math.sin(an) * 250, ang: an, life: 0.7, dmg, pierce,
                                                            kind: 'abil', hit: new Set(), r: 4 });
          if (evo) for (let i = 0; i < 8; i++) knife(i * Math.PI / 4 + G.t * 2, dmgBase() * 1.6 * (1 + a.bonus), 3);
          else {
            const tg = nearestEnemy(170), base = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : facingAng(), n = AB.n[a.lv];
            for (let i = 0; i < n; i++) knife(base + (i - (n - 1) / 2) * 0.2, dmgBase() * AB.mul[a.lv] * (1 + a.bonus), a.lv >= 5 ? 2 : 0);
          }
          sfx('shot');
        }
      } else if (a.k === 'nova') {
        const evo = G.evo.glacier;
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          a.t = (evo ? 2 : AB.cd[a.lv]) * cdMul();
          const r = (evo ? 120 : AB.r[a.lv]) * (1 + G.st.area);
          novaAt(p.x, p.y, r, dmgBase() * (evo ? 2.6 : AB.mul[a.lv]) * (1 + a.bonus), 1.5, evo ? 1.2 : (a.lv >= 5 ? 0.7 : 0));
          if (evo) for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4; G.pproj.push({ k: 'shard', x: p.x, y: p.y - 10, vx: Math.cos(an) * 160, vy: Math.sin(an) * 160, life: 0.6, dmg: dmgBase() * 1.5, pierce: 3, kind: 'abil', hit: new Set(), r: 5 }); }
        }
      } else if (a.k === 'axe') {                     // 회전 도끼: 가까운 적 쪽으로 던짐 → reach 만큼 나갔다 주인공에게 돌아옴(탄 처리에서 움직임) · 진화 = 넷이 사방으로
        const evo = G.evo.axestorm;
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          a.t = (evo ? 1.2 : AB.cd[a.lv]) * cdMul();
          // 10-23 측정: 둘 이상일 때 0.5 간격으로 벌어져 가운데 적을 둘 다 비껴갔음(3단계 피해 ≈ 0) → 0.22 간격 · 적 몸통 높이를 겨눔
          const tg = nearestEnemy(170), base = tg ? Math.atan2(tg.y - tg.sh.wh[1] * 0.45 * tg.scale - (p.y - 12), tg.x - p.x) : facingAng();
          const n = evo ? 4 : AB.n[a.lv], reach = (evo ? 150 : AB.reach[a.lv]) * (1 + G.st.area * 0.5), size = evo ? 1.6 : AB.size[a.lv];
          for (let i = 0; i < n; i++) {
            const an = evo ? base + i * Math.PI / 2 : base + (i - (n - 1) / 2) * 0.22;
            G.pproj.push({ k: 'axe', axe: true, x: p.x, y: p.y - 12, vx: 0, vy: 0, ang: an, life: 9, out: reach, d: 0, back: false, spin: rand(0, 6), size,
                           dmg: dmgBase() * (evo ? 3 : AB.mul[a.lv]) * (1 + a.bonus), pierce: 1e9, kind: 'abil', hit: new Set(), r: 6 * size });
          }
          sfx('axe');
        }
      } else if (a.k === 'flame') {                   // 불기둥: 화면 안 적 발밑에서 바로 솟음 · 5단계 = 불바닥 · 진화 = 다섯 · 크게 · 불바닥 오래
        const evo = G.evo.volcano;
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          a.t = (evo ? 1.5 : AB.cd[a.lv]) * cdMul();
          const vis = G.enemies.filter(e => !e.hidden && Math.abs(e.x - p.x) < VW / 2 - 10 && Math.abs(e.y - p.y) < VH / 2 - 10);
          // 10-23 사용자 «낮춰»: 화산 4.5배·불바닥 2.5초일 땐 다른 진화의 3~4배(측정 12,900) → 1.5배·불바닥 2초
          const n = evo ? 5 : AB.n[a.lv], r = AB.r * (1 + G.st.area) * (evo ? 1.3 : 1), dmg = dmgBase() * (evo ? 1.5 : AB.mul[a.lv]) * (1 + a.bonus);
          for (let i = 0; i < n && vis.length; i++) {
            const e = vis.splice(Math.floor(Math.random() * vis.length), 1)[0];
            flameAt(e.x, e.y, r, dmg, evo ? 2 : (a.lv >= 5 ? 1 : 0));
          }
        }
      } else if (a.k === 'miasma') {                  // 독 안개: 선 자리에 독 구름(dur 초 · 0.5초마다 독) · 진화 = 몸을 따라다니는 큰 구름(0.4초마다)
        a.t = (a.t || 0) - dt;
        if (G.evo.plague) {
          const r = 70 * (1 + G.st.area);
          if (!a.cloud) { a.cloud = { k: 'miasma', x: p.x, y: p.y, r, t: 0, dur: 1e9, seed: 3 }; G.fx.push(a.cloud); }
          a.cloud.x = p.x; a.cloud.y = p.y; a.cloud.r = r;
          if (a.t <= 0) { a.t = 0.4; poisonTick(p.x, p.y, r, dmgBase() * AB.mul[5] * 2 * (1 + a.bonus), true); }
        } else if (a.t <= 0) {
          a.t = AB.cd[a.lv] * cdMul();
          const r = AB.r[a.lv] * (1 + G.st.area), dur = AB.dur[a.lv], dmg = dmgBase() * AB.mul[a.lv] * (1 + a.bonus), x = p.x, y = p.y, slow = a.lv >= 5;
          G.fx.push({ k: 'miasma', x, y, r, t: 0, dur, seed: rand(0, 10) });
          for (let tt = 0.25; tt < dur; tt += 0.5) after(tt, () => poisonTick(x, y, r, dmg, slow));
          sfx('poison');
        }
      } else if (a.k === 'tornado') {                 // 회오리: 가까운 적 쪽으로 천천히 굽이치며 나가 둘레를 빨아들이고 0.25초마다 벰(탄 처리) · 진화 = 셋이 몸 둘레를 돎
        const evo = G.evo.eye;
        if (evo) {
          a.tw = (a.tw || []).filter(b => b.life > 0);
          while (a.tw.length < 3) {
            const b = { k: 'tornado', tw: true, orbit: a.tw.length * Math.PI * 2 / 3, x: p.x, y: p.y - 10, vx: 0, vy: 0, life: 1e9, dur: 1e9, r: 26 * (1 + G.st.area),
                        dmg: dmgBase() * 1.2 * (1 + a.bonus), pierce: 1e9, kind: 'abil', hit: new Set(), tick: 0 };
            a.tw.push(b); G.pproj.push(b);
          }
          for (const b of a.tw) b.dmg = dmgBase() * 1.2 * (1 + a.bonus);
        } else {
          a.t = (a.t || 0) - dt;
          if (a.t <= 0) {
            a.t = AB.cd[a.lv] * cdMul();
            const tg = nearestEnemy(170), base = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : facingAng(), n = AB.n[a.lv];
            for (let i = 0; i < n; i++) {
              const an = base + (i - (n - 1) / 2) * 0.7;
              G.pproj.push({ k: 'tornado', tw: true, x: p.x, y: p.y - 10, vx: Math.cos(an) * 55, vy: Math.sin(an) * 55, ang: an, wob: rand(0, 6), life: AB.dur[a.lv], dur: AB.dur[a.lv],
                             r: AB.r[a.lv] * (1 + G.st.area), dmg: dmgBase() * AB.mul[a.lv] * (1 + a.bonus), pierce: 1e9, kind: 'abil', hit: new Set(), tick: 0 });
            }
            sfx('whirl');
          }
        }
      } else if (a.k === 'hawk') {                    // 추적 화살(궁수 전용 · 10-23): 화면 안 가까운 적마다 겨눠 꺾여 날아감 · 진화(별빛 사냥) = 1초마다 여섯 · 맞으면 작게 터짐
        const evo = G.evo.starhunt;
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          a.t = (evo ? 1.2 : AB.cd[a.lv]) * cdMul();   // 10-23 측정: 1초·여섯·1.6배였을 땐 칼날 폭풍의 5배 → 낮춤
          const vis = visEnemies(), n = evo ? 5 : AB.n[a.lv], dmg = dmgBase() * (evo ? 1.3 : AB.mul[a.lv]) * (1 + a.bonus);
          for (let i = 0; i < n && vis.length; i++) {
            const tg = vis[i % vis.length], an = Math.atan2(tg.y - p.y, tg.x - p.x) + (i - (n - 1) / 2) * 0.35;
            shootArrow(an, dmg, evo || a.lv >= 5 ? 1 : 0, 'abil', { home: tg, turn: 7, life: 1.1, hawk: true, star: !!evo });
          }
          if (vis.length) sfx('shot');
        }
      } else if (a.k === 'turret') {                  // 포탑(권총수 전용 · 10-23): 발밑에 세우면 몇 초 동안 가까운 적을 쏨 · 진화(포탑 요새) = 셋이 늘 둘레를 따라다니며 관통탄
        const evo = G.evo.fortress;
        a.tur = a.tur || [];
        if (evo) {
          while (a.tur.length < 3) a.tur.push({ x: p.x, y: p.y, t: 1e9, fire: 0.3, ang: 0, slot: a.tur.length });
          for (const tu of a.tur) { const an = tu.slot * Math.PI * 2 / 3 + G.t * 0.6; tu.x = p.x + Math.cos(an) * 30; tu.y = p.y + Math.sin(an) * 24; tu.t = 1e9; }
        } else {
          a.t = (a.t || 0) - dt;
          if (a.t <= 0) {
            a.t = AB.cd[a.lv] * cdMul();
            for (let i = 0; i < AB.n[a.lv]; i++) a.tur.push({ x: p.x + (i ? 16 : -12), y: p.y + 4, t: AB.dur[a.lv], fire: 0.25, ang: facingAng(), born: G.t });
            sfx('skill');
          }
        }
        const rate = evo ? 0.35 : AB.rate[a.lv], dmg = dmgBase() * (evo ? 0.8 : AB.mul[a.lv]) * (1 + a.bonus);   // 10-23 측정: 0.25초·1.0배였을 땐 칼날 폭풍의 3.4배 → 낮춤
        for (const tu of a.tur) {
          tu.t -= dt; tu.fire -= dt;
          if (tu.fire > 0) continue;
          let tg = null, bd = 170 * 170;
          near(tu.x, tu.y, 170, e => { if (e.hidden || e.hp <= 0) return; const d = (e.x - tu.x) ** 2 + (e.y - tu.y) ** 2; if (d < bd) { bd = d; tg = e; } });
          if (!tg) continue;
          tu.fire = rate; tu.ang = Math.atan2(tg.y - tu.y, tg.x - tu.x); tu.kick = 0.08;
          shootBullet(tu.ang, dmg, evo ? 2 : 0, 'abil', { x: tu.x + Math.cos(tu.ang) * 8, y: tu.y - 9 + Math.sin(tu.ang) * 8 });
        }
        a.tur = a.tur.filter(tu => tu.t > 0);
      } else if (a.k === 'orbs') {                    // 비전 구슬(마법사 전용 · 10-23): 둘레를 돌다 적에게 날아가 터짐(잠깐 뒤 다시 생김) · 진화(은하) = 여섯이 넓게 돌며 0.5초마다 하나씩
        const evo = G.evo.galaxy, n = evo ? 6 : AB.n[a.lv], r = (evo ? 44 : 30) * (1 + G.st.area * 0.5);
        a.ang = (a.ang || 0) + (evo ? 2.4 : 3) * dt;
        a.cool = Math.max(0, (a.cool || 0) - dt);
        a.balls = [];
        for (let i = 0; i < n; i++) { const an = a.ang + i * Math.PI * 2 / n; a.balls.push({ x: p.x + Math.cos(an) * r, y: p.y - 10 + Math.sin(an) * r * 0.8, an }); }
        a.t = (a.t || 0) - dt;
        if (a.t <= 0) {
          const vis = visEnemies();
          if (vis.length) {
            a.t = (evo ? 0.6 : AB.cd[a.lv]) * cdMul();   // 10-23 측정: 0.5초·3.5배였을 땐 칼날 폭풍의 2배 → 낮춤
            const shots = evo ? 1 : n, dmg = dmgBase() * (evo ? 3.0 : AB.mul[a.lv]) * (1 + a.bonus), aoe = (evo ? 46 : AB.aoe[a.lv]) * (1 + G.st.area);
            for (let i = 0; i < shots; i++) {
              const b0 = a.balls[evo ? (a.next = ((a.next || 0) + 1) % n) : i], tg = vis[i % vis.length], an = Math.atan2(tg.y - b0.y, tg.x - b0.x);
              G.pproj.push({ k: 'missile', orb: true, gal: !!evo, x: b0.x, y: b0.y, vx: Math.cos(an) * 200, vy: Math.sin(an) * 200, life: 1.2, dmg, pierce: 0,
                             kind: 'abil', hit: new Set(), r: 5, aoe, home: tg, turn: 6, c: evo ? '#b8a0ff' : '#7ab8ff' });
            }
            if (!evo) a.cool = 0.7;                   // 날아간 구슬은 잠깐 비었다 다시 차오름(그림)
            sfx('skill');
          }
        }
      }
    }
  }
  function visEnemies() {                             // 화면 안 적(가까운 것부터)
    const p = G.p, vis = G.enemies.filter(e => !e.hidden && e.hp > 0 && Math.abs(e.x - p.x) < VW / 2 && Math.abs(e.y - p.y) < VH / 2);
    return vis.sort((x, y) => dist2(x, p) - dist2(y, p));
  }
  function flameAt(x, y, r, dmg, burn) {              // 불기둥: 솟는 불길 + 불똥 · burn 초 동안 그 자리 불바닥(0.3초마다 작은 피해)
    G.fx.push({ k: 'flame', x, y, r, t: 0, dur: 0.6 });
    burst(x, y, 10, ['#ffe06a', '#ff8a2a', '#ff5a1a', '#ffffff'], { spd: [15, 50], up: [60, 140], g: 60, life: [0.3, 0.7] });
    near(x, y, r + 20, e => { if (Math.hypot(e.x - x, (e.y - y) / SQ) < r + e.r) hurtEnemy(e, dmg, 0, 0, 'abil'); });
    sfx('fire');
    if (burn) {
      G.fx.push({ k: 'fire', x, y, r: r * 0.9, t: 0, dur: burn });
      for (let tt = 0.3; tt < burn; tt += 0.3) after(tt, () => near(x, y, r + 16, e => { if (Math.hypot(e.x - x, (e.y - y) / SQ) < r * 0.9 + e.r) hurtEnemy(e, dmg * 0.1, 0, 0, 'abil'); }));
    }
  }
  function poisonTick(x, y, r, dmg, slow) {           // 독 안개 한 번: 둘레 적에게 독 피해(5단계·진화는 느려짐)
    near(x, y, r + 16, e => {
      if (Math.hypot(e.x - x, (e.y - y) / SQ) > r + e.r) return;
      hurtEnemy(e, dmg, 0, 0, 'abil');
      if (slow) e.slow = Math.max(e.slow, 0.6);
    });
  }

  // ── 레벨 업 카드(뱀서 + 홀즈 등급)
  function rollRarity() { return D.RARITY.indexOf(wpick(D.RARITY, r => r.w)); }
  function cardPool() {
    const out = [];
    const U = D.ULTS[G.C.ult];
    const sk = [['basic', G.C.basic, G.C.basicIcon, D.BASIC_UPS[G.C.attack]],
                ...G.C.skills.map((k, i) => ['s' + i, D.SKILLS[k].name, D.SKILLS[k].icon, D.SKILLS[k].ups]), ['ult', U.name, U.icon, U.ups]];
    for (const [key, name, icon, ups] of sk) if (G.skLv[key] < D.MAX_LV) out.push({ type: 'skill', key, name, icon, lv: G.skLv[key] + 1, desc: ups[G.skLv[key] - 1], w: 9 });
    const unlocked = new Set(D.START_ABIL.concat(SAVE.P.unlocked.abil || []));
    // 진화 조건 줄(10-23 사용자 «스킬이 더 강력하게 바뀌는 건 적용 안 됐지?» — 들어가 있었지만 조건이 화면 어디에도 없었음)
    const evoHint = AB => `진화 → ${D.EVOS[AB.evo].name}: 5단계 + ${D.PASSIVES[AB.pair].name} 패시브${G.pass[AB.pair] ? '(가짐 ✓)' : ''} · 상자에서`;
    for (const k in D.ABILITIES) {
      const own = G.abil.find(a => a.k === k), AB = D.ABILITIES[k];
      if (G.evo[AB.evo] || (AB.cls && AB.cls !== G.cls)) continue;
      if (own && own.lv < AB.max) out.push({ type: 'abil', key: k, name: AB.name, icon: AB.icon, lv: own.lv + 1, desc: AB.desc(own.lv + 1), w: 11, hint: evoHint(AB) });
      else if (!own && G.abil.length < D.MAX_ABIL && unlocked.has(k)) out.push({ type: 'abil', key: k, name: AB.name, icon: AB.icon, lv: 1, desc: AB.desc(1), w: 8, isNew: true, hint: evoHint(AB) });
    }
    const npass = Object.keys(G.pass).length;
    const pairOf = k => G.abil.map(a => D.ABILITIES[a.k]).find(AB => AB.pair === k && !G.evo[AB.evo]);   // 가진 공격 스킬 중 이 패시브가 짝인 것
    for (const k in D.PASSIVES) {
      const own = G.pass[k], PS = D.PASSIVES[k], AB = pairOf(k), hint = AB ? `${AB.name} 진화 재료` : '';
      if (PS.cls && !PS.cls.includes(G.cls)) continue;   // 그 직업만(관통 = 궁수·권총수)
      if (own && own.lv < D.MAX_LV) out.push({ type: 'pass', key: k, name: PS.name, icon: PS.icon, lv: own.lv + 1, w: 7, hint });
      else if (!own && npass < D.MAX_PASS) out.push({ type: 'pass', key: k, name: PS.name, icon: PS.icon, lv: 1, w: 5, isNew: true, hint });
    }
    return out;
  }
  function offers(n) {
    const pool = cardPool(), res = [];
    while (res.length < n && pool.length) {
      const c = wpick(pool, x => x.w);
      pool.splice(pool.indexOf(c), 1);
      res.push(c);
    }
    for (const c of res) {
      c.rar = rollRarity();
      const R = D.RARITY[c.rar];
      if (c.type === 'pass') { const PS = D.PASSIVES[c.key]; c.val = PS.int ? (c.rar >= 2 ? 2 : 1) : PS.v * R.mul; c.desc = PS.fmt(c.val); }
      else if (c.rar > 0) c.extra = `등급 보너스: 피해 +${Math.round([0, 10, 25, 50][c.rar])}%`;
    }
    if (!res.length) res.push({ type: 'heal', name: '회복', desc: '체력 40% 회복', rar: 0 }, { type: 'gold', name: '금화', desc: '금화 +30', rar: 0 });
    return res;
  }
  function applyCard(c) {
    const R = D.RARITY[c.rar || 0], bonus = [0, 0.1, 0.25, 0.5][c.rar || 0];
    if (c.rar === 3) { G.run.legends++; sfx('legend'); } else sfx('card');
    if (c.type === 'skill') { G.skLv[c.key] = c.lv; G.skBonus[c.key] += bonus; }
    else if (c.type === 'abil') {
      const own = G.abil.find(a => a.k === c.key);
      if (own) { own.lv = c.lv; own.bonus += bonus; } else G.abil.push({ k: c.key, lv: 1, bonus, t: 0.5 });
    } else if (c.type === 'pass') {
      const own = G.pass[c.key];
      if (own) { own.lv++; own.v += c.val; } else G.pass[c.key] = { lv: 1, v: c.val };
      recalc();
    } else if (c.type === 'evo') {
      G.evo[c.key] = true; G.run.evos++;
      hooks.toast && hooks.toast(`진화! ${D.EVOS[c.key].name}`);
      sfx('legend');
    } else if (c.type === 'heal') heal(G.p.maxHp * 0.4);
    else if (c.type === 'gold') addGold(30);
    void R;
  }
  function pickCard(c) {
    applyCard(c);
    G.levelQueue--;
    nextPanel();
  }
  function reroll() {
    if (!G || G.rerolls <= 0) return null;
    G.rerolls--;
    sfx('roll');
    return offers(3);
  }
  // 상자: 진화(조건 맞으면) 먼저 · 나머지는 가진 것 무작위 강화(뱀서 룰렛)
  function chestRewards(n) {
    const res = [];
    for (const a of G.abil) {
      const AB = D.ABILITIES[a.k];
      if (a.lv >= AB.max && G.pass[AB.pair] && !G.evo[AB.evo] && res.length < n) res.push({ type: 'evo', key: AB.evo, name: D.EVOS[AB.evo].name, icon: D.EVOS[AB.evo].icon, desc: D.EVOS[AB.evo].desc, rar: 3 });
    }
    const pool = cardPool().filter(c => !c.isNew || G.abil.length + Object.keys(G.pass).length < 3);
    while (res.length < n && pool.length) {
      const c = wpick(pool, x => x.w);
      pool.splice(pool.indexOf(c), 1);
      c.rar = Math.max(1, rollRarity());
      if (c.type === 'pass') { const PS = D.PASSIVES[c.key]; c.val = PS.v * D.RARITY[c.rar].mul; c.desc = PS.fmt(c.val); }
      res.push(c);
    }
    while (res.length < n) res.push({ type: 'gold', name: '금화', desc: '금화 +25', rar: 0 });
    return res;
  }
  let panelQ = [];
  function nextPanel() {                              // 레벨 업·상자 창을 차례로(창이 열려 있는 동안 멈춤)
    if (simming) {                                    // 시험 돌리기: 창 없이 바로 받음
      for (const q of panelQ.splice(0)) if (q.k === 'chest') { for (const c of chestRewards(q.n)) applyCard(c); G.run.chests++; }
      return;
    }
    const q = panelQ.shift();
    if (!q) { G.paused = false; hooks.hud && hooks.hud(G); return; }
    G.paused = true; G.shake = 0;                     // 창을 닫고 돌아와도 남은 흔들림 없이
    if (q.k === 'level') hooks.levelup && hooks.levelup(G, offers(3));
    else if (q.k === 'chest') { const r = chestRewards(q.n); for (const c of r) applyCard(c); G.run.chests++; hooks.chest && hooks.chest(G, r); }
  }
  function queuePanel(q) { panelQ.push(q); if (!G.paused) nextPanel(); }
  function addGold(v) { G.gold += Math.round(v * (1 + G.st.gold)); sfx('coin'); }
  function gainXp(v) {
    G.xp += v * (1 + G.st.xp);
    while (G.xp >= D.xpNeed(G.lv)) {
      G.xp -= D.xpNeed(G.lv); G.lv++;
      const p = G.p;
      G.fx.push({ k: 'sparkle', x: p.x, y: p.y - 18, t: 0, dur: 0.8, c: '#ffe08a' });
      G.fx.push({ k: 'lvup', x: p.x, y: p.y, t: 0, dur: 0.8 });
      sfx('levelup');
      if (simming) { const o = offers(3); applyCard(o[Math.floor(Math.random() * o.length)]); }
      else { G.levelQueue++; queuePanel({ k: 'level' }); }
    }
  }

  // ── 장비(10-22 사용자 «해머워치2처럼 바로 줍고 장비 · 한 판에 하나만 들고 나오니 답답»):
  //   판 안에서 줍는 즉시 더 좋으면 바로 낌 · 주운 것은 끝나면(쓰러져도) 전부 창고로 · 판 안에서 바꿔 낀 장비는 그대로 남음
  function makeItem(rar) {
    const slot = pick(Object.keys(D.SLOTS));
    let bases = D.ITEM_BASES[slot];
    if (slot === 'weapon') bases = bases.filter(b => b[1] === G.C.weapon);   // 내 무기 종류만
    if (bases[0][2]) {                                // 단계 있는 바탕(무기·갑옷): 던전 순서(1~4) 이하만 · 반은 그 던전 단계, 반은 아래 단계 고르게
      const order = D.DUNGEONS.indexOf(G.dun) + 1;
      const top = bases.filter(b => b[2] === order), low = bases.filter(b => b[2] < order);
      bases = low.length && (!top.length || Math.random() < 0.5) ? low : top;
    }
    const [name, icon, , imp] = pick(bases), R = D.ITEM_RARITY[rar];
    const keys = Object.keys(D.AFFIXES).filter(k => D.AFFIXES[k].slots.includes(slot) && !(imp && k in imp));   // 고유 성능과 같은 성질은 또 안 붙음(한 장에 «공격력» 두 줄 X)
    const aff = [];
    for (const k in imp || {}) aff.push({ k, v: imp[k], imp: true });   // 무기 고유 성능(맨 위 · 굵게)
    let n = 0;
    while (n < R.n && keys.length) {
      const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
      aff.push({ k, v: +(D.AFFIXES[k].v * rand(0.7, 1.3) * (1 + rar * 0.25)).toFixed(3) });
      n++;
    }
    const it = { id: SAVE.newId(), slot, name, icon, rar, ilvl: D.itemLevelOf(G.dun.tier), up: 0, aff, cls: slot === 'weapon' ? G.cls : null };
    if (R.unique) {                                   // 전설: 무기면 그 무기 전용 효과도 후보 · 다른 칸은 공용만
      const pool = Object.keys(D.UNIQUES).filter(k => !D.UNIQUES[k].wpn || (slot === 'weapon' && D.UNIQUES[k].wpn === G.C.weapon));
      it.uniq = pick(pool); it.name = D.UNIQUES[it.uniq].name + ' ' + name;
    }
    return it;
  }
  function dropItem(x, y, minRar) {
    const r = Math.max(minRar, [0, 0, 0, 0, 0, 0, 1, 1, 1, 2][Math.floor(Math.random() * 10)] + (Math.random() < 0.04 ? 1 : 0));
    G.drops.push({ k: 'item', item: makeItem(Math.min(3, r)), x: x + rand(-6, 6), y: y + rand(-6, 6), t: 0 });
  }
  function wear(it) {                                 // 판 안에서 끼기(같은 칸은 바꿔 낌)
    const slots = Object.keys(D.SLOTS), i = slots.indexOf(it.slot);
    G.worn[i] = it;
    recalc(); sfx('card');
    hooks.hud && hooks.hud(G);
  }
  // 장비 점수(바로 낄지 고를 때): 성질마다 «기본 크기의 몇 배» 합 × 아이템 레벨·강화 + 전설 효과 · 무기 고유 성능은 1.5배
  function itemScore(it) {
    if (!it) return -1;
    let s = 0;
    for (const a of it.aff) { const A = D.AFFIXES[a.k]; s += (A && A.v ? a.v / A.v : 1) * (a.imp ? 1.5 : 1); }
    return s * D.affixScale(it.ilvl, it.up) + (it.uniq ? 3 : 0) + it.rar * 0.5;
  }
  const betterThan = (it, old) => !old || itemScore(it) > itemScore(old) + 0.3;

  // ── 보물 고블린(해머워치·디아블로): 도망치다 사라짐 · 잡으면 금화 폭발 + 아이템
  function spawnGoblin() {
    const art = mobArts('goblin')[0] || 'goblin_2';
    const sh = sheetOf(art) || sheetOf('goblin_0');
    if (!sh) return;
    // 10-22 사용자 «문구는 4~5번 봤는데 어떻게 생긴지도 모르겠다» — 화면 밖에서 생겨 바로 달아나 안 보였음 →
    //   화면 안쪽(대각선 반의 55%)에서 나옴 · 주인공(64)보다 느리게(46) 지그재그로 · 18초 · 금빛 반짝임 + 머리 위 보물 자루(그림은 render)
    const c = spawnRing(Math.hypot(VW, VH) / 2 * 0.55);
    G.enemies.push({ id: G.uid++, k: 'goblin', m: { atk: 'none' }, sh, x: c.x, y: c.y, hp: 60 * G.dun.tier * (1 + G.t / 120), maxHp: 1, dmg: 0, speed: 46, xp: 0,
                     r: 6, row: 0, animT: 0, flash: 0, kx: 0, ky: 0, st: 'flee', at: 18, cd: 0, scale: 1.5, slow: 0, freeze: 0, z: 0, goblin: true, elite: 'gold', zig: rand(0, 6) });
    G.enemies[G.enemies.length - 1].maxHp = G.enemies[G.enemies.length - 1].hp;
    burst(c.x, c.y, 16, ['#ffe680', '#ffd34a', '#ffffff'], { spd: [30, 80], up: [20, 60], life: [0.4, 0.8] });
    hooks.toast && hooks.toast('보물 고블린이다! 금빛 화살표 쪽 · 놓치지 마!');
    sfx('warn');
  }
  function goblinLoot(e) {
    G.run.goblins++;
    for (let i = 0; i < 20; i++) G.coins.push({ x: e.x + rand(-18, 18), y: e.y + rand(-14, 14), v: 3 + Math.floor(G.dun.tier), pull: false });
    dropItem(e.x, e.y, 2);
    G.fx.push({ k: 'sparkle', x: e.x, y: e.y - 10, t: 0, dur: 0.9, c: '#ffd36a' });
    sfx('chest');
  }

  // ── 보스(사용자: 스킬과 패턴) — 기술 = 예고(빨간 바닥) → 터짐 · 절반 아래 rage 목록 · 더 빠르게
  function bossSheet(def) {
    return sheetOf(def.art) || sheetOf(def.fallback || '') || null;
  }
  function spawnBoss(key, final) {
    const def = D.BOSSES[key];
    let sh = sheetOf(def.art), scale = 1;
    if (!sh) {                                        // 아직 그림이 없으면 비슷한 몬스터를 크게(젤리 → 거대 젤리 등)
      const fb = { giant_slime: 'slime_0', jelly_blue: 'slime_1', jelly_purple: 'slime_3', boar_king: 'boar', alpha_wolf: 'wolf', skeleton_king: 'skeleton', shaman_elder: 'shaman', orc_warlord: 'orc', golem: 'ogre', ogre_chief: 'ogre' }[key];
      sh = sheetOf(fb) || sheetOf(mobArts(fb ? fb.replace(/_\d$/, '') : 'slime')[0]) || sheetOf('slime_0') || sheetOf('goblin_2');
      scale = sh.wh[1] < 20 ? 3 : 2;
    }
    const c = spawnRing(Math.hypot(VW, VH) / 2 - 30);
    const sc = D.enemyScale(G.dun.tier, Math.min(G.t, 720)), bhp = D.bossHp(G.dun.tier, Math.min(G.t, 720));
    const e = { id: G.uid++, k: key, m: { atk: 'boss' }, sh, x: c.x, y: c.y, hp: def.hp * bhp, dmg: def.dmg * sc.dmg, speed: def.speed, xp: 0,
                r: def.r, row: 0, animT: 0, flash: 0, kx: 0, ky: 0, st: 'move', at: 1.2, cd: 0, scale, slow: 0, freeze: 0, z: 0, elite: null,
                boss: { key, def, final, mi: 0, rage: false, busy: 0, buff: 0 } };
    e.maxHp = e.hp;
    G.enemies.push(e);
    G.boss = e;
    G.shake = 0.5; sfx('boss');
    hooks.boss && hooks.boss(G, e);
    return e;
  }
  function bossDeath(e) {
    const b = e.boss;
    G.run.bosses[b.key] = (G.run.bosses[b.key] || 0) + 1;
    for (let i = 0, n = irand(b.def.gold[0], b.def.gold[1]) / 5; i < n; i++) G.coins.push({ x: e.x + rand(-24, 24), y: e.y + rand(-18, 18), v: 5, pull: false });
    dropItem(e.x - 8, e.y, b.final ? 2 : 1);
    if (b.final) dropItem(e.x + 8, e.y, 2);
    G.fx.push({ k: 'boom', x: e.x, y: e.y - 10, r: 60, t: 0, dur: 0.6, c: '#ffd36a' });
    G.shake = 0.6; sfx('slam');
    if (G.boss === e) G.boss = null;
    hooks.boss && hooks.boss(G, null);
    if (b.def.split && !e.child) {                    // 거대 젤리: 셋으로 갈라짐(그 셋도 한 번 더)
      for (let i = 0; i < 3; i++) splitSlime(e, 0.5, 1);
    }
    if (b.final) {
      G.cleared = true;
      for (const g of G.gems) g.pull = true;
      for (const c of G.coins) c.pull = true;
      sfx('clear');
      hooks.toast && hooks.toast(`${G.dun.name} 정복!`);
      after(2.6, () => { hooks.clear && hooks.clear(G); });
    } else {
      G.drops.push({ k: 'chest', n: 3, x: e.x, y: e.y, t: 0 });
      if (Math.random() < D.MAGNET_BOSS) G.drops.push({ k: 'magnet', x: e.x + 16, y: e.y + 4, t: 0 });   // 10-22 «보스 잡을 때 일정 확률로 자석»
      hooks.toast && hooks.toast(`${b.def.name} 처치!`);
    }
  }
  function splitSlime(parent, hpk, gen) {
    // 갈라진 젤리 = 같은 색 작은 젤리 그림 ×2(10-22 — 전엔 보스 그림을 ×2 로 써서 보스보다 큰 젤리가 나왔음)
    const kid = parent.boss && parent.boss.def.kids, ksh = kid && sheetOf(kid);
    const sh = ksh || parent.sh, a = rand(0, Math.PI * 2);
    const e = { id: G.uid++, k: 'slime', m: D.MONSTERS.slime, sh, x: parent.x + Math.cos(a) * 14, y: parent.y + Math.sin(a) * 10, hp: parent.maxHp * 0.12, dmg: parent.dmg * 0.6, speed: 30, xp: 6,
                r: 9, row: 0, animT: 0, flash: 0, kx: Math.cos(a) * 120, ky: Math.sin(a) * 120, st: 'move', at: 0, cd: 1, scale: ksh ? 2 : parent.scale, slow: 0, freeze: 0, z: 0, elite: 'split', child: gen };
    e.maxHp = e.hp;
    G.enemies.push(e);
  }
  // 기술 하나: 예고를 띄우고 «바쁜 시간»(다음 기술까지)을 돌려줌 · w = 예고 시간 배율(rage 면 짧게)
  const BOSS_MOVES = {
    jump(e, w) {                                      // 뛰어올라 내려찍기(원 예고) + 작은 젤리
      const p = G.p, tx = p.x, ty = p.y, x0 = e.x, y0 = e.y;
      teleCircle(tx, ty, 38, 1.0 * w, () => {
        e.x = tx; e.y = ty; e.z = 0;
        hitPlayerCircle(tx, ty, 38, e.dmg * 1.3);
        G.fx.push({ k: 'boom', x: tx, y: ty - 4, r: 38, t: 0, dur: 0.35, c: '#9dff9a' }); G.shake = 0.3; sfx('slam');
        for (let i = 0; i < 2; i++) makeEnemy('slime', tx + rand(-20, 20), ty + rand(-20, 20), { art: e.boss.def.kids });   // 같은 색 작은 젤리
      });
      e.leap = { t: 0, dur: 1.0 * w, x0, y0, x1: tx, y1: ty, h: 50 };
      return 1.6 * w;
    },
    spit(e, w) {                                      // 끈적이 탄 다섯 갈래
      const p = G.p, a0 = Math.atan2(p.y - e.y, p.x - e.x);
      tele({ k: 'fan', x: e.x, y: e.y - 8, r: 70, ang: a0, arc: 70, dur: 0.6 * w }, () => {
        for (let i = -2; i <= 2; i++) eShoot(e, a0 + i * 0.22, 95, 'goo', e.dmg * 0.8);
        sfx('eshot');
      });
      return 1.3 * w;
    },
    sweep(e, w) {                                     // 큰 앞쪽 부채꼴 베기
      const p = G.p, ang = Math.atan2(p.y - e.y, p.x - e.x), r = 78, arc = 150;
      const x = e.x, y = e.y;                         // 예고를 띄운 자리에서 벰(그 사이 움직이지 않음 · lock)
      tele({ k: 'sector', x, y, r, ang, arc, dur: 0.85 * w }, () => {
        hitPlayerSector(x, y, r, ang, arc, e.dmg * 1.4);
        G.fx.push({ k: 'bigslash', x, y, r, ang: sqAng(ang, SQ), arc, t: 0, dur: 0.3 }); G.shake = 0.25; sfx('slam');
      });
      e.lock = 0.85 * w;
      return 1.5 * w;
    },
    spikes(e, w) {                                    // 주인공 쪽으로 뼈 가시 줄
      const p = G.p, ang = Math.atan2(p.y - e.y, p.x - e.x);
      for (let i = 1; i <= 7; i++) {
        const x = e.x + Math.cos(ang) * i * 22, y = e.y + Math.sin(ang) * i * 22;
        teleCircle(x, y, 14, 0.7 * w + i * 0.09, () => { hitPlayerCircle(x, y, 14, e.dmg); G.fx.push({ k: 'spike', x, y, t: 0, dur: 0.45 }); sfx('ehit'); });
      }
      return 1.6 * w;
    },
    summon(e, w) {                                    // 부하 부르기(보라 원)
      const k = { skeleton_king: 'skeleton', alpha_wolf: 'wolf', shaman_elder: 'goblin', orc_warlord: 'goblin' }[e.boss.key] || 'slime';
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, x = e.x + Math.cos(a) * 36, y = e.y + Math.sin(a) * 28;
        tele({ k: 'circle', x, y, r: 10, dur: 0.7 * w, c: 'purple' }, () => makeEnemy(mobArts(k).length ? k : 'slime', x, y));
      }
      sfx('warn');
      return 1.4 * w;
    },
    whirl(e, w) {                                     // 휘몰아치며 쫓아옴
      e.whirl = 2.2;
      tele({ k: 'circle', x: e.x, y: e.y, r: 40, dur: 0.5 * w, follow: e });
      return 2.6;
    },
    charge(e, w) {                                    // 선 예고 뒤 돌진(기둥에 부딪히면 기절)
      const p = G.p, ang = Math.atan2(p.y - e.y, p.x - e.x), len = 190;
      tele({ k: 'line', x: e.x, y: e.y, x2: e.x + Math.cos(ang) * len, y2: e.y + Math.sin(ang) * len, w: e.r * 2, dur: 0.9 * w }, () => {
        e.charge = { ux: Math.cos(ang), uy: Math.sin(ang), left: len, spd: 300, hit: false };
        e.row = rowFor(e.sh, Math.cos(ang), Math.sin(ang));
        sfx('dash');
      });
      e.lock = 0.9 * w;
      return 1.9 * w;
    },
    stomp(e, w) {                                     // 둘레 고리
      tele({ k: 'circle', x: e.x, y: e.y, r: 70, dur: 0.8 * w, follow: e }, () => {
        hitPlayerCircle(e.x, e.y, 70, e.dmg * 1.2); G.fx.push({ k: 'boom', x: e.x, y: e.y - 4, r: 70, t: 0, dur: 0.4 }); G.shake = 0.35; sfx('slam');
      });
      e.lock = 0.8 * w;
      return 1.5 * w;
    },
    dashes(e, w) {                                    // 세 번 연달아 덮침
      for (let i = 0; i < 3; i++) after(i * 0.75 * w, () => {
        if (e.hp <= 0) return;
        const p = G.p, ang = Math.atan2(p.y - e.y, p.x - e.x), len = 120;
        tele({ k: 'line', x: e.x, y: e.y, x2: e.x + Math.cos(ang) * len, y2: e.y + Math.sin(ang) * len, w: e.r * 2, dur: 0.45 * w }, () => {
          e.charge = { ux: Math.cos(ang), uy: Math.sin(ang), left: len, spd: 420, hit: false };
          e.row = rowFor(e.sh, Math.cos(ang), Math.sin(ang));
          sfx('dash');
        });
      });
      e.lock = 2.2 * w;
      return 2.6 * w;
    },
    howl(e, w) {                                      // 울부짖음: 늑대 부르고 빨라짐
      G.fx.push({ k: 'ring', x: e.x, y: e.y - 8, r: 90, t: 0, dur: 0.6, c: '#ff8a5a' });
      sfx('boss'); G.shake = 0.3;
      e.boss.buff = 5;
      return BOSS_MOVES.summon(e, w);
    },
    claw(e, w) {                                      // 둘레 할퀴기
      tele({ k: 'circle', x: e.x, y: e.y, r: 52, dur: 0.6 * w, follow: e }, () => {
        hitPlayerCircle(e.x, e.y, 52, e.dmg * 1.2); G.fx.push({ k: 'bigslash', x: e.x, y: e.y, r: 52, ang: 0, arc: 360, t: 0, dur: 0.3 }); sfx('slam');
      });
      e.lock = 0.6 * w;
      return 1.2 * w;
    },
    orbs(e, w) {                                      // 둘레로 마력탄
      tele({ k: 'circle', x: e.x, y: e.y - 8, r: 22, dur: 0.6 * w, follow: e, c: 'purple' }, () => {
        for (let i = 0; i < 14; i++) eShoot(e, i * Math.PI * 2 / 14 + G.t, 70, 'orb', e.dmg * 0.8);
        sfx('eshot');
      });
      return 1.6 * w;
    },
    quake(e, w) {                                     // 여기저기 땅 울림(원 8개)
      const p = G.p;
      for (let i = 0; i < 8; i++) {
        const x = p.x + rand(-80, 80), y = p.y + rand(-60, 60);
        teleCircle(x, y, 22, 0.9 * w + rand(0, 0.5), () => { hitPlayerCircle(x, y, 22, e.dmg); G.fx.push({ k: 'boom', x, y: y - 3, r: 22, t: 0, dur: 0.3 }); sfx('slam'); });
      }
      const px = p.x, py = p.y;                       // 하나는 꼭 지금 선 자리(가만히 있으면 맞음)
      teleCircle(px, py, 22, 1.0 * w, () => { hitPlayerCircle(px, py, 22, e.dmg); G.fx.push({ k: 'boom', x: px, y: py - 3, r: 22, t: 0, dur: 0.3 }); });
      return 2.0 * w;
    },
    axes(e, w) {                                      // 도는 도끼 셋(돌아옴)
      const p = G.p, a0 = Math.atan2(p.y - e.y, p.x - e.x);
      tele({ k: 'fan', x: e.x, y: e.y - 8, r: 90, ang: a0, arc: 60, dur: 0.6 * w }, () => {
        for (let i = -1; i <= 1; i++) eShoot(e, a0 + i * 0.35, 150, 'axe', e.dmg, { ret: e, life: 2.2 });
        sfx('eshot');
      });
      return 1.6 * w;
    },
    slam(e, w) {                                      // 앞쪽 크게 내려찍기
      const p = G.p, ang = Math.atan2(p.y - e.y, p.x - e.x), x = e.x + Math.cos(ang) * 34, y = e.y + Math.sin(ang) * 34;
      teleCircle(x, y, 46, 0.9 * w, () => { hitPlayerCircle(x, y, 46, e.dmg * 1.5); G.fx.push({ k: 'boom', x, y: y - 4, r: 46, t: 0, dur: 0.4 }); G.shake = 0.4; sfx('slam'); });
      e.lock = 0.9 * w;
      return 1.6 * w;
    },
    boulders(e, w) {                                  // 바위 셋을 던짐(떨어질 자리 예고)
      const p = G.p;
      for (let i = 0; i < 3; i++) {
        const x = p.x + rand(-40, 40), y = p.y + rand(-30, 30);
        tele({ k: 'circle', x, y, r: 24, dur: 1.1 * w + i * 0.2 }, () => { hitPlayerCircle(x, y, 24, e.dmg * 1.2); G.fx.push({ k: 'boom', x, y: y - 3, r: 24, t: 0, dur: 0.35, c: '#c8a070' }); sfx('slam'); });
        G.fx.push({ k: 'boulder', x: e.x, y: e.y - 20, x2: x, y2: y, t: 0, dur: 1.1 * w + i * 0.2 });
      }
      return 2.0 * w;
    },
    leap(e, w) {                                      // 크게 뛰어 내려찍기 + 충격파
      const p = G.p, tx = p.x, ty = p.y, x0 = e.x, y0 = e.y;
      teleCircle(tx, ty, 62, 1.2 * w, () => {
        e.x = tx; e.y = ty; e.z = 0;
        hitPlayerCircle(tx, ty, 62, e.dmg * 1.6);
        G.fx.push({ k: 'boom', x: tx, y: ty - 4, r: 62, t: 0, dur: 0.45 }); G.shake = 0.6; sfx('slam');
        tele({ k: 'ring', x: tx, y: ty, r: 110, dur: 0.5 }, () => {});
      });
      e.leap = { t: 0, dur: 1.2 * w, x0, y0, x1: tx, y1: ty, h: 70 };
      return 2.2 * w;
    },
  };
  function eShoot(e, ang, spd, kind, dmg, o) {
    G.eproj.push(Object.assign({ k: kind, x: e.x, y: e.y - (e.sh.wh[1] * 0.5 * e.scale), vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg, life: 3, r: kind === 'orb' || kind === 'goo' ? 4 : 3, spin: 0 }, o || {}));
  }
  function updBoss(e, dt, dx, dy, l) {
    const b = e.boss, def = b.def;
    if (!b.rage && e.hp < e.maxHp * 0.5 && def.rage) { b.rage = true; b.mi = 0; hooks.toast && hooks.toast(`${D.josa(def.name, '이', '가')} 격노했다!`); sfx('boss'); G.shake = 0.4; }
    b.buff = Math.max(0, b.buff - dt);
    const spd = e.speed * (b.rage ? 1.25 : 1) * (b.buff > 0 ? 1.5 : 1) * (e.slow > 0 ? 0.7 : 1);
    if (e.leap) {                                     // 뛰어오름(그림은 위로 · 끝나면 내려찍기에서 위치 옮김)
      const L = e.leap; L.t += dt;
      const k = Math.min(1, L.t / L.dur);
      e.z = Math.sin(k * Math.PI) * L.h;
      if (k < 0.9) { e.x = L.x0 + (L.x1 - L.x0) * k * 0.9; e.y = L.y0 + (L.y1 - L.y0) * k * 0.9; }
      if (k >= 1) { e.leap = null; e.z = 0; }
      return;
    }
    if (e.charge) {
      const c = e.charge, s = Math.min(c.left, c.spd * dt);
      e.x += c.ux * s; e.y += c.uy * s; c.left -= s;
      if (!c.hit && Math.hypot(G.p.x - e.x, (G.p.y - e.y) / SQ) < e.r + G.p.r) { c.hit = true; hurtPlayer(e.dmg * 1.3); }
      if (G.fx.length < 140) G.fx.push({ k: 'dust', x: e.x, y: e.y, t: 0, dur: 0.25 });
      if (pillarAt(e.x + c.ux * e.r, e.y + c.uy * e.r)) { c.left = 0; e.stun = 1.4; G.shake = 0.3; sfx('slam'); hooks.toast && hooks.toast('기둥에 부딪혀 기절!'); }
      if (c.left <= 0) e.charge = null;
      return;
    }
    if (e.whirl > 0) {
      e.whirl -= dt;
      e.x += dx / l * spd * 1.3 * dt; e.y += dy / l * spd * 1.3 * dt;
      e.whirlT = (e.whirlT || 0) - dt;
      if (e.whirlT <= 0) { e.whirlT = 0.3; hitPlayerCircle(e.x, e.y, 40, e.dmg * 0.8); G.fx.push({ k: 'bigslash', x: e.x, y: e.y, r: 40, ang: G.t * 8, arc: 360, t: 0, dur: 0.25 }); sfx('swing'); }
      return;
    }
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.lock > 0) { e.lock -= dt; return; }
    b.busy -= dt;
    if (l > e.r + G.p.r + 10) { e.x += dx / l * spd * dt; e.y += dy / l * spd * dt; }
    if (b.busy <= 0) {
      const list = b.rage ? def.rage : def.moves, mv = list[b.mi % list.length];
      b.mi++;
      b.busy = (BOSS_MOVES[mv] ? BOSS_MOVES[mv](e, b.rage ? 0.8 : 1) : 1) + rand(0.4, 1.0) * (b.rage ? 0.6 : 1);
    }
  }

  // ── 몬스터 행동(굼뜬 공격: 다가감 → 예고 → 공격 → 쉼)
  function startAttack(e, dx, dy, l) {
    const m = e.m;
    // 판이 흐를수록 예고가 조금 짧아짐(12분에 0.7배) — 그래도 0.3초 아래로는 안 내려감
    e.st = 'wind'; e.stT = 0; e.windT = e.at = Math.max(m.atk === 'melee' ? 0.22 : 0.3, m.windup * (e.elite ? 0.85 : 1) * Math.max(0.7, 1 - 0.025 * G.t / 60));
    e.ax = dx / l; e.ay = dy / l; e.tx = G.p.x; e.ty = G.p.y;
    if (m.atk === 'hop' || m.atk === 'lunge') { const d = Math.min(l, m.leap); e.tx = e.x + e.ax * d; e.ty = e.y + e.ay * d; }
    if (m.atk === 'charge' || m.atk === 'dive') { e.tx = e.x + e.ax * m.leap; e.ty = e.y + e.ay * m.leap; }
    if (m.atk === 'slam') { e.tx = e.x + e.ax * m.range * 0.7; e.ty = e.y + e.ay * m.range * 0.7; }
  }
  function doAttack(e) {
    const m = e.m, p = G.p;
    e.st = 'act'; e.stT = 0;
    switch (m.atk) {
      case 'melee': {
        const ang = Math.atan2(e.ay, e.ax);
        hitPlayerSector(e.x, e.y, m.range * e.scale + 6, ang, m.arc, e.dmg, 1);
        G.fx.push({ k: 'eslash', x: e.x, y: e.y, r: m.range * e.scale + 6, ang, arc: m.arc, t: 0, dur: 0.18, flat: true });
        sfx('swing');
        e.at = 0.12; break;
      }
      case 'shoot': {
        const ang = Math.atan2(p.y - e.y, p.x - e.x);
        eShoot(e, ang, m.pspd, m.proj, e.dmg);
        if (e.elite) { eShoot(e, ang - 0.25, m.pspd, m.proj, e.dmg); eShoot(e, ang + 0.25, m.pspd, m.proj, e.dmg); }
        sfx('eshot');
        e.at = 0.15; break;
      }
      case 'slam': {
        hitPlayerCircle(e.tx, e.ty, m.aoe * e.scale, e.dmg);
        G.fx.push({ k: 'boom', x: e.tx, y: e.ty - 3, r: m.aoe * e.scale, t: 0, dur: 0.35, c: '#c8a070' }); G.shake = Math.max(G.shake, 0.2); sfx('slam');
        e.at = 0.2; break;
      }
      default: {                                      // hop · lunge · dive · charge = 몸을 날림(닿으면 한 번 피해)
        const dur = { hop: 0.38, lunge: 0.3, dive: 0.32, charge: 0.55 }[m.atk] || 0.35;
        e.fly = { t: 0, dur, x0: e.x, y0: e.y, x1: e.tx, y1: e.ty, hit: false, arc: m.atk === 'hop' ? 12 : m.atk === 'lunge' ? 6 : 0 };
        if (m.atk === 'charge') sfx('dash');
        e.at = dur;
      }
    }
  }
  function updEnemy(e, dt) {
    const p = G.p, m = e.m;
    e.animT += dt; e.stT = (e.stT || 0) + dt; e.flash = Math.max(0, e.flash - dt); e.slow = Math.max(0, e.slow - dt);
    const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
    if (e.freeze > 0) { e.freeze -= dt; e.kx *= 0.8; e.ky *= 0.8; return; }
    if (!e.fly && !e.leap && !e.charge) e.row = rowFor(e.sh, dx, dy);
    if (e.boss) { updBoss(e, dt, dx, dy, l); return; }
    const spd = e.speed * (e.slow > 0 ? 0.5 : 1);
    if (e.goblin) {                                   // 보물 고블린: 주인공 반대쪽으로 지그재그로 도망 · 금가루를 흘림 · 시간 지나면 사라짐
      e.at -= dt;
      const a = Math.atan2(-dy, -dx) + Math.sin(G.t * 2.2 + e.zig) * 0.7, ux = Math.cos(a), uy = Math.sin(a);
      e.x += ux * spd * dt; e.y += uy * spd * dt;
      e.row = rowFor(e.sh, ux, uy);
      if (Math.random() < dt * 10) burst(e.x + rand(-4, 4), e.y - 2, 1, ['#ffe680', '#ffd34a'], { spd: [5, 15], up: [15, 35], life: [0.4, 0.7] });
      if (e.at <= 0) { e.hp = 0; e.gone = true; G.fx.push({ k: 'sparkle', x: e.x, y: e.y - 8, t: 0, dur: 0.6, c: '#ffd36a' }); hooks.toast && hooks.toast('보물 고블린이 사라졌다…'); }
      return;
    }
    if (e.elite === 'vamp' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * D.AFFIX.vamp.heal * dt);
    switch (e.st) {
      case 'move': {
        e.cd -= dt;
        let mx = dx / l, my = dy / l;
        if (m.atk === 'shoot') {
          if (l < m.keep) { mx = -mx; my = -my; } else if (l < m.range * 0.85) { mx = my = 0; }
        }
        if (l > e.r + p.r + 2) { e.x += mx * spd * dt; e.y += my * spd * dt; }
        // 근접은 사거리의 1.3배에서 예고를 시작하고 예고 동안에도 다가옴(10-22 «근접은 더 일찍 공격»)
        const reach = m.atk === 'shoot' ? m.range : (m.range + e.r) * (e.scale > 1 ? 1.2 : 1) * (m.atk === 'melee' ? 1.3 : 1);
        if (e.cd <= 0 && l < reach && !G.cleared) startAttack(e, dx, dy, l);
        break;
      }
      case 'wind': {
        e.at -= dt;
        if (m.atk === 'shoot' || m.atk === 'melee') { e.ax = dx / l; e.ay = dy / l; }   // 예고 동안 겨눔을 따라감
        if (m.atk === 'melee' && l > e.r + p.r + 4) { e.x += dx / l * spd * 0.55 * dt; e.y += dy / l * spd * 0.55 * dt; }
        if (e.at <= 0) doAttack(e);
        break;
      }
      case 'act': {
        if (e.fly) {
          const f = e.fly; f.t += dt;
          const k = Math.min(1, f.t / f.dur);
          e.x = f.x0 + (f.x1 - f.x0) * k; e.y = f.y0 + (f.y1 - f.y0) * k; e.z = Math.sin(k * Math.PI) * f.arc;
          if (!f.hit && Math.hypot(p.x - e.x, p.y - e.y) < e.r + p.r) { f.hit = hurtPlayer(e.dmg) || true; }
          if (m.atk === 'charge' && pillarAt(e.x + e.ax * e.r, e.y + e.ay * e.r)) { f.t = f.dur; e.at = 0; e.stun = 1.2; }
          if (k >= 1) {
            e.fly = null; e.z = 0;
            if (m.atk === 'hop') { G.fx.push({ k: 'dust', x: e.x, y: e.y, t: 0, dur: 0.25 }); if (!f.hit) hitPlayerCircle(e.x, e.y, 10 * e.scale, e.dmg); }
          }
        }
        e.at -= dt;
        if (e.at <= 0 && !e.fly) { e.st = 'rec'; e.stT = 0; e.at = m.rec + (e.stun || 0); e.stun = 0; }
        break;
      }
      case 'rec': {
        e.at -= dt;
        if (e.at <= 0) { e.st = 'move'; e.stT = 0; e.cd = rand(0.3, 0.9); }
        break;
      }
    }
  }

  // ── 진행 한 칸
  function update(dt) {
    const p = G.p;
    G.t += dt;
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter(f => f.t < f.dur);
    for (const q of G.parts) {                        // 입자: 바닥 위(x·y) + 높이 z · 중력 g · 바닥에 닿으면 미끄러지다 멈춤
      q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= q.g * dt;
      if (q.z < 0) { q.z = 0; q.vz = 0; q.vx *= 0.5; q.vy *= 0.5; }
    }
    if (G.parts.length) G.parts = G.parts.filter(q => q.t < q.life);
    for (const n of G.nums) n.t += dt;
    G.nums = G.nums.filter(n => n.t < 0.6);
    G.numsNow = 0; G.sparksNow = 0;
    G.shake = Math.max(0, G.shake - dt);
    if (G.hitStop > 0) { G.hitStop -= dt; return; }
    // 예약·예고
    for (const s of G.sched) if (G.t >= s.at && !s.done) { s.done = true; s.fn(); }
    G.sched = G.sched.filter(s => !s.done);
    for (const o of G.tele) { o.t += dt; if (o.follow) { o.x = o.follow.x; o.y = o.follow.y; } }
    G.tele = G.tele.filter(o => o.t < o.dur);
    // 이동 입력(키보드 · 왼손 조이스틱 · 마우스 누른 곳으로)
    let mx = 0, my = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) mx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) mx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) my -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) my += 1;
    if (mx || my) dest = null;
    if (joy && joy.mode === 'stick') { const dx = joy.x - joy.x0, dy = joy.y - joy.y0, l = Math.hypot(dx, dy); if (l > 4) { const k = Math.min(1, l / 40); mx = dx / l * k; my = dy / l * k; } }
    else if (joy) {
      const dx = joy.x * dpr / S - VW / 2, dy = joy.y * dpr / S - (VH / 2 - 10), l = Math.hypot(dx, dy);
      if (l > 6) { const k = Math.min(1, l / 30); mx = dx / l * k; my = dy / l * k; }
    } else if (dest && !(mx || my)) {
      const dx = dest.x - p.x, dy = dest.y - p.y, l = Math.hypot(dx, dy);
      dest.t += dt;
      if (l < 3 || dest.t > 4) dest = null; else { const k = Math.min(1, l / 10); mx = dx / l * k; my = dy / l * k; }
    }
    if (botMove) { mx = botMove.x; my = botMove.y; }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moving = ml > 0.05 && !p.dash;
    if (p.dash) {
      const d = p.dash;
      d.t += dt;
      p.x += d.ux * d.spd * dt; p.y += d.uy * d.spd * dt;
      p.hop = d.dodge ? Math.sin(Math.min(1, d.t / d.dur) * Math.PI) * 3 : 0;
      if (d.hit) near(p.x, p.y, 30, e => {
        if (d.hit.has(e.id) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + d.sk.w) return;
        d.hit.add(e.id);
        const side = Math.random() < 0.5 ? 1 : -1;
        if (hurtEnemy(e, dmgBase() * d.mul, -d.uy * d.sk.kb * side, d.ux * d.sk.kb * side, 'skill')) G.shake = Math.max(G.shake, 0.08);   // 돌진 중 멈춤 없음(10-22 — 맞을 때마다 서서 돌진이 뚝뚝 끊겼음)
      });
      if (G.fx.length < 140) G.fx.push({ k: 'after', x: p.x, y: p.y - p.hop, dir: p.dir, col: heroCol(), t: 0, dur: d.dodge ? 0.16 : 0.2 });
      if (solve(p, 5) || d.t >= d.dur) {
        if (d.x0 !== undefined) G.fx.push({ k: 'trail', x: d.x0, y: d.y0 - 8, x2: p.x, y2: p.y - 8, t: 0, dur: 0.28, c: '#bfefff' });   // 돌진·찌르기 자국
        if (d.boom) {
          const bx = p.x, by = p.y, br = d.boomR || 44;
          G.fx.push({ k: 'boom', x: bx, y: by - 6, r: br, t: 0, dur: 0.35, c: '#bfe8ff' });
          shockAt(bx, by, br * 1.2, '#bfefff');
          burst(bx, by, 18, ['#ffffff', '#9ae6ff', '#bfe8ff'], { spd: [50, 130], up: [20, 70], life: [0.3, 0.55] });
          near(bx, by, br + 10, e => { if (Math.hypot(e.x - bx, e.y - by) < br + e.r) hurtEnemy(e, dmgBase() * d.mul * 0.8, 0, 0, 'skill'); });
          G.shake = Math.max(G.shake, 0.15); sfx('slam');
        }
        p.dash = null; p.hop = 0;
        if (d.onEnd) d.onEnd();
      }
    } else if (p.moving) {
      const spd = G.C.speed * (1 + G.st.speed) * swiftMul() * (p.atk ? D.MOVE_WHILE_ATK : 1);
      p.x += mx * spd * dt; p.y += my * spd * dt;
      p.vx = mx; p.vy = my;
      p.walkT += dt * (0.6 + ml);
      if (!p.atk) p.dir = dirOf(mx, my);
    }
    solve(p, 5);
    p.hp = Math.min(p.maxHp, p.hp + (G.C.regen + G.st.regen) * dt);
    G.leechBank = Math.min(p.maxHp * D.LEECH_CAP, (G.leechBank || 0) + p.maxHp * D.LEECH_CAP * dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.inv = Math.max(0, p.inv - dt);
    G.dodgeCd = Math.max(0, G.dodgeCd - dt);
    for (let i = 0; i < G.cds.length; i++) G.cds[i] = Math.max(0, G.cds[i] - dt);
    G.ultCd = Math.max(0, G.ultCd - dt);
    // 몸 옮기는 중(찌르기·구르기)에 누른 필살은 끝나자마자(10-23 · 눌렀는데 안 나가는 일 없게)
    if (G.ultQ) { G.ultQ = Math.max(0, G.ultQ - dt); if (!p.dash) { G.ultQ = 0; useUlt(); } }
    // 스킬 자동(10-22 사용자 «스킬은 자동으로 · 회피 버튼도 거의 안 누름»): 대기가 끝났고 사거리 안에 적이 있으면 바로 · 필살·회피는 버튼
    //   10-23 하던 동작(필살·일반 공격)의 타격이 나간 뒤에만 — 필살 동작을 가로채지 않게
    if (!G.cleared && !p.dash && !(p.atk && !p.atk.done)) for (let i = 0; i < G.C.skills.length; i++) {
      if (G.cds[i] > 0 || G.C.skills[i] === G.C.manual) continue;          // 몸 옮기기(회피 자리)는 손으로만
      if (nearestEnemy(AUTO_R[G.C.skills[i]] || 120)) useSkill(i, true);
    }
    if (p.atk) {
      const a = p.atk;
      a.t += dt;
      let acc = 0, fi = 0;
      while (fi < a.fds.length - 1 && a.t >= acc + a.fds[fi]) { acc += a.fds[fi]; fi++; }
      a.fi = fi;
      if (!a.done && fi >= a.hit) { a.done = true; a.onHit && a.onHit(a); }
      if (a.t >= a.total) { p.atk = null; p.lastAtk = G.t; }
    }
    // 판 흐름: 무리 · 정예 · 정예 무리(3·9분) · 중간 보스(6분) · 마지막 보스(12분) · 보물 고블린
    const R = D.RUN;
    if (!G.cleared) {
      G.spawnT -= dt;
      const cap = D.alive(G.t, G.lv) * (G.boss ? 0.55 : 1);
      if (G.spawnT <= 0) { G.spawnT = D.SPAWN_EVERY; if (G.enemies.length < cap) spawnPack(); }
      G.eliteT -= dt;
      if (G.eliteT <= 0 && G.t > 50) { G.eliteT = rand(R.eliteEvery[0], R.eliteEvery[1]); spawnElite(); }
      for (const w of R.eliteWave) if (G.t >= w && !G.waves[w]) {
        G.waves[w] = true;
        const mini = G.dun.minis && G.dun.minis[w];                // 던전에 따라 정예 무리 대신 보스(지하 묘지 = 거대 젤리 셋)
        if (mini && D.BOSSES[mini]) spawnBoss(mini, false);
        else { for (let i = 0; i < 3; i++) spawnElite(); hooks.toast && hooks.toast('정예 무리가 몰려온다!'); }
      }
      if (G.t >= R.mid && !G.midDone) { G.midDone = true; spawnBoss(G.dun.mid, false); }
      if (G.t >= R.boss && !G.bossDone) { G.bossDone = true; spawnBoss(G.dun.boss, true); }
      if (!G.goblinT) G.goblinT = rand(150, 420);
      if (G.t >= G.goblinT && !G.goblinDone) { G.goblinDone = true; spawnGoblin(); }
    }
    rebuildGrid();
    if (!p.atk && !p.dash) {                          // 일반 공격 자동(사거리 안 적)
      p.shotCd = Math.max(0, p.shotCd - dt);
      const tg = nearestEnemy(G.C.range);
      if (tg && p.shotCd <= 0 && !(G.reloadT > 0)) { startBasic(tg); if (G.C.attack === 'bow') p.shotCd = 0.08; }
    }
    if (G.reloadT > 0) { G.reloadT -= dt; if (G.reloadT <= 0) G.ammo = magSize(); }
    if (G.barrage) {                                  // 총알 폭풍(10-22 «부실» → 셋 중 둘은 둘레 적을 노림 · 관통 2 · 6발마다 폭발탄 · 0.5초마다 충격파 · 끝에 큰 폭발)
      const b = G.barrage, u = D.ULTS.barrage;
      b.t -= dt; b.acc += dt * u.rate * (b.two ? 2 : 1); b.wave -= dt;
      const foes = [];
      if (b.acc >= 1) near(p.x, p.y, 170, e => { if (!e.hidden && Math.hypot(e.x - p.x, e.y - p.y) < 170) foes.push(e); });
      while (b.acc >= 1) {
        b.acc--; b.n++; b.ang += 0.5;
        const tg = foes.length && b.n % 3 ? foes[Math.floor(Math.random() * foes.length)] : null;
        const a = tg ? Math.atan2(tg.y - tg.sh.wh[1] * 0.45 * tg.scale - (p.y - 13), tg.x - p.x) + rand(-0.06, 0.06) : b.ang;
        shootBullet(a, b.dmg, 2, 'ult', { life: 0.55, big: true, boom: b.n % 6 === 0 });
        p.dir = dirOf(Math.cos(a), Math.sin(a));      // 쏘는 쪽으로 몸을 돌림(빙글빙글)
        burst(p.x + Math.cos(a) * 9, p.y - 12 + Math.sin(a) * 7, 2, ['#fff2b0', '#ffb04a'], { spd: [30, 70], up: [0, 10], life: [0.08, 0.16], z: 12 });   // 총구 불꽃
        if (b.n % 3 === 0) burst(p.x, p.y, 1, ['#ffd34a'], { spd: [20, 40], up: [40, 70], g: 320, life: [0.4, 0.6] });   // 튀는 탄피
        if (b.n % 2) sfx('gun');
      }
      if (b.wave <= 0) {                              // 둘레를 밀어내는 충격파
        b.wave = 0.5;
        shockAt(p.x, p.y, 56, '#ffb070', 0.35);
        near(p.x, p.y, 72, e => { const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1; if (l < 56 + e.r) hurtEnemy(e, b.dmg * 0.6, dx / l * 140, dy / l * 140, 'ult'); });
      }
      if (b.t <= 0) {                                 // 끝: 큰 폭발
        blastAt(p.x, p.y, b.r, b.dmg * 3, 'ult', '#ffb070');
        flashScreen('#fff0c8', 0.3); G.shake = Math.max(G.shake, 0.25); sfx('slam');
        G.barrage = null;
      }
    }
    if (G.blizzard) {                                 // 눈보라
      const z = G.blizzard;
      z.t -= dt; z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = D.ULTS.blizzard.tick;
        near(p.x, p.y, z.r + 16, e => {
          if (Math.hypot(e.x - p.x, (e.y - p.y) / SQ) > z.r + e.r) return;
          hurtEnemy(e, z.dmg, 0, 0, 'ult');
          e.slow = Math.max(e.slow, 0.6);
          if (z.freeze && !e.boss) e.freeze = Math.max(e.freeze, 0.4);
        });
        sfx('frost');
      }
      if (z.t <= 0) G.blizzard = null;
    }
    updAbilities(dt);
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      updEnemy(e, dt);
      e.x += e.kx * dt; e.y += e.ky * dt;
      e.kx *= 0.84; e.ky *= 0.84;
      if (!e.fly && !e.leap && !e.charge && !e.m.fly) {
        const hit = solve(e, e.r * 0.8);
        if (hit && e.st === 'move' && !e.boss) {
          const dx = p.x - e.x, dy = p.y - e.y;
          let tx = -hit.y, ty = hit.x;
          if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; }
          const tl = Math.hypot(tx, ty) || 1;
          e.x += tx / tl * e.speed * dt * 0.9; e.y += ty / tl * e.speed * dt * 0.9;
        }
      }
      const cell = grid.get(Math.floor(e.x / GC) * 100003 + Math.floor(e.y / GC));
      if (cell && cell.length > 1 && !e.boss) for (const o of cell) {
        if (o === e || o.boss) continue;
        const ox = e.x - o.x, oy = e.y - o.y, d2 = ox * ox + oy * oy, rr = e.r + o.r;
        if (d2 > 0.01 && d2 < rr * rr) { const d = Math.sqrt(d2), push = (rr - d) * 0.3 / d; e.x += ox * push; e.y += oy * push; }
      }
      if (!e.boss && !e.goblin && Math.hypot(p.x - e.x, p.y - e.y) > Math.hypot(VW, VH) * 1.1) {
        if (e.elite) { const c = spawnRing(); e.x = c.x; e.y = c.y; e.st = 'move'; e.fly = null; e.z = 0; }   // 정예는 버리지 않고 화면 가까이로
        else { e.hp = 0; e.gone = true; }
      }
    }
    G.enemies = G.enemies.filter(e => e.hp > 0);
    // 주인공 탄(검기·화살·총알·마법탄·얼음 조각·비수) — 지나가는 항아리도 깸(탄은 그대로 날아감)
    const potsNear = [];
    {
      const cx = Math.floor(p.x / CHUNK), cy = Math.floor(p.y / CHUNK);
      for (let gx = cx - 2; gx <= cx + 2; gx++) for (let gy = cy - 2; gy <= cy + 2; gy++)
        for (const o of chunkInfo(gx, gy).solid) if (o.kind === 'pot' && !o.gone) potsNear.push(o);
    }
    for (const b of G.pproj) {
      b.life -= dt;
      if (b.home && b.home.hp > 0) {                  // 마법탄·추적 화살·비전 구슬: 겨눈 적 쪽으로 조금씩 꺾임(turn = 초당 꺾는 각)
        const h = b.home, want = Math.atan2(h.y - h.sh.wh[1] * 0.45 * h.scale - b.y, h.x - b.x), cur = Math.atan2(b.vy, b.vx);
        const tr = (b.turn || D.MAGIC.turn) * dt, na = cur + Math.max(-tr, Math.min(tr, angDiff(want, cur))), sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
      if (b.axe) {                                    // 회전 도끼: 나갈수록 느려지다 끝(또는 기둥)에서 돌아옴 · 돌아올 땐 점점 빨라져 주인공에게 꽂힘
        if (!b.back) {
          const v = 260 * Math.max(0.25, 1 - b.d / b.out);
          b.vx = Math.cos(b.ang) * v; b.vy = Math.sin(b.ang) * v; b.d += v * dt;
          if (b.d >= b.out || pillarAt(b.x, b.y + 8)) { b.back = true; b.hit.clear(); }
        } else {
          const dx = p.x - b.x, dy = p.y - 12 - b.y, l = Math.hypot(dx, dy) || 1, v = Math.min(340, 120 + (b.bt = (b.bt || 0) + dt) * 520);
          b.vx = dx / l * v; b.vy = dy / l * v;
          if (l < 10) b.life = 0;
        }
        b.spin += dt * 18;
      }
      if (b.tw) {                                     // 회오리: 굽이치며 나감(진화 = 몸 둘레를 돎) · 둘레 적을 가운데로 끌어당김 · 0.25초마다 다시 벰
        if (b.orbit !== undefined) { b.orbit += 1.7 * dt; b.vx = (p.x + Math.cos(b.orbit) * 64 - b.x) / Math.max(dt, 0.001); b.vy = (p.y - 10 + Math.sin(b.orbit) * 52 - b.y) / Math.max(dt, 0.001); }
        else { b.ang += Math.sin(G.t * 3 + b.wob) * 1.6 * dt; b.vx = Math.cos(b.ang) * 55; b.vy = Math.sin(b.ang) * 55; }
        b.tick -= dt;
        if (b.tick <= 0) { b.tick = 0.25; b.hit.clear(); }
        near(b.x, b.y + 10, b.r * 2.4, e => {
          if (e.boss) return;
          const dx = b.x - e.x, dy = b.y + 10 - e.y, l = Math.hypot(dx, dy);
          if (l > b.r * 2.4 || l < 2) return;
          const pull = Math.min(1, 3.5 * dt);
          e.x += dx * pull; e.y += dy * pull;
        });
        if (Math.random() < dt * 14) burst(b.x, b.y + 10, 1, ['#a89878', '#8a8296', '#d8d0c0'], { spd: [20, 50], up: [10, 40], life: [0.3, 0.5] });
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      near(b.x, b.y + 10, b.r + 20, e => {
        if (b.life <= 0 || b.hit.has(e.id)) return;
        if (Math.hypot(e.x - b.x, e.y - e.sh.wh[1] * 0.45 * e.scale - b.y) > b.r + e.r) return;
        if (b.aoe) { b.life = 0; return; }            // 터지는 탄은 아래에서 한 번에
        b.hit.add(e.id);
        const l = Math.hypot(b.vx, b.vy) || 1, kb = b.tw ? 0 : 50;   // 회오리는 밀지 않고 끌어당김(위)
        hurtEnemy(e, b.dmg, b.vx / l * kb, b.vy / l * kb, b.kind);
        if (b.boom) { b.boom = false; blastAt(e.x, e.y, 22 * (1 + G.st.area), b.dmg * 0.8, 'ult', '#ff8a3a'); }   // 총알 폭풍 폭발탄(처음 맞은 자리에서 한 번)
        if (b.k === 'arrow' && b.kind === 'atk' && G.uniq.has('blastarrow')) blastAt(e.x, e.y, 18 * (1 + G.st.area), b.dmg * 0.5, 'abil', '#ffb070');   // 폭발 화살(전설)
        if (b.star) blastAt(e.x, e.y, 16 * (1 + G.st.area), b.dmg * 0.35, 'abil', '#fff2a0');   // 별빛 사냥(진화): 맞은 자리 작게 터짐
        if (--b.pierce < 0) b.life = 0;
      });
      if (b.k !== 'wave' && !b.axe && !b.tw && pillarAt(b.x, b.y + 8)) b.life = 0;   // 검기·도끼·회오리는 기둥에 안 막힘(도끼는 위에서 되돌아옴)
      for (const o of potsNear) if (!o.gone && Math.hypot(o.x - b.x, o.y - 12 - b.y) < (b.r || 4) + 7) smashPot(o);   // 탄 높이(몸 가운데) 기준 · 적 맞히는 식과 같은 꼴
      if (b.aoe && b.life <= 0 && !b.done) {
        b.done = true; blastAt(b.x, b.y + 10, b.aoe, b.dmg, b.kind, b.c); sfx('hit');
        if (b.kind === 'atk' && G.uniq.has('chainbolt')) {                   // 연쇄 번개(전설): 터진 자리 가까운 적 둘
          const bx = b.x, by = b.y + 10, hits = [];
          near(bx, by, 80, e => { if (hits.length < 2 && Math.hypot(e.x - bx, e.y - by) < 80) hits.push(e); });
          for (const e of hits) { G.fx.push({ k: 'chain', x: bx, y: by - 6, x2: e.x, y2: e.y - 8, t: 0, dur: 0.2 }); hurtEnemy(e, b.dmg * 0.6, 0, 0, 'abil'); }
        }
      }
    }
    G.pproj = G.pproj.filter(b => b.life > 0);
    // 적 탄
    for (const b of G.eproj) {
      b.life -= dt;
      if (b.ret && b.life < 1.1) {                    // 돌아오는 도끼
        const dx = b.ret.x - b.x, dy = b.ret.y - 10 - b.y, l = Math.hypot(dx, dy) || 1;
        b.vx = dx / l * 160; b.vy = dy / l * 160;
        if (l < 12 || b.ret.hp <= 0) b.dead = true;
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.spin += dt * 14;
      if (Math.hypot(p.x - b.x, p.y - 12 - b.y) < b.r + p.r) { if (hurtPlayer(b.dmg)) b.dead = true; }
      if (pillarAt(b.x, b.y + 6)) b.dead = true;
    }
    G.eproj = G.eproj.filter(b => !b.dead && b.life > 0);
    // 경험치·금화·떨어진 것
    const pick2 = (D.PICKUP * (1 + G.st.pickup)) ** 2;
    for (const g of G.gems) {
      const d2 = dist2(g, p);
      if (d2 < pick2) g.pull = true;
      if (g.pull) { const l = Math.sqrt(d2) || 1, v = G.cleared ? 400 : 190; g.x += (p.x - g.x) / l * v * dt; g.y += (p.y - g.y) / l * v * dt; }
      if (d2 < 64) { g.got = true; gainXp(g.v); sfx('gem'); }
    }
    G.gems = G.gems.filter(g => !g.got);
    if (G.gems.length > 400) {                        // 너무 많이 깔리면 오래된 100개를 큰 보석 하나로(뱀서처럼)
      const old = G.gems.splice(0, 100);
      G.gems.push({ x: old[0].x, y: old[0].y, v: old.reduce((a, g) => a + g.v, 0), pull: false });
    }
    for (const c of G.coins) {
      const d2 = dist2(c, p);
      if (d2 < pick2) c.pull = true;
      if (c.pull) { const l = Math.sqrt(d2) || 1, v = G.cleared ? 400 : 200; c.x += (p.x - c.x) / l * v * dt; c.y += (p.y - c.y) / l * v * dt; }
      if (d2 < 64) { c.got = true; addGold(c.v); }
    }
    G.coins = G.coins.filter(c => !c.got);
    for (const d of G.drops) {
      d.t += dt;
      if (d.t < 0.3 || dist2(d, p) > 196) continue;
      d.got = true;
      if (d.k === 'potion') { heal(p.maxHp * D.HEAL_PCT); G.fx.push({ k: 'sparkle', x: p.x, y: p.y - 18, t: 0, dur: 0.6, c: '#9dffc0' }); }
      else if (d.k === 'magnet') {                    // 자석(10-22 «보스 잡을 때 일정 확률로»): 바닥의 경험치 보석·금화를 전부 끌어옴
        for (const g of G.gems) g.pull = true;
        for (const c of G.coins) c.pull = true;
        G.fx.push({ k: 'shock', x: p.x, y: p.y - 6, r: 90, t: 0, dur: 0.5, c: '#9ae6ff' });
        sfx('legend'); hooks.toast && hooks.toast('자석! 보석과 금화를 끌어온다');
      }
      else if (d.k === 'chest') { sfx('chest'); queuePanel({ k: 'chest', n: d.n }); }
      else if (d.k === 'item') {
        G.bag.push(d.item);
        sfx(d.item.rar >= 2 ? 'legend' : 'card');
        const slots = Object.keys(D.SLOTS), i = slots.indexOf(d.item.slot), on = betterThan(d.item, G.worn[i]);
        if (on) wear(d.item);                         // 칸이 비었거나 지금 것보다 좋으면 바로 낌(아니면 «끼기» 버튼)
        hooks.item && hooks.item(G, d.item, on);
      }
    }
    G.drops = G.drops.filter(d => !d.got);
    G.buff.fury = Math.max(0, G.buff.fury - dt); G.buff.swift = Math.max(0, G.buff.swift - dt);
    {                                                 // 제단 밟기 · 항아리는 몸으로 부딪혀도 깨짐(멀리 쏘는 직업도 걸어가 깰 수 있게)
      const cx = Math.floor(p.x / CHUNK), cy = Math.floor(p.y / CHUNK);
      for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++)
        for (const o of chunkInfo(gx, gy).solid) {
          if (o.kind === 'shrine' && !o.used && Math.hypot(o.x - p.x, (o.y - p.y) / SQ) < 12) useShrine(o);
          else if (o.kind === 'pot' && !o.gone && Math.hypot(o.x - p.x, (o.y - p.y) / SQ) < 11) smashPot(o);
        }
    }
    for (const gh of G.ghosts) gh.t += dt;
    G.ghosts = G.ghosts.filter(gh => gh.t < 0.3);
  }
  function sim(sec, bot) {                            // 시험: sec 초를 한 번에(봇 이동 · 창·알림 끔 · 카드는 아무거나)
    const saved = hooks;
    hooks = {}; simming = true;
    try { for (let i = 0, n = Math.round(sec / STEP); i < n && !G.over && !G.done; i++) { botMove = bot ? bot(G) : null; G.paused = false; update(STEP); } }
    finally { botMove = null; hooks = saved; simming = false; }
    return G;
  }

  // ── 그리기
  // 번쩍임용 한 색 칸은 처음 쓸 때 만듦 — 필살로 수십 마리가 한꺼번에 번쩍이면 한 프레임에 캔버스 수십 개가 생겨 폰에서 끊겼음(10-22)
  //   → budget 이면 프레임마다 새로 만드는 수를 6 개로(나머지는 다음 프레임에 · 번쩍임은 0.1초라 거의 티 안 남)
  let tintNew = 0;
  function tinted(im, sx, sy, w, h, color, budget) {
    const key = im.src + '|' + sx + '|' + sy + '|' + color;
    let c = tintCache.get(key);
    if (!c) {
      if (budget && tintNew >= 6) return null;
      tintNew++;
      c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(im, sx, sy, w, h, 0, 0, w, h);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
      tintCache.set(key, c);
      if (tintCache.size > 700) tintCache.delete(tintCache.keys().next().value);
    }
    return c;
  }
  // 반투명 칸(젤리)의 테두리: 4방향으로 겹친 실루엣에서 몸 자리를 도려냄 — 그냥 겹치면 테두리 색이 투명한 몸속으로 비침
  function ringed(im, sx, sy, w, h, color) {
    const key = 'ring|' + im.src + '|' + sx + '|' + sy + '|' + color;
    let c = tintCache.get(key);
    if (!c) {
      const t = tinted(im, sx, sy, w, h, color);
      c = document.createElement('canvas'); c.width = w + 2; c.height = h + 2;
      const g = c.getContext('2d');
      for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(t, ox, oy);
      g.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 4; i++) g.drawImage(im, sx, sy, w, h, 1, 1, w, h);   // 반투명 몸도 네 번 지우면 거의 다 지워짐
      tintCache.set(key, c);
      if (tintCache.size > 700) tintCache.delete(tintCache.keys().next().value);
    }
    return c;
  }
  // 시트 한 칸: row(방향) · col · 발 자리 · scale · flash(흰) · alpha · tint · outline(테두리 색)
  function drawCell(sh, row, col, x, y, o) {
    const im = img(sh.file);
    if (!ready(im)) return;
    o = o || {};
    const k = o.scale || 1, [cw, ch] = sh.cell, sx = col * cw, sy = row * ch;
    const dw = Math.round(cw * k), dh = Math.round(ch * k);
    const dx = Math.round(x - sh.foot[0] * k), dy = Math.round(y - sh.foot[1] * k - (o.z || 0));
    if (o.outline) {
      ctx.globalAlpha = o.oa || 0.9;
      if (sh.glass) ctx.drawImage(ringed(im, sx, sy, cw, ch, o.outline), dx - k, dy - k, dw + 2 * k, dh + 2 * k);
      else {
        const t = tinted(im, sx, sy, cw, ch, o.outline);
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(t, dx + ox, dy + oy, dw, dh);
      }
    }
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    const tt = o.tint && tinted(im, sx, sy, cw, ch, o.tint, true);
    if (tt) ctx.drawImage(tt, dx, dy, dw, dh);
    else ctx.drawImage(im, sx, sy, cw, ch, dx, dy, dw, dh);
    if (o.flash) {
      const ft = tinted(im, sx, sy, cw, ch, o.flashC || '#fff', true);
      if (ft) { ctx.globalAlpha = typeof o.flash === 'number' ? o.flash : 0.7; ctx.drawImage(ft, dx, dy, dw, dh); }
    }
    ctx.globalAlpha = 1;
  }
  function drawPiece(o, x, y, alpha) {
    const im = img(o.file);
    if (!ready(im)) return;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(im, o.x, o.y, o.cell[0], o.cell[1], Math.round(x - o.foot[0]), Math.round(y - o.foot[1]), o.cell[0], o.cell[1]);
    ctx.globalAlpha = 1;
  }
  function shadow(x, y, rx, a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, 7); ctx.fill(); }
  // 항아리: 글자 그림(D.POT_ART) → 던전 색으로 한 번 칠해 둔 캔버스 · 맨 아래 줄이 발
  const POT_CH = '.oDdmlhkbB', potCanvas = {};
  function potImg(v) {
    const key = G.dun.key + v;
    if (potCanvas[key]) return potCanvas[key];
    const rows = D.POT_ART.shapes[v], pal = D.POT_ART.pals[G.dun.key] || D.POT_ART.pals.crypt;
    const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length;
    const g = c.getContext('2d');
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const i = POT_CH.indexOf(row[x]); if (i > 0) { g.fillStyle = pal[i - 1]; g.fillRect(x, y, 1, 1); } } });
    return (potCanvas[key] = c);
  }
  function drawPot(o) {
    const im = potImg(o.v);
    shadow(o.x, o.y, im.width * 0.38, 0.3);
    ctx.drawImage(im, Math.round(o.x - im.width / 2), Math.round(o.y - im.height + 1));
  }
  function enemyCol(e) {
    const sh = e.sh, acts = sh.acts || {};
    // 예고(wind) = 시간에 맞춰 천천히 들어 올림 · 공격(act) = 빠르게 한 번 · 쉼(rec) = 거두기
    const run = (a, k) => a.col + (a.len > 1 ? Math.min(a.len - 1, Math.floor(k * a.len)) : 0);
    if (e.st === 'wind' && acts.wind) return run(acts.wind, e.stT / Math.max(0.01, e.windT || 1));
    if (e.st === 'act' && acts.act) return run(acts.act, e.stT / 0.22);
    if (e.st === 'rec' && acts.rec) return run(acts.rec, e.stT / Math.max(0.01, e.m.rec || 0.5));
    if (e.boss && (e.lock > 0 || e.leap) && acts.wind) return run(acts.wind, e.leap ? e.leap.t / e.leap.dur : 0.99);
    if (e.boss && (e.charge || e.whirl > 0) && acts.act) return run(acts.act, ((e.animT * 6) % 1));
    const n = sh.walk[1];
    return n <= 1 ? sh.stand : sh.walk[0] + (Math.floor(e.animT * (e.goblin ? 12 : 7)) % n);
  }
  function heroCol() {
    const p = G.p, h = G.H, row = ROWS.indexOf(p.dir);
    if (p.atk && h.acts[p.atk.act]) { const act = h.acts[p.atk.act]; return act.col + Math.min(act.len[row] - 1, p.atk.fi); }
    if (p.dash && p.dash.dodge) return h.walk[1];
    return p.moving ? h.walk[Math.floor(p.walkT * 8) % h.walk.length] : h.stand;
  }
  function sparkle(f) {
    const k = f.t / f.dur;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3, r = 4 + 14 * k * (0.6 + 0.4 * ((i * 37) % 5) / 5);
      const x = Math.round(f.x + Math.cos(a) * r), y = Math.round(f.y - 10 * k + Math.sin(a) * r * 0.6);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#ffffff' : f.c;
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
    ctx.globalAlpha = 1;
  }
  function drawTele(o) {                              // 바닥 예고: 빨강(보라 = 부르기) · 끝나갈수록 진하게 · 하얀 가장자리
    const k = o.t / o.dur, a = 0.18 + 0.32 * k, col = o.c === 'purple' ? '170,90,255' : '255,50,40';
    ctx.fillStyle = `rgba(${col},${a})`; ctx.strokeStyle = `rgba(255,${o.c === 'purple' ? 220 : 200},${o.c === 'purple' ? 255 : 190},${0.5 + 0.5 * k})`; ctx.lineWidth = 1;
    ctx.beginPath();
    if (o.k === 'circle') ctx.ellipse(o.x, o.y, o.r, o.r * 0.6, 0, 0, 7);
    else if (o.k === 'ring') { ctx.ellipse(o.x, o.y, o.r, o.r * 0.6, 0, 0, 7); ctx.stroke(); return; }
    else if (o.k === 'sector' || o.k === 'fan') { const h = o.arc * Math.PI / 360, a = sqAng(o.ang, SQ); ctx.moveTo(o.x, o.y); ctx.ellipse(o.x, o.y, o.r, o.r * SQ, 0, a - h, a + h); ctx.closePath(); }
    else if (o.k === 'line') {                        // 납작한 공간에서 폭 w 띠(돌진 몸통이 쓸고 가는 자리) → 다시 세상으로
      const ay = o.y / SQ, by = o.y2 / SQ, ang = Math.atan2(by - ay, o.x2 - o.x), nx = -Math.sin(ang) * o.w / 2, ny = Math.cos(ang) * o.w / 2;
      ctx.moveTo(o.x + nx, (ay + ny) * SQ); ctx.lineTo(o.x2 + nx, (by + ny) * SQ); ctx.lineTo(o.x2 - nx, (by - ny) * SQ); ctx.lineTo(o.x - nx, (ay - ny) * SQ); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    if (o.k === 'circle' || o.k === 'sector') {        // 차오르는 안쪽(얼마 남았나)
      ctx.fillStyle = `rgba(${col},0.25)`; ctx.beginPath();
      if (o.k === 'circle') ctx.ellipse(o.x, o.y, o.r * k, o.r * 0.6 * k, 0, 0, 7);
      else { const h = o.arc * Math.PI / 360, a = sqAng(o.ang, SQ); ctx.moveTo(o.x, o.y); ctx.ellipse(o.x, o.y, o.r * k, o.r * SQ * k, 0, a - h, a + h); ctx.closePath(); }
      ctx.fill();
    }
  }
  function drawEnemyTele(e) {                         // 일반 몬스터 예고(굼뜬 공격): 앞쪽 부채꼴 · 겨누는 선 · 떨어질 자리
    if (e.st !== 'wind') return;
    const m = e.m, k = Math.min(1, e.stT / Math.max(0.01, e.windT || m.windup));
    ctx.globalAlpha = 0.25 + 0.45 * k;
    ctx.fillStyle = 'rgba(255,60,40,0.5)'; ctx.strokeStyle = '#ffb0a0'; ctx.lineWidth = 1;
    if (m.atk === 'melee') {
      const h = m.arc * Math.PI / 360, ang = Math.atan2(e.ay, e.ax), r = m.range * e.scale + 6;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, r, ang - h, ang + h); ctx.closePath(); ctx.fill();
    } else if (m.atk === 'shoot') {
      ctx.setLineDash([3, 3]); ctx.strokeStyle = 'rgba(255,90,70,0.9)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y - 10); ctx.lineTo(e.x + e.ax * 60, e.y - 10 + e.ay * 60); ctx.stroke(); ctx.setLineDash([]);
    } else if (m.atk === 'slam' || m.atk === 'hop') {
      const r = (m.atk === 'slam' ? m.aoe : 10) * e.scale;
      ctx.beginPath(); ctx.ellipse(e.tx, e.ty, r, r * 0.6, 0, 0, 7); ctx.fill(); ctx.stroke();
    } else {                                          // 덮침·돌진: 몸 폭 띠(몸이 닿으면 맞음)
      ctx.lineWidth = e.r * 2; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,60,40,0.4)';
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.tx, e.ty); ctx.stroke(); ctx.lineCap = 'butt';
    }
    ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  function drawChest(d) {
    const bob = Math.round(Math.sin(d.t * 4) * 1.5), x = Math.round(d.x), y = Math.round(d.y) + bob;
    const big = d.n > 1;
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(G.t * 5); ctx.fillStyle = big ? '#ffd36a' : '#ffe6a0';
    ctx.beginPath(); ctx.ellipse(x, y - 4, big ? 18 : 12, big ? 10 : 7, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    const w = big ? 16 : 12, h = big ? 11 : 9;
    ctx.fillStyle = '#2a1608'; ctx.fillRect(x - w / 2 - 1, y - h - 1, w + 2, h + 2);
    ctx.fillStyle = big ? '#7a2e9a' : '#8a4a1e'; ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = big ? '#a64ad0' : '#b06a2a'; ctx.fillRect(x - w / 2, y - h, w, 3);
    ctx.fillStyle = '#ffd34a'; ctx.fillRect(x - w / 2, y - h + 3, w, 1); ctx.fillRect(x - 1, y - h + 2, 3, 4);
    if (Math.floor(G.t * 6) % 6 < 2) { ctx.fillStyle = '#fffbe0'; ctx.fillRect(x + w / 2 - 2, y - h - 3, 1, 3); ctx.fillRect(x + w / 2 - 3, y - h - 2, 3, 1); }
  }
  function drawMagnet(d) {                            // 자석(빨강 U · 은빛 끝 · 하늘색 빛)
    const bob = Math.round(Math.sin(d.t * 4) * 1.5), x = Math.round(d.x), y = Math.round(d.y) + bob;
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(G.t * 6); ctx.fillStyle = '#9ae6ff';
    ctx.beginPath(); ctx.ellipse(x, y - 5, 11, 7, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#2b1a2a'; ctx.fillRect(x - 6, y - 12, 12, 11);
    ctx.fillStyle = '#d83a3a'; ctx.fillRect(x - 5, y - 11, 3, 8); ctx.fillRect(x + 2, y - 11, 3, 8); ctx.fillRect(x - 5, y - 5, 10, 3);
    ctx.fillStyle = '#ff7a6a'; ctx.fillRect(x - 5, y - 11, 1, 6); ctx.fillRect(x + 2, y - 11, 1, 6);
    ctx.fillStyle = '#2b1a2a'; ctx.fillRect(x - 2, y - 11, 4, 6);                   // 가운데 빈 곳
    ctx.fillStyle = '#e8eef8'; ctx.fillRect(x - 5, y - 12, 3, 2); ctx.fillRect(x + 2, y - 12, 3, 2);   // 은빛 끝
    if (Math.floor(G.t * 6) % 6 < 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 6, y - 14, 1, 3); ctx.fillRect(x + 5, y - 13, 3, 1); }
  }
  function drawShrine(o) {                            // 제단: 돌 받침 + 불꽃(쓰면 꺼짐)
    const x = Math.round(o.x), y = Math.round(o.y), c = SHRINE[o.type].c;
    if (!o.used) { ctx.globalAlpha = 0.22 + 0.1 * Math.sin(G.t * 4 + x); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y - 1, 13, 6, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.fillStyle = '#2b1a2a'; ctx.fillRect(x - 7, y - 9, 14, 9); ctx.fillRect(x - 5, y - 13, 10, 5);
    ctx.fillStyle = '#6e6a80'; ctx.fillRect(x - 6, y - 8, 12, 7); ctx.fillStyle = '#9894a8'; ctx.fillRect(x - 6, y - 8, 12, 2);
    ctx.fillStyle = '#56526a'; ctx.fillRect(x - 4, y - 12, 8, 4); ctx.fillStyle = '#8a86a0'; ctx.fillRect(x - 4, y - 12, 8, 1);
    ctx.fillStyle = c; ctx.fillRect(x - 1, y - 6, 2, 3);                          // 새김 무늬
    if (o.used) return;
    const f = Math.floor(G.t * 10 + x) % 3;                                          // 불꽃(세 장 깜빡임)
    ctx.fillStyle = c; ctx.fillRect(x - 2, y - 17 + (f === 1 ? 1 : 0), 4, 5); ctx.fillRect(x - 1, y - 20 + f, 2, 3);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 16, 2, 2);
  }
  const RAR_C = ['#d8d6de', '#5a9cff', '#ffd84a', '#ff8a2a'];
  function drawItemDrop(d) {
    const it = d.item, x = Math.round(d.x), y = Math.round(d.y), c = RAR_C[it.rar];
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(G.t * 6); ctx.fillStyle = c;   // 등급 빛기둥
    ctx.fillRect(x - 2, y - 40, 4, 40); ctx.globalAlpha = 1;
    drawIcon(it.icon, x, y - 6, c);
  }
  function drawIcon(icon, x, y, c) {                  // 작은 아이템 그림(코드로 그림)
    ctx.fillStyle = '#140c14';
    if (icon === 'sword') { ctx.fillRect(x - 1, y - 7, 3, 11); ctx.fillStyle = '#d8dce8'; ctx.fillRect(x, y - 6, 1, 8); ctx.fillStyle = c; ctx.fillRect(x - 2, y + 2, 5, 1); ctx.fillRect(x, y + 3, 1, 2); }
    else if (icon === 'bow') { ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x - 2, y - 1, 6, -1.2, 1.2); ctx.stroke(); ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 0.5, y - 7); ctx.lineTo(x + 0.5, y + 5); ctx.stroke(); }
    else if (icon === 'gun') { ctx.fillRect(x - 5, y - 5, 11, 4); ctx.fillRect(x - 4, y - 2, 4, 6); ctx.fillStyle = '#9aa0b4'; ctx.fillRect(x - 4, y - 4, 9, 2); ctx.fillStyle = c; ctx.fillRect(x - 3, y - 1, 2, 4); }
    else if (icon === 'staff') { ctx.fillRect(x - 1, y - 6, 3, 12); ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x, y - 4, 1, 9); ctx.fillStyle = c; ctx.fillRect(x - 2, y - 8, 5, 4); ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 7, 1, 1); }
    else if (icon === 'armor') { ctx.fillRect(x - 5, y - 6, 11, 10); ctx.fillStyle = c; ctx.fillRect(x - 4, y - 5, 9, 8); ctx.fillStyle = '#140c14'; ctx.fillRect(x, y - 5, 1, 8); }
    else if (icon === 'ring') { ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 1, 3.5, 0, 7); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 6, 2, 2); }
    else { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 4, 4, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.fillStyle = c; ctx.fillRect(x - 2, y - 1, 4, 4); }
  }

  // 피해 숫자판: 글자 크기·테두리·색마다 한 장(0~9 ! + −) — 숫자 하나 = drawImage 몇 번
  const numAtlases = new Map(), NUM_CH = '0123456789!+-';
  function numAtlas(px, lw, color) {
    const key = px + '|' + lw + '|' + color;
    let a = numAtlases.get(key);
    if (a) return a;
    if (numAtlases.size > 40) numAtlases.clear();       // 화면 크기가 바뀌면 옛 판은 버림
    const c = document.createElement('canvas'), g = c.getContext('2d'), font = `bold ${px}px sans-serif`, pad = Math.ceil(lw / 2) + 1;
    g.font = font;
    const xs = [], ws = [];
    let x = 0;
    for (const ch of NUM_CH) { const w = Math.ceil(g.measureText(ch).width); xs.push(x); ws.push(w); x += w + pad * 2; }
    c.width = Math.max(1, x); c.height = Math.ceil(px * 1.25) + pad * 2;
    g.font = font; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = '#000'; g.fillStyle = color;
    [...NUM_CH].forEach((ch, i) => { g.strokeText(ch, xs[i] + pad, c.height / 2); g.fillText(ch, xs[i] + pad, c.height / 2); });
    a = { c, xs, ws, pad, h: c.height, idx: Object.fromEntries([...NUM_CH].map((ch, i) => [ch, i])) };
    numAtlases.set(key, a);
    return a;
  }
  function drawNum(str, x, y, px, lw, color, k) {     // x = 가운데 · y = 세로 가운데 · k = 튀어 오르는 배율
    const a = numAtlas(px, lw, color);
    let w = 0;
    for (const ch of str) { const i = a.idx[ch]; if (i !== undefined) w += a.ws[i]; }
    let cx = x - w * k / 2;
    for (const ch of str) {
      const i = a.idx[ch];
      if (i === undefined) continue;
      const sw = a.ws[i] + a.pad * 2;
      ctx.drawImage(a.c, a.xs[i], 0, sw, a.h, Math.round(cx - a.pad * k), Math.round(y - a.h * k / 2), Math.round(sw * k), Math.round(a.h * k));
      cx += a.ws[i] * k;
    }
  }
  function render() {
    if (!cv) return;
    const LW = Math.ceil(VW), LH = Math.ceil(VH);
    if (!low || low.width !== LW || low.height !== LH) { low = document.createElement('canvas'); low.width = LW; low.height = LH; lctx = low.getContext('2d'); }
    scr.setTransform(1, 0, 0, 1, 0, 0);
    if (!G) { scr.fillStyle = '#0c0a10'; scr.fillRect(0, 0, cv.width, cv.height); return; }
    tintNew = 0;
    ctx = lctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0a10'; ctx.fillRect(0, 0, LW, LH);
    const p = G.p;
    // 멈춘 동안(레벨 업·상자 창·일시 정지)엔 흔들지 않음 — 10-22 사용자 «선택지 고를 때 화면이 흔들려 어지러움»(멈추면 shake 가 줄지 않아 창 내내 흔들렸음)
    const shk = G.shake > 0 && !G.paused && !G.over && !G.done;
    const sh = shk ? Math.round(rand(-2, 2)) : 0, sv = shk ? Math.round(rand(-2, 2)) : 0;
    const ox = Math.floor(VW / 2 - p.x) + sh, oy = Math.floor(VH / 2 - p.y + 12) + sv;
    const cx0 = Math.floor(-ox / CHUNK), cy0 = Math.floor(-oy / CHUNK);
    for (let cy = cy0; cy * CHUNK + oy < VH; cy++) for (let cx = cx0; cx * CHUNK + ox < VW; cx++) {
      const c = chunk(cx, cy);
      if (c) ctx.drawImage(c, cx * CHUNK + ox, cy * CHUNK + oy);
    }
    ctx.save(); ctx.translate(ox, oy);
    const inView = (x, y, m) => Math.abs(x - p.x) < VW / 2 + m && Math.abs(y - p.y) < VH / 2 + m + 12;
    // 바닥: 보스 예고 · 필살·레벨 업 · 먼지 · 화살비 그림자
    for (const o of G.tele) if (inView(o.x, o.y, (o.r || 120) + 20)) drawTele(o);
    for (const f of G.fx) {
      const k = f.t / f.dur;
      if (f.k === 'storm') {
        ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = '#9ad8ff';
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 8, f.r * (0.4 + 0.6 * k), f.r * 0.62 * (0.4 + 0.6 * k), 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.k === 'lvup') {
        ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 1, 10 + 20 * k, 4 + 8 * k, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.k === 'shards') {                  // 깨진 항아리 조각: 바닥에 잠깐 남았다가 끝 30% 동안 사라짐
        ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3;
        for (let i = 0; i < 6; i++) {
          const a = f.seed + i * 2.1, d = 3 + (i * 5 + f.seed) % 7;
          ctx.fillStyle = f.c[i % f.c.length];
          ctx.fillRect(Math.round(f.x + Math.cos(a) * d), Math.round(f.y - 1 + Math.sin(a) * d * 0.45), i % 3 ? 2 : 3, i % 2 ? 1 : 2);
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'dust') {
        ctx.globalAlpha = 0.45 * (1 - k); ctx.fillStyle = '#b8aec8';
        for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.ellipse(f.x + i * (4 + 8 * k), f.y - 1, 3 + 2 * k, 1.5 + k, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (f.k === 'rain') {
        ctx.globalAlpha = 0.18; ctx.fillStyle = '#ffe6a0';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.k === 'nova') {                    // 서리 고리(10-22 화려하게): 처음 번쩍 + 빠르게 퍼지는 빛 고리(더하기) + 고리를 따라 솟은 얼음 조각 열둘
        const rr = f.r * Math.sqrt(k), ry = rr * 0.6, yy = f.y + 6;
        ctx.globalCompositeOperation = 'lighter';
        if (k < 0.3) { ctx.globalAlpha = 0.5 * (1 - k / 0.3); ctx.fillStyle = '#bfefff'; ctx.beginPath(); ctx.ellipse(f.x, yy, f.r * 0.45, f.r * 0.27, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = '#5ac8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(f.x, yy, rr, ry, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(160,220,255,0.12)'; ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1 - k * 0.8;
        for (let i = 0; i < 12; i++) {
          const an = i * Math.PI / 6 + 0.3, x = f.x + Math.cos(an) * rr, y = yy + Math.sin(an) * ry, h = 3 + (i % 3) * 2;
          ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x + 2, y); ctx.lineTo(x, y + 1); ctx.lineTo(x - 2, y); ctx.fill();
          ctx.fillStyle = '#5ac8ff'; ctx.fillRect(Math.round(x), Math.round(y - h + 2), 1, h - 2);
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'mark') {                    // 우리 편 범위 표시(메테오): 주황 점선 원이 좁혀짐
        ctx.globalAlpha = 0.5 + 0.4 * k; ctx.strokeStyle = '#ffb04a'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * SQ, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,150,60,0.15)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * k, f.r * SQ * k, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.k === 'fire') {                    // 불바다
        ctx.globalAlpha = 0.3 * (1 - k * 0.5); ctx.fillStyle = '#ff6a2a';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * SQ, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        for (let i = 0; i < 14; i++) {
          const a = i * 2.4 + Math.floor(G.t * 8) * 0.7, rr = f.r * (((i * 37) % 10) / 10), x = Math.round(f.x + Math.cos(a) * rr), y = Math.round(f.y + Math.sin(a) * rr * SQ);
          ctx.fillStyle = i % 3 ? '#ff8a2a' : '#ffe06a'; ctx.fillRect(x, y - 2 - (i + Math.floor(G.t * 10)) % 3, 1, 2);
        }
      } else if (f.k === 'miasma') {                  // 독 안개: 바닥에 퍼진 초록 구름(뭉게뭉게 돎) + 올라가는 거품 · 진화(역병)는 몸을 따라다님
        const fin = Math.min(1, f.t / 0.3), fade = f.dur > 1e8 ? 1 : Math.min(1, (f.dur - f.t) / 0.5), r = f.r * (0.6 + 0.4 * fin), sd = f.seed || 0;
        ctx.globalAlpha = 0.26 * fade; ctx.fillStyle = '#4ab02a';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, r, r * SQ, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = '#8ef05a';
        for (let i = 0; i < 6; i++) { const an = i * 1.05 + G.t * 0.9 + sd, rr = r * 0.5; ctx.beginPath(); ctx.ellipse(f.x + Math.cos(an) * rr, f.y + Math.sin(an) * rr * SQ, r * 0.4, r * 0.4 * SQ, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = '#d8ffb0';
        for (let i = 0; i < 7; i++) { const ph = (G.t * 1.2 + i * 0.37 + sd) % 1, an = i * 2.4 + sd; ctx.fillRect(Math.round(f.x + Math.cos(an) * r * 0.65), Math.round(f.y + Math.sin(an) * r * 0.65 * SQ - ph * 12), 1, ph < 0.8 ? 1 : 2); }
        ctx.globalAlpha = 1;
      } else if (f.k === 'crack') {                   // 대지 가르기: 바닥 금(짙은 테 + 빛나는 속) — 바위가 솟는 만큼 열리고 서서히 닫힘
        const reach = f.len * Math.min(1, f.t / f.open), fade = f.t < f.open ? 1 : 1 - (f.t - f.open) / (f.dur - f.open);
        ctx.beginPath(); ctx.moveTo(f.x, f.y);
        for (let i = 1, d = 7; d - 7 < reach; i++, d += 7) {
          const dd = Math.min(d, reach), j = f.jit[i] || 0;
          ctx.lineTo(f.x + f.ca * dd - f.sa * j, f.y + f.sa * dd + f.ca * j);
        }
        const w = f.w || 2;
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.7 * fade; ctx.strokeStyle = '#2a2230'; ctx.lineWidth = w + 2; ctx.stroke();
        ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = f.c1 || '#9ae6ff'; ctx.lineWidth = w; ctx.stroke();
        if (fade > 0.6) { ctx.strokeStyle = f.c2 || '#ffffff'; ctx.lineWidth = 1; ctx.stroke(); }
        ctx.lineJoin = 'miter'; ctx.globalAlpha = 1;
      }
    }
    if (G.blizzard) {                                 // 눈보라: 둘레 푸른 원 + 흩날리는 눈
      const z = G.blizzard, a = Math.min(1, z.t * 2);
      ctx.globalAlpha = 0.16 * a; ctx.fillStyle = '#bfe8ff';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, z.r, z.r * SQ, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 0.8 * a;
      for (let i = 0; i < 46; i++) {
        const an = i * 2.39996 + G.t * (1.5 + (i % 3)), rr = z.r * Math.sqrt(((i * 53) % 100) / 100);
        const x = Math.round(p.x + Math.cos(an) * rr), y = Math.round(p.y - 14 + Math.sin(an) * rr * SQ + ((G.t * 30 + i * 7) % 20) - 10);
        ctx.fillStyle = i % 4 ? '#ffffff' : '#9adcff'; ctx.fillRect(x, y, i % 5 ? 1 : 2, 1);
      }
      ctx.globalAlpha = 1;
    }
    for (const g of G.gems) {
      if (!inView(g.x, g.y, 8)) continue;
      ctx.fillStyle = g.v >= 8 ? '#ff5a6a' : g.v >= 3 ? '#4fe08a' : '#58b8ff';
      const x = Math.round(g.x), y = Math.round(g.y);
      ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2, 1, 1);
    }
    for (const c of G.coins) {
      if (!inView(c.x, c.y, 8)) continue;
      const x = Math.round(c.x), y = Math.round(c.y), f = Math.floor(G.t * 8 + c.x) % 4;
      ctx.fillStyle = '#7a4a08'; ctx.fillRect(x - 2, y - 3, f === 2 ? 2 : 4, 5);
      ctx.fillStyle = '#ffd34a'; ctx.fillRect(x - 1, y - 3, f === 2 ? 1 : 2, 4);
    }
    for (const d of G.drops) {
      if (!inView(d.x, d.y, 30)) continue;
      if (d.k === 'potion') { shadow(d.x, d.y, 4, 0.3); drawPiece(A.items.potion, d.x, d.y - 2 + Math.round(Math.sin(d.t * 4) * 1.5)); }
      else if (d.k === 'magnet') drawMagnet(d);
      else if (d.k === 'chest') drawChest(d);
      else if (d.k === 'item') drawItemDrop(d);
    }
    if (dest) {
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 10); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(dest.x, dest.y, 6, 3, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const f of G.fx) if (f.k === 'after') drawCell(G.H, ROWS.indexOf(f.dir), f.col, f.x, f.y, { alpha: 0.45 * (1 - f.t / f.dur), tint: '#8fd8ff' });
    for (const e of G.enemies) if (inView(e.x, e.y, 60)) drawEnemyTele(e);
    // 적·주인공·기둥·장식(발 높이 순)
    const list = G.enemies.filter(e => inView(e.x, e.y, 70));
    list.push(p);
    for (let cy = Math.floor((p.y - VH / 2 - 60) / CHUNK); cy * CHUNK < p.y + VH / 2 + 80; cy++)
      for (let cx = Math.floor((p.x - VW / 2 - 60) / CHUNK); cx * CHUNK < p.x + VW / 2 + 60; cx++)
        for (const o of chunkInfo(cx, cy).solid) if (!o.gone && inView(o.x, o.y, 50)) list.push(o);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e === p) {
        shadow(p.x, p.y - 1, 8, 0.32);
        if (!(p.hurtT > 0 && Math.floor(p.hurtT * 30) % 2)) drawCell(G.H, ROWS.indexOf(p.dir), heroCol(), p.x, p.y, { z: p.hop, alpha: p.inv > 0 && p.dash && p.dash.dodge ? 0.75 : 1 });
      } else if (e.kind === 'pillar') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(e.x0 + 2), Math.round(e.y1 - 1), e.x1 - e.x0, 4);
        drawPiece({ file: A.pillar.file, x: 0, y: 0, cell: A.pillar.cell, foot: A.pillar.foot }, e.x, e.y);
        if (e.crack) {                                // 금 간 기둥(비밀): 지그재그 금 + 가끔 반짝
          ctx.strokeStyle = '#120c16'; ctx.lineWidth = 1; ctx.beginPath();
          ctx.moveTo(e.x - 6, e.y1 - 30); ctx.lineTo(e.x - 2, e.y1 - 24); ctx.lineTo(e.x - 5, e.y1 - 18); ctx.lineTo(e.x + 1, e.y1 - 12); ctx.lineTo(e.x - 2, e.y1 - 6); ctx.stroke();
          if (Math.floor(G.t * 3 + e.x) % 7 === 0) { ctx.fillStyle = '#ffe6a0'; ctx.fillRect(Math.round(e.x - 2), Math.round(e.y1 - 20), 1, 1); }
        }
      } else if (e.kind === 'prop') {
        const o = A.props[e.name];
        if (e.r) shadow(e.x, e.y, o.cell[0] * 0.4, 0.28);
        drawPiece(o, e.x, e.y);
      } else if (e.kind === 'pot') drawPot(e);
      else if (e.kind === 'shrine') drawShrine(e);
      else {
        const big = e.boss || e.elite;
        shadow(e.x, e.y - 1, (e.r + 1), e.z ? 0.18 : 0.25);
        if (e.elite && !e.boss) {                     // 정예: 금빛 발밑 + 테두리
          ctx.globalAlpha = 0.25 + 0.1 * Math.sin(G.t * 6); ctx.fillStyle = e.goblin ? '#ffd34a' : '#ffb84a';
          ctx.beginPath(); ctx.ellipse(e.x, e.y - 1, e.r + 4, (e.r + 4) * 0.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        if (e.boss) {
          ctx.globalAlpha = 0.3 + 0.12 * Math.sin(G.t * 5); ctx.fillStyle = e.boss.rage ? '#ff3a4a' : '#ff8a3a';
          ctx.beginPath(); ctx.ellipse(e.x, e.y - 1, e.r + 8, (e.r + 8) * 0.4, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        const wind = e.st === 'wind' || (e.boss && (e.lock > 0));
        const gold = e.goblin && !(e.flash > 0);      // 보물 고블린: 몸에 금빛이 일렁임
        drawCell(e.sh, e.row, enemyCol(e), e.x, e.y, { scale: e.scale, z: e.z, flash: e.flash > 0 ? 0.7 : gold ? 0.32 + 0.14 * Math.sin(G.t * 8) : (wind ? 0.25 + 0.25 * Math.sin(G.t * 30) : 0),
                                                      flashC: e.flash > 0 ? '#fff' : gold ? '#ffd34a' : '#ff5040', outline: big ? (e.boss ? (e.boss.rage ? '#ff4a5a' : '#ffb04a') : '#ffd34a') : null,
                                                      tint: e.freeze > 0 ? '#9adcff' : null });
        if (e.freeze > 0) drawCell(e.sh, e.row, enemyCol(e), e.x, e.y, { scale: e.scale, alpha: 0.5 });
        if (e.goblin) {                               // 머리 위로 든 보물 자루(갈색 자루 · 묶은 끈 · 삐져나온 금화) — 뛰는 박자에 맞춰 들썩
          const x = Math.round(e.x), y = Math.round(e.y - e.sh.wh[1] * e.scale * 0.92 - 4 + (Math.floor(e.animT * 12) % 2));
          ctx.fillStyle = '#140c14'; ctx.beginPath(); ctx.ellipse(x, y, 8, 7, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#9a6a3a'; ctx.beginPath(); ctx.ellipse(x, y, 7, 6, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#c8945a'; ctx.beginPath(); ctx.ellipse(x - 2, y - 2, 3, 2, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 2, y - 7, 4, 2);
          for (const [cx, cy] of [[-3, -8], [0, -9], [3, -8]]) { ctx.fillStyle = '#7a5a10'; ctx.fillRect(x + cx - 2, y + cy - 1, 4, 3); ctx.fillStyle = '#ffd34a'; ctx.fillRect(x + cx - 1, y + cy - 1, 3, 2); }
          if (Math.floor(G.t * 4) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y - 10, 1, 1); }
        }
      }
    }
    for (const gh of G.ghosts) drawCell(gh.sh, gh.row, gh.sh.stand, gh.x, gh.y, { scale: gh.scale, alpha: 1 - gh.t / 0.3 });
    if (G.C.attack === 'gun') {                       // 권총수 탄창(발밑 작은 막대: 남은 탄 · 장전 중엔 회색이 참)
      const full = magSize(), x = Math.round(p.x - 8), y = Math.round(p.y + 3);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, 18, 3);
      if (G.reloadT > 0) { ctx.fillStyle = '#9a96aa'; ctx.fillRect(x, y, Math.round(16 * (1 - G.reloadT / D.GUN.reload)), 1); }
      else { ctx.fillStyle = '#ffd34a'; ctx.fillRect(x, y, Math.round(16 * G.ammo / full), 1); }
    }
    // 공격 스킬: 수호 부메랑(10-22 사용자 «칼 두 개 도는 거 밋밋» → «차라리 검 말고 부메랑») — 도는 길 + 부메랑마다 끌리는 빛 꼬리 + 빛무리 + 제자리에서 빠르게 도는 부메랑
    for (const a of G.abil) if (a.k === 'orbit' && a.blades && a.blades.length) {
      const gold = !!G.evo.barrier, c1 = gold ? '#ffcf5a' : '#ffa050', c2 = gold ? '#fff2c0' : '#fff0d0';
      const r = a.rr || 34, cx = p.x, cy = p.y - 10;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.14; ctx.strokeStyle = c1; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.8, 0, 0, 7); ctx.stroke();
      for (const b of a.blades) for (let j = 0; j < 4; j++) {
        ctx.globalAlpha = 0.55 - j * 0.12; ctx.strokeStyle = j ? c1 : c2; ctx.lineWidth = 4 - j * 0.8;
        ctx.beginPath(); ctx.ellipse(cx, cy, r + 3, (r + 3) * 0.8, 0, b.an - 0.22 - j * 0.2, b.an - j * 0.2); ctx.stroke();
      }
      for (const b of a.blades) { ctx.globalAlpha = 0.4; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, 7); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      for (const b of a.blades) {                     // 부메랑: «ㅅ» 두 날개가 제자리에서 빠르게 돎(테 → 몸 → 빛 받는 모서리) + 도는 자리 빛 번짐
        const sp = G.t * 22 + b.an * 3;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.strokeStyle = c2; ctx.lineWidth = 2;
        for (const o of [0, Math.PI]) { ctx.beginPath(); ctx.arc(b.x, b.y, 9, sp + o, sp + o + 2); ctx.stroke(); }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(sp);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const arm = (w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.quadraticCurveTo(-3, -1, 0, 0); ctx.quadraticCurveTo(3, -1, 8, -5); ctx.stroke(); };
        arm(5, '#140c14'); arm(3, gold ? '#ffcf5a' : '#c8782e');
        ctx.strokeStyle = gold ? '#fff6d0' : '#ffd8a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-7, -5.5); ctx.quadraticCurveTo(-3, -1.8, 0, -1); ctx.stroke();
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.restore();
      }
    }
    // 10-23 직업 전용 공격 스킬 그림 — 포탑(권총수): 세 다리 받침 + 몸통 + 적 쪽으로 도는 총신 · 진화(요새)는 놋쇠 빛 / 비전 구슬(마법사): 둘레를 도는 빛 구슬
    for (const a of G.abil) if (a.k === 'turret' && a.tur) for (const tu of a.tur) {
      const x = Math.round(tu.x), y = Math.round(tu.y), gold = !!G.evo.fortress, rise = Math.min(1, (G.t - (tu.born || 0)) / 0.2);
      const fade = Math.min(1, tu.t / 0.4), kick = (tu.kick = Math.max(0, (tu.kick || 0) - 1 / 60)) > 0 ? 2 : 0;
      ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, y + 1, 8, 3, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#140c14'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, y + 1); ctx.lineTo(x, y - 5 * rise); ctx.lineTo(x + 6, y + 1); ctx.moveTo(x, y - 5 * rise); ctx.lineTo(x, y + 2); ctx.stroke();
      ctx.strokeStyle = gold ? '#c8963a' : '#6a7080'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 6, y + 1); ctx.lineTo(x, y - 5 * rise); ctx.lineTo(x + 6, y + 1); ctx.stroke();
      const by = y - 9 * rise;
      ctx.save(); ctx.translate(x, by); ctx.rotate(tu.ang);
      ctx.fillStyle = '#140c14'; ctx.fillRect(-1 - kick, -3, 12, 6); ctx.fillStyle = gold ? '#e8c060' : '#a6b4ca'; ctx.fillRect(0 - kick, -1, 10, 2);   // 총신
      ctx.restore();
      ctx.fillStyle = '#140c14'; ctx.beginPath(); ctx.arc(x, by, 5, 0, 7); ctx.fill();
      ctx.fillStyle = gold ? '#b8862a' : '#66748e'; ctx.beginPath(); ctx.arc(x, by, 4, 0, 7); ctx.fill();
      ctx.fillStyle = gold ? '#ffe6a0' : '#d6dde8'; ctx.fillRect(x - 2, by - 3, 2, 2);
      ctx.fillStyle = (G.t * 4 | 0) % 2 ? '#ff5a4a' : '#ffd25a'; ctx.fillRect(x, by - 1, 1, 1);                                           // 깜빡이는 불빛
      ctx.globalAlpha = 1;
    }
    for (const a of G.abil) if (a.k === 'orbs' && a.balls) {
      const gal = !!G.evo.galaxy, c1 = gal ? '#b8a0ff' : '#7ab8ff', c2 = gal ? '#f0e8ff' : '#e0f0ff', show = 1 - (a.cool || 0) / 0.7;
      for (const b of a.balls) {
        const s = 2.5 + 2 * show + Math.sin(G.t * 6 + b.an) * 0.5;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * show; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(b.x, b.y, s + 4, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.9 * Math.max(0.25, show); ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(b.x, b.y, s, 0, 7); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, s * 0.45, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      }
    }
    // 탄: 주인공(검기·화살·얼음) · 적(화살·마력·끈적이·도끼)
    for (const b of G.pproj) {
      if (b.k === 'wave') {                           // 검기(10-22 화려하게): 넓은 빛 겹(더하기) + 흰 날 + 뒤로 끌리는 잔상 초승달 둘
        const k = 1 - b.life / 0.55, r = b.r, l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l;
        const arc = (x, y) => { ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r, b.ang, -1.2, 1.2); };
        ctx.globalCompositeOperation = 'lighter';
        for (let j = 2; j >= 1; j--) { ctx.globalAlpha = (0.22 / j) * (1 - k); ctx.strokeStyle = b.evo ? '#ffcf5a' : '#5ac8ff'; ctx.lineWidth = 3; arc(b.x - ux * 7 * j, b.y - uy * 7 * j); ctx.stroke(); }
        ctx.globalAlpha = 0.4 * (1 - k); ctx.strokeStyle = b.evo ? '#ffcf5a' : '#5ac8ff'; ctx.lineWidth = 7; arc(b.x, b.y); ctx.stroke();
        ctx.globalAlpha = 0.95 - 0.5 * k; ctx.strokeStyle = b.evo ? '#ffe6a0' : '#e8fbff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else if (b.k === 'bullet') {
        const l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l;
        if (b.big) {                                  // 필살 탄(10-22): 굵은 주황 빛 꼬리(더하기) + 흰 심 · 폭발탄은 붉고 굵게
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.65; ctx.strokeStyle = b.boom ? '#ff4a1a' : '#ffa040'; ctx.lineWidth = b.boom ? 4 : 3;
          ctx.beginPath(); ctx.moveTo(b.x - ux * 13, b.y - uy * 13); ctx.lineTo(b.x + ux * 2, b.y + uy * 2); ctx.stroke();
          ctx.globalAlpha = 1; ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(b.x - ux * 7, b.y - uy * 7); ctx.lineTo(b.x + ux * 2, b.y + uy * 2); ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        } else {
          ctx.strokeStyle = b.kind === 'ult' ? '#ff9a4a' : '#ffe6a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x - ux * 5, b.y - uy * 5); ctx.lineTo(b.x + ux, b.y + uy); ctx.stroke();
          ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
        }
      } else if (b.k === 'missile' && b.orb) {        // 비전 구슬(10-23): 빛 구슬 + 뒤로 끌리는 빛 꼬리
        const l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l, c1 = b.gal ? '#b8a0ff' : '#7ab8ff';
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45; ctx.strokeStyle = c1; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x - ux * 16, b.y - uy * 16); ctx.lineTo(b.x, b.y); ctx.stroke();
        ctx.globalAlpha = 0.4; ctx.fillStyle = c1; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(b.x - 1, b.y - 1, 2, 0, 7); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else if (b.k === 'missile') {
        const x = Math.round(b.x), y = Math.round(b.y), l = Math.hypot(b.vx, b.vy) || 1;
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#7a48b0'; ctx.fillRect(Math.round(x - b.vx / l * 4), Math.round(y - b.vy / l * 4), 2, 2); ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(180,120,255,0.45)'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
        ctx.fillStyle = '#e6d4ff'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.fillStyle = '#fff'; ctx.fillRect(x, y - 1, 1, 1);
      } else if (b.k === 'arrow') {
        const l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l;
        if (b.kind === 'skill') {                     // 스킬 화살: 하늘빛 꼬리
          ctx.globalAlpha = 0.55; ctx.strokeStyle = '#9ae6ff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(b.x - ux * 16, b.y - uy * 16); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.globalAlpha = 1;
        } else if (b.hawk) {                          // 추적 화살(10-23): 연둣빛 꼬리 · 진화(별빛 사냥)는 금빛 + 반짝임
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.6; ctx.strokeStyle = b.star ? '#ffe680' : '#9dffb0'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(b.x - ux * 18, b.y - uy * 18); ctx.lineTo(b.x, b.y); ctx.stroke();
          if (b.star) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff6c0'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill(); }
          ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x - ux * 7, b.y - uy * 7); ctx.lineTo(b.x + ux * 3, b.y + uy * 3); ctx.stroke();
        ctx.fillStyle = '#e8eef8'; ctx.fillRect(Math.round(b.x + ux * 3), Math.round(b.y + uy * 3), 1, 1);
      } else if (b.k === 'shard') {
        ctx.fillStyle = '#bfefff'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 3, 3);
      } else if (b.k === 'knife') {                   // 비수(10-22 화려하게 · 10-23 사용자 «작아서 잘 안 보임» → 두 배 크기 칼 + 굵은 빛 꼬리)
        const l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l, evo = G.evo.tempest;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45; ctx.strokeStyle = evo ? '#c89aff' : '#7fd8ff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(b.x - ux * 24, b.y - uy * 24); ctx.lineTo(b.x - ux * 2, b.y - uy * 2); ctx.stroke();
        ctx.globalAlpha = 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(b.x - ux * 14, b.y - uy * 14); ctx.lineTo(b.x - ux * 2, b.y - uy * 2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(b.ang + (evo ? G.t * 20 : 0));
        const poly = (pts, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); };
        poly([-11, -2, -6, -2, -6, -4, -4, -4, -4, -2, 5, -2, 10, 0, 5, 2, -4, 2, -4, 4, -6, 4, -6, 2, -11, 2], '#140c14');   // 테두리(손잡이·코등이·날)
        poly([-4, -1, 5, -1, 8, 0, 5, 1, -4, 1], evo ? '#e0c8ff' : '#dfe8f4');                                                 // 날
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-3, -1, 8, 1);                                                                 // 날 빛
        ctx.fillStyle = evo ? '#a070ff' : '#ffcf5a'; ctx.fillRect(-6, -3, 2, 6);                                               // 코등이
        ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-10, -1, 4, 2);                                                                // 손잡이
        ctx.restore();
      } else if (b.k === 'axe') {                     // 회전 도끼: 빙글빙글 + 도는 자리에 흐린 빛 고리(더하기 합성)
        const s = b.size;
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45; ctx.strokeStyle = G.evo.axestorm ? '#ffb070' : '#ffe0b0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, 8 * s, b.spin - 2.4, b.spin); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(b.spin); ctx.scale(s, s);
        ctx.fillStyle = '#140c14'; ctx.fillRect(-1, -7, 3, 14);                                       // 자루 테
        ctx.fillStyle = '#9a6a3a'; ctx.fillRect(0, -6, 1, 12);                                        // 자루
        ctx.fillStyle = '#140c14'; ctx.beginPath(); ctx.moveTo(1, -8); ctx.lineTo(8, -10); ctx.lineTo(9, -2); ctx.lineTo(1, -3); ctx.fill();   // 날 테
        ctx.fillStyle = G.evo.axestorm ? '#ffcf8a' : '#c8d0e0'; ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(7, -9); ctx.lineTo(8, -3); ctx.lineTo(2, -4); ctx.fill();   // 날
        ctx.fillStyle = '#ffffff'; ctx.fillRect(7, -8, 1, 4);                                         // 날 끝 빛
        ctx.restore();
      } else if (b.k === 'tornado') {                 // 회오리: 땅에서 좁고 위로 넓어지는 고리 여러 겹이 빠르게 돎(밝은 겹·어두운 겹 번갈아)
        const x = b.x, y = b.y + 10, r = b.r, fade = Math.min(1, b.life / 0.4, (b.dur - b.life) / 0.25 + 0.15);
        ctx.globalAlpha = 0.3 * fade; ctx.fillStyle = '#4a4258'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.7, r * 0.7 * SQ, 0, 0, 7); ctx.fill();
        for (let i = 0; i < 8; i++) {
          const h = i / 7, rw = r * (0.3 + 0.75 * h), cy = y - h * r * 2.4, sx = Math.sin(G.t * 7 + i * 0.9) * 2.5 * h;
          ctx.globalAlpha = (0.35 + 0.45 * h) * fade; ctx.strokeStyle = i % 2 ? '#eef4ff' : '#a8b4c8'; ctx.lineWidth = i % 2 ? 1.5 : 2.5;
          ctx.beginPath(); ctx.ellipse(x + sx, cy, rw, rw * 0.3, 0, G.t * 14 + i, G.t * 14 + i + 4.2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    for (const b of G.eproj) {
      const x = Math.round(b.x), y = Math.round(b.y);
      if (b.k === 'arrow') {
        const l = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / l, uy = b.vy / l;
        ctx.strokeStyle = '#f0e6c8'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x - ux * 7, b.y - uy * 7); ctx.lineTo(b.x + ux * 2, b.y + uy * 2); ctx.stroke();
        ctx.fillStyle = '#ff6a5a'; ctx.fillRect(Math.round(b.x + ux * 2), Math.round(b.y + uy * 2), 1, 1);
      } else if (b.k === 'orb') {
        ctx.fillStyle = 'rgba(180,90,255,0.35)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#e0b0ff'; ctx.fillRect(x - 1, y - 1, 3, 3);
      } else if (b.k === 'goo') {
        ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#9dff9a'; ctx.fillRect(x - 2, y - 2, 2, 2);
      } else if (b.k === 'axe') {
        ctx.save(); ctx.translate(x, y); ctx.rotate(b.spin);
        ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1, -6, 2, 12); ctx.fillStyle = '#c8ccd8'; ctx.fillRect(1, -6, 4, 5); ctx.restore();
      }
    }
    // 위 효과
    for (const f of G.fx) {
      const k = f.t / f.dur;
      if (f.k === 'spark') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff';
        const s = Math.round(2 + 4 * k), x = Math.round(f.x), y = Math.round(f.y);
        ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1);
        ctx.fillStyle = '#9ae6ff'; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.globalAlpha = 1;
      } else if (f.k === 'ring') {
        ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = f.c || '#e8fbff'; ctx.lineWidth = 3 * (1 - k) + 1;
        const rx = f.r * (0.55 + 0.45 * k), ry = rx * 0.6;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, rx, ry, 0, 0, 7); ctx.stroke();
        if (!f.c) {
          ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 1; ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + k * 5; ctx.beginPath(); ctx.ellipse(f.x, f.y, rx * 0.8, ry * 0.8, 0, a, a + 0.7); ctx.stroke(); }
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'storm') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.3 + 0.7 * k), f.r * 0.6 * (0.3 + 0.7 * k), 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 10; i++) {
          const a = i * Math.PI / 5 + f.t * 4, r0 = f.r * 0.25 * (1 + k), r1 = f.r * (0.55 + 0.45 * k);
          ctx.strokeStyle = i % 2 ? '#9ae6ff' : '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * 0.6); ctx.lineTo(f.x + Math.cos(a + 0.3) * r1, f.y + Math.sin(a + 0.3) * r1 * 0.6); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'sparkle') sparkle(f);
      else if (f.k === 'boom') {
        ctx.globalAlpha = 0.7 * (1 - k); ctx.fillStyle = f.c || '#ffb070';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.5 + 0.5 * k), f.r * 0.6 * (0.5 + 0.5 * k), 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.k === 'bolt' || f.k === 'chain') {   // 번개(10-22 화려하게): 굵은 푸른 빛(더하기) + 노란 몸 + 흰 심 · 낙뢰는 곁가지 + 바닥 번쩍 · 두 프레임마다 모양이 바뀌며 지직거림
        if (!f.pts || (f.flick = (f.flick || 0) + 1) % 2 === 0) {
          f.pts = [];
          if (f.k === 'bolt') { let y = f.y - 96, x = f.x; f.pts.push([x, y]); while (y < f.y) { y += 10; x = f.x + rand(-6, 6) * (1 - (y - f.y + 96) / 130); f.pts.push([x, Math.min(y, f.y)]); } }
          else f.pts.push([f.x, f.y], [(f.x + f.x2) / 2 + rand(-6, 6), (f.y + f.y2) / 2 + rand(-6, 6)], [f.x2, f.y2]);
          f.fork = Math.floor(f.pts.length * rand(0.3, 0.6)); f.fdir = Math.random() < 0.5 ? -1 : 1;
        }
        const path = () => { ctx.beginPath(); ctx.moveTo(f.pts[0][0], f.pts[0][1]); for (const q of f.pts) ctx.lineTo(q[0], q[1]); };
        ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.55 * (1 - k); ctx.strokeStyle = '#6aa8ff'; ctx.lineWidth = 6; path(); ctx.stroke();
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 2.5; path(); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; path(); ctx.stroke();
        if (f.k === 'bolt') {
          const q = f.pts[f.fork];
          if (q) { ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + f.fdir * 8, q[1] + 9); ctx.lineTo(q[0] + f.fdir * 11, q[1] + 20); ctx.stroke(); }
          ctx.globalAlpha = 0.75 * (1 - k); ctx.fillStyle = '#fff6c0';
          ctx.beginPath(); ctx.ellipse(f.x, f.y + 6, 13 * (1 - k * 0.4), 13 * SQ * (1 - k * 0.4), 0, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.lineJoin = 'miter'; ctx.globalAlpha = 1;
      } else if (f.k === 'eslash' || f.k === 'bigslash') {
        const h = f.arc * Math.PI / 360;
        ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = f.k === 'eslash' ? '#ffd0c8' : '#ffffff'; ctx.lineWidth = f.k === 'eslash' ? 2 : 3;
        const rr = f.r * (0.7 + 0.3 * k);
        ctx.beginPath();
        if (f.flat) ctx.arc(f.x, f.y - 4, rr, f.ang - h, f.ang + h); else ctx.ellipse(f.x, f.y, rr, rr * SQ, 0, f.ang - h, f.ang + h);
        ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.k === 'spike') {
        ctx.globalAlpha = 1 - k * 0.6; ctx.fillStyle = '#efe6cf';
        const x = Math.round(f.x), y = Math.round(f.y), hh = Math.round(12 * Math.min(1, k * 4));
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x - 1, y - hh); ctx.lineTo(x + 1, y); ctx.lineTo(x + 3, y - hh * 0.7); ctx.lineTo(x + 5, y); ctx.fill(); ctx.globalAlpha = 1;
      } else if (f.k === 'rock') {                    // 대지 가르기: 바닥에서 솟았다 가라앉는 바위 가시(왼쪽 위 빛 · 짙은 테 · 곁가시) + 솟는 순간 푸른 빛
        const up = k < 0.2 ? k / 0.2 : k > 0.65 ? Math.max(0, (1 - k) / 0.35) : 1;
        const x = Math.round(f.x), y = Math.round(f.y), h = Math.round(18 * f.s * up), w = Math.round(5 * f.s) + 1;
        if (k < 0.3) { ctx.globalAlpha = 0.6 * (1 - k / 0.3); ctx.fillStyle = f.glow || '#bfefff'; ctx.beginPath(); ctx.ellipse(x, y, w + 4, (w + 4) * SQ, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        if (h > 1) {
          const h2 = Math.round(h * 0.55), sx = x + w;
          ctx.fillStyle = '#2a2230';
          ctx.beginPath(); ctx.moveTo(sx - 3, y + 1); ctx.lineTo(sx + 1, y - h2 - 1); ctx.lineTo(sx + 4, y + 1); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x - w - 1, y + 1); ctx.lineTo(x, y - h - 1); ctx.lineTo(x + w + 1, y + 1); ctx.fill();
          ctx.fillStyle = '#6a5c4c'; ctx.beginPath(); ctx.moveTo(sx - 2, y); ctx.lineTo(sx + 1, y - h2); ctx.lineTo(sx + 3, y); ctx.fill();
          ctx.fillStyle = '#8a7a66'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x, y - h); ctx.lineTo(x + w, y); ctx.fill();
          ctx.fillStyle = '#d8c8a8'; ctx.beginPath(); ctx.moveTo(x - w + 1, y); ctx.lineTo(x, y - h + 1); ctx.lineTo(x, y); ctx.fill();
        }
      } else if (f.k === 'flame') {                   // 불기둥: 바닥 불 웅덩이 + 혀 셋(가운데 높게)이 날름거림 · 겹마다 겉 주황 · 속 노랑 · 심 흰 — 더하기 합성
        const up = Math.min(1, k / 0.12), fade = k < 0.5 ? 1 : Math.max(0, 1 - (k - 0.5) / 0.5), r = f.r;
        const H = r * 2.1 * up * (1 - 0.4 * Math.max(0, k - 0.5)), x = Math.round(f.x), y = Math.round(f.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = '#ff5a1a'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r * 0.85 * SQ, 0, 0, 7); ctx.fill();
        const tongue = (cx, w, hh, c, al, ph) => {    // 불 혀 하나: 아래 둥글고 위로 가늘게 · 끝이 흔들림
          const sway = Math.sin(G.t * 26 + ph) * w * 0.6;
          ctx.globalAlpha = al * fade; ctx.fillStyle = c;
          ctx.beginPath(); ctx.moveTo(cx - w, y); ctx.quadraticCurveTo(cx - w * 1.1, y - hh * 0.45, cx + sway, y - hh); ctx.quadraticCurveTo(cx + w * 1.1, y - hh * 0.45, cx + w, y); ctx.closePath(); ctx.fill();
        };
        for (const [dx, hs, ph] of [[-r * 0.38, 0.62, 1.3], [r * 0.38, 0.7, 2.9], [0, 1, 0]]) {
          const cx = x + dx, hh = H * hs, w = r * (dx ? 0.3 : 0.42);
          tongue(cx, w, hh, '#ff4a12', 0.8, ph); tongue(cx, w * 0.62, hh * 0.78, '#ffa52a', 0.85, ph + 0.8);
          if (!dx) tongue(cx, w * 0.3, hh * 0.5, '#fff6c0', 0.95, ph + 1.6);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else if (f.k === 'pillar') {                  // 대지 가르기 A: 바닥에서 솟는 푸른 빛줄기(흰 심) + 바닥 빛 웅덩이 — 더하기 합성으로 밝게
        const up = Math.min(1, k / 0.15), fade = k < 0.45 ? 1 : Math.max(0, 1 - (k - 0.45) / 0.55);
        const s = f.s, h = Math.round(52 * s * up), w = Math.max(2, Math.round(4 * s * (1 - k * 0.6))), x = Math.round(f.x), y = Math.round(f.y);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = '#3aa8ff';
        ctx.beginPath(); ctx.ellipse(x, y, 11 * s, 11 * s * SQ, 0, 0, 7); ctx.fill();
        if (h > 1) {
          const g = ctx.createLinearGradient(0, y, 0, y - h);
          g.addColorStop(0, '#7fdcff'); g.addColorStop(0.7, 'rgba(127,220,255,0.35)'); g.addColorStop(1, 'rgba(127,220,255,0)');
          ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = g; ctx.fillRect(x - w * 2, y - h, w * 4, h);
          const g2 = ctx.createLinearGradient(0, y, 0, y - h);
          g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = fade; ctx.fillStyle = g2; ctx.fillRect(x - Math.floor(w / 2), y - h, w, h);
        }
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      } else if (f.k === 'lsword') {                  // 대지 가르기 C: 빛으로 된 검이 위에서 떨어져 바닥에 꽂힘(흰 날·푸른 테·코등이) → 꽂힌 순간 번쩍 → 서서히 사라짐
        const fall = Math.min(1, f.t / 0.06), fade = k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45), s = f.s;
        const L = Math.round(24 * s), bw = Math.max(2, Math.round(3 * s)), gw = Math.round(6 * s), x = Math.round(f.x);
        const tip = Math.round(f.y + 3 - (1 - fall) * 50), top = tip - L;   // 날 끝은 바닥 3칸 아래로 박힘 · top = 코등이 자리
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4 * fade; ctx.fillStyle = '#3aa8ff';
        ctx.beginPath(); ctx.ellipse(x, (tip + top) / 2 - 3, gw, L * 0.62, 0, 0, 7); ctx.fill();           // 빛무리
        ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = fade;
        ctx.fillStyle = '#4aa0ff'; ctx.beginPath(); ctx.moveTo(x - bw - 1, top); ctx.lineTo(x + bw + 2, top); ctx.lineTo(x + 0.5, tip + 1); ctx.fill();   // 날 테
        ctx.fillStyle = '#d8f6ff'; ctx.beginPath(); ctx.moveTo(x - bw, top); ctx.lineTo(x + bw + 1, top); ctx.lineTo(x + 0.5, tip - 1); ctx.fill();       // 날
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x, top, 1, Math.max(1, L - 4));                                                                        // 날 심
        ctx.fillStyle = '#7fd8ff'; ctx.fillRect(x - gw, top - 2, gw * 2 + 1, 2);                                                                       // 코등이
        ctx.fillStyle = '#e8fbff'; ctx.fillRect(x - 1, top - Math.round(7 * s), 3, Math.round(5 * s));                                                // 손잡이
        ctx.fillStyle = '#7fd8ff'; ctx.fillRect(x - 1, top - Math.round(7 * s) - 2, 3, 2);                                                             // 머리
        if (fall >= 1 && f.t < 0.2) {                 // 꽂힌 순간 바닥 번쩍
          ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9 * (1 - (f.t - 0.06) / 0.14); ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.ellipse(x, f.y, 10 * s, 10 * s * SQ, 0, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'boulder') {
        const x = f.x + (f.x2 - f.x) * k, y = f.y + (f.y2 - f.y) * k - Math.sin(k * Math.PI) * 60;
        ctx.fillStyle = '#5a4a3a'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#8a7a64'; ctx.fillRect(Math.round(x - 3), Math.round(y - 4), 3, 2);
      } else if (f.k === 'lob') {                     // 수류탄: 포물선으로 날아감 · 깜빡이는 심지
        const x = Math.round(f.x + (f.x2 - f.x) * k), y = Math.round(f.y + (f.y2 - f.y) * k - Math.sin(k * Math.PI) * 30);
        ctx.fillStyle = '#2b1a2a'; ctx.fillRect(x - 2, y - 2, 5, 5); ctx.fillStyle = '#4a5a3a'; ctx.fillRect(x - 1, y - 1, 3, 3);
        if (Math.floor(G.t * 16) % 2) { ctx.fillStyle = '#ffe06a'; ctx.fillRect(x + 1, y - 3, 1, 1); }
      } else if (f.k === 'meteor') {                  // 메테오: 위에서 비스듬히 떨어지는 불덩이
        const x = f.x - 60 * (1 - k), y = f.y - 120 * (1 - k) - 8;
        ctx.globalAlpha = 0.6; ctx.strokeStyle = '#ff8a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 14, y - 26); ctx.lineTo(x, y); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#ff6a2a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe06a'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      } else if (f.k === 'rubble') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#776b8a';
        for (let i = 0; i < 8; i++) ctx.fillRect(Math.round(f.x + Math.cos(i) * 14 * (0.5 + k)), Math.round(f.y - 10 + Math.sin(i * 2) * 8 * (0.5 + k)), 3, 3);
        ctx.globalAlpha = 1;
      } else if (f.k === 'rain') {
        ctx.strokeStyle = '#f0e6c8'; ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2, rr = Math.random() * f.r, x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr * 0.6;
          ctx.beginPath(); ctx.moveTo(x - 2, y - 14); ctx.lineTo(x, y); ctx.stroke();
        }
      } else if (f.k === 'shock') {                   // 충격파: 바닥에 퍼지는 고리 둘 + 처음 순간 번쩍
        const rr = f.r * (0.2 + 0.8 * Math.sqrt(k));
        ctx.globalAlpha = 0.85 * (1 - k); ctx.strokeStyle = f.c || '#ffffff'; ctx.lineWidth = Math.max(1, 3 * (1 - k));
        ctx.beginPath(); ctx.ellipse(f.x, f.y, rr, rr * SQ, 0, 0, 7); ctx.stroke();
        ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, rr * 0.72, rr * 0.72 * SQ, 0, 0, 7); ctx.stroke();
        if (k < 0.25) { ctx.globalAlpha = 0.45 * (1 - k * 4); ctx.fillStyle = f.c || '#ffffff'; ctx.beginPath(); ctx.ellipse(f.x, f.y, rr * 0.7, rr * 0.7 * SQ, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (f.k === 'trail') {                   // 돌진 자국: 지나간 길에 굵은 빛줄이 가늘어지며 사라짐
        ctx.globalAlpha = 0.75 * (1 - k); ctx.lineCap = 'round';
        ctx.strokeStyle = f.c || '#bfefff'; ctx.lineWidth = 8 * (1 - k) + 1;
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x2, f.y2); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * (1 - k) + 1; ctx.stroke();
        ctx.lineCap = 'butt'; ctx.globalAlpha = 1;
      }
    }
    for (const q of G.parts) {                         // 입자(바닥 그림자 없이 높이만큼 위로)
      const a = 1 - q.t / q.life;
      ctx.globalAlpha = a > 0.5 ? 1 : a * 2; ctx.fillStyle = q.c;
      ctx.fillRect(Math.round(q.x), Math.round(q.y - q.z), q.s, q.s);
    }
    ctx.globalAlpha = 1;
    for (const f of G.fx) if (f.k === 'flash') {      // 화면 번쩍임(필살)
      ctx.globalAlpha = (f.a || 0.3) * (1 - f.t / f.dur); ctx.fillStyle = f.c || '#ffffff';
      ctx.fillRect(p.x - VW / 2 - 8, p.y - VH / 2 - 24, VW + 16, VH + 48); ctx.globalAlpha = 1;
    }
    ctx.restore();
    ctx = scr;                                        // 작은 판 → 화면(정수 배율)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(low, 0, 0, LW * S, LH * S);
    // 글자(기기 픽셀): 피해 숫자 — 평타 작게 · 스킬·치명 크게 · 필살 아주 크게
    //   글자마다 strokeText 는 폰에서 무거움(10-22 «스킬 쓰면 끊김») → 크기·색마다 숫자판(0~9 ! + −)을 한 번 그려 두고 오려 붙임
    for (const n of G.nums) {
      const size = n.big || 0, px = Math.round([6.5, 8.5, 11][size] * S), lw = Math.max(2, Math.round(S * (0.9 + size * 0.3)));
      const pop = size && n.t < 0.08 ? 1 + (0.08 - n.t) * 4 : 1;
      ctx.globalAlpha = Math.min(1, 2 - n.t * 3);
      drawNum(String(n.n), (n.x + ox) * S, (n.y + oy - n.t * 14) * S - px * 0.36, px, lw, n.c || '#fff', pop);
    }
    ctx.globalAlpha = 1;
    // 화면 밖 상자·보스·고블린 쪽 화살표
    const arrows = G.drops.filter(d => d.k === 'chest' || (d.k === 'item' && d.item.rar >= 2)).map(d => [d.x, d.y, '#ffd34a']);
    if (G.boss) arrows.push([G.boss.x, G.boss.y, '#ff5a4a']);
    for (const e of G.enemies) if (e.goblin) arrows.push([e.x, e.y, '#ffe680']);
    for (const [wx, wy, col] of arrows) {
      const sx = (wx + ox) * S, sy = (wy - 6 + oy) * S, W = cv.width, H = cv.height, m = 30 * dpr;
      if (sx > m && sx < W - m && sy > m * 2 && sy < H - m) continue;
      const ang = Math.atan2(sy - H / 2, sx - W / 2), c = Math.cos(ang), s = Math.sin(ang);
      const t = Math.min((W / 2 - m) / Math.max(1e-6, Math.abs(c)), (H / 2 - m * 1.5) / Math.max(1e-6, Math.abs(s)));
      ctx.save(); ctx.translate(W / 2 + c * t, H / 2 + s * t); ctx.rotate(ang); ctx.scale(dpr * 1.4, dpr * 1.4);
      ctx.fillStyle = col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    if (joy && joy.mode === 'point') {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(joy.x * dpr, joy.y * dpr, 12 * dpr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (joy) {
      ctx.globalAlpha = 0.3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(joy.x0 * dpr, joy.y0 * dpr, 44 * dpr, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.45; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr; ctx.stroke();
      const dx = joy.x - joy.x0, dy = joy.y - joy.y0, l = Math.hypot(dx, dy), k = l > 40 ? 40 / l : 1;
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc((joy.x0 + dx * k) * dpr, (joy.y0 + dy * k) * dpr, 18 * dpr, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── 고리
  let last = 0, acc = 0, hudT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (G && !G.paused && !G.over && !G.done) {
      acc += dt;
      let n = 0;
      while (acc >= STEP && n < 10) { update(STEP); acc -= STEP; n++; if (G.over || G.paused || G.done) break; }
      if (n >= 10) acc = 0;
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.08; hooks.hud && hooks.hud(G); }
    }
    render();
  }

  function init(canvas, art, h) {
    cv = canvas; scr = ctx = cv.getContext('2d', { alpha: false });
    A = art; hooks = h;
    for (const k in A.mons) img(A.mons[k].file);
    for (const k in A.heroes) img(A.heroes[k].file);
    for (const k in A.tiles) img(A.tiles[k].file);
    img(A.items.potion.file); img(Object.values(A.props)[0].file);
    resize();
    window.addEventListener('resize', resize);
    // 조작: 터치 = 화면 왼쪽 55% 에서 누른 자리가 조이스틱 중심(오른쪽은 버튼 손) · 마우스 = 누른 곳으로
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (window.SFX) SFX.unlock();
      const mode = ctrl === 'auto' ? (e.pointerType === 'mouse' ? 'point' : 'stick') : ctrl;
      if (mode === 'stick' && joy) return;
      if (mode === 'stick' && ctrl === 'auto' && e.offsetX > cv.clientWidth * 0.55) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* 원격·가상 포인터는 잡기 실패할 수 있음 */ }
      joy = { x0: e.offsetX, y0: e.offsetY, x: e.offsetX, y: e.offsetY, id: e.pointerId, mode, t0: performance.now(), moved: 0 };
      dest = null;
    });
    cv.addEventListener('pointermove', e => {
      if (!joy || e.pointerId !== joy.id) return;
      joy.x = e.offsetX; joy.y = e.offsetY;
      joy.moved = Math.max(joy.moved, Math.hypot(joy.x - joy.x0, joy.y - joy.y0));
    });
    const end = e => {
      if (!joy || e.pointerId !== joy.id) return;
      if (joy.mode === 'point' && G && performance.now() - joy.t0 < 350 && joy.moved < 12)
        dest = { x: G.p.x + joy.x * dpr / S - VW / 2, y: G.p.y + joy.y * dpr / S - VH / 2 - 12, t: 0 };
      joy = null;
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    window.addEventListener('keydown', e => {
      keys.add(e.code);
      if (window.SFX) SFX.unlock();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!G || e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'KeyJ') useSkill(0);
      else if (e.code === 'Digit2' || e.code === 'KeyK') useSkill(1);
      else if (e.code === 'Digit3' || e.code === 'KeyL') useUlt();
      else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') useMove();
    });
    window.addEventListener('keyup', e => keys.delete(e.code));
    window.addEventListener('blur', () => keys.clear());
    requestAnimationFrame(loop);
  }
  // 판 끝: 판 기록을 판 밖 기록으로(금화 · 장비 · 통계 · 도전 과제)
  //   10-22 사용자 «한 판에 하나만 들고 나오니 답답» → 주운 장비는 정복·쓰러짐 상관없이 전부 창고로 · 판 안에서 바꿔 낀 장비가 그 직업 장비로 남음
  //   창고가 STASH_MAX 를 넘으면 안 낀 것 중 낮은 등급·낮은 레벨·오래된 것부터 분해(금화 · 전설은 안 건드림)
  function finish() {
    if (!G || G.done) return null;
    G.done = true;
    const P = SAVE.P, cleared = G.cleared;
    const gold = cleared ? G.gold : Math.floor(G.gold * 0.5);
    for (const s of P.stash) delete s.isNew;
    for (const it of G.bag) { it.cls = it.slot === 'weapon' ? G.cls : null; it.isNew = true; P.stash.push(it); }
    const eq = P.equip[G.cls] = {};
    Object.keys(D.SLOTS).forEach((s, i) => { if (G.worn[i]) eq[s] = G.worn[i].id; });
    let scrap = 0, scrapped = 0;
    if (P.stash.length > D.STASH_MAX) {
      const worn = new Set();
      for (const c in P.equip) for (const s in P.equip[c]) worn.add(P.equip[c][s]);
      const cand = P.stash.filter(it => !worn.has(it.id) && !it.uniq).sort((a, b) => a.rar - b.rar || a.ilvl - b.ilvl || a.id - b.id);
      while (P.stash.length > D.STASH_MAX && cand.length) {
        const it = cand.shift();
        P.stash.splice(P.stash.indexOf(it), 1); scrap += D.ITEM_RARITY[it.rar].scrap; scrapped++;
      }
    }
    P.gold += gold + scrap; P.stats.goldTotal += gold + scrap;
    P.stats.runs++;
    for (const k in G.run.kills) SAVE.kill(k, G.run.kills[k]);
    for (const k in G.run.bosses) P.stats.bosses[k] = (P.stats.bosses[k] || 0) + G.run.bosses[k];
    P.stats.maxLv = Math.max(P.stats.maxLv, G.lv);
    P.stats.ultKills = Math.max(P.stats.ultKills, G.run.ultKillsMax);
    for (const k of ['elites', 'chests', 'legends', 'evos', 'dodges', 'goblins', 'secrets', 'shrines']) SAVE.stat(k, G.run[k] || 0);
    if (cleared) P.stats.clears[G.dun.key] = (P.stats.clears[G.dun.key] || 0) + 1;
    const done = checkAch();
    SAVE.save();
    return { gold, scrap, scrapped, kept: G.bag.length, ach: done };
  }
  function checkAch() {                               // 끝낸 도전 과제 → 보상(금화·해금)
    const P = SAVE.P, done = [];
    for (const a of D.ACH) {
      if (P.ach[a.id]) continue;
      const [v, need] = a.need(P);
      if (v < need) continue;
      P.ach[a.id] = true; done.push(a);
      const g = a.gift;
      if (g.gold) P.gold += g.gold;
      if (g.abil) { P.unlocked.abil = P.unlocked.abil || []; if (!P.unlocked.abil.includes(g.abil)) P.unlocked.abil.push(g.abil); }
      if (g.dungeon && !P.unlocked.dungeons.includes(g.dungeon)) P.unlocked.dungeons.push(g.dungeon);
      if (g.cls && !P.unlocked.classes.includes(g.cls)) P.unlocked.classes.push(g.cls);
    }
    return done;
  }

  return {
    init, start, resize, useSkill, useUlt, dodge, useMove, img, pickCard, reroll, wear, finish, checkAch, nextPanel, profileStats, itemScore, ultReady: () => !!G && G.ultCd <= 0,
    statParts: cls => cls ? statParts(equippedItems(cls), null) : statParts(G.worn, G.pass),   // cls 없으면 지금 판(레벨업 몫 포함)
    giveUp() { if (G && !G.over && !G.done) { G.over = true; G.gaveUp = true; } },
    get G() { return G; },
    setCtrl(v) { ctrl = v; joy = null; dest = null; }, get ctrl() { return ctrl; },
    setZoom(z) { zoomAdj = Math.max(0, z | 0); resize(); }, get zoomAdj() { return zoomAdj; },
    pause(v) { if (G) G.paused = v; },
    drawIcon(c2, icon, x, y, col) { const o = ctx; ctx = c2; drawIcon(icon, x, y, col); ctx = o; },
    test: {
      sim,
      god() { G.god = !G.god; return G.god; },
      level() { gainXp(D.xpNeed(G.lv) - G.xp + 0.01); },
      fill() { G.ultCd = 0; },
      boss(final) { spawnBoss(final ? G.dun.boss : G.dun.mid, !!final); },
      elite() { return spawnElite(); },
      goblin() { spawnGoblin(); },
      chest(n) { G.drops.push({ k: 'chest', n: n || 1, x: G.p.x + 20, y: G.p.y, t: 0 }); },
      openChest(n) { queuePanel({ k: 'chest', n: n || 1 }); },
      hurt(n) { G.p.inv = 0; return hurtPlayer(n); },
      step(sec) { for (let i = 0, n = Math.round(sec / STEP); i < n && !G.paused && !G.over && !G.done; i++) update(STEP); hooks.hud && hooks.hud(G); return G.t; },
      item(r) { dropItem(G.p.x + 16, G.p.y, r || 2); },
      time(s) { G.t = s; },
      clear() { G.enemies = []; G.eproj = []; G.tele = []; G.boss = null; },
      spawn(k, dx, dy, elite) { return makeEnemy(k, G.p.x + dx, G.p.y + dy, elite ? { elite: true } : null); },
      bossAt(key, dx, dy, final) { const e = spawnBoss(key, !!final); e.x = G.p.x + dx; e.y = G.p.y + dy; e.boss.busy = 99; return e; },
      move(name) { if (G.boss) { G.boss.boss.busy = 99; return BOSS_MOVES[name](G.boss, 1); } },
      frame() { render(); },
      pots(rad) {                                     // 주인공 둘레 rad 안의 성한 항아리(시험용)
        const out = [], p = G.p, R = rad || 300, n = Math.ceil(R / CHUNK), cx = Math.floor(p.x / CHUNK), cy = Math.floor(p.y / CHUNK);
        for (let gx = cx - n; gx <= cx + n; gx++) for (let gy = cy - n; gy <= cy + n; gy++)
          for (const o of chunkInfo(gx, gy).solid) if (o.kind === 'pot' && !o.gone && Math.hypot(o.x - p.x, o.y - p.y) < R) out.push(o);
        return out;
      },
      bench(n) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(); return (performance.now() - t0) / n; },
    },
  };
})();
