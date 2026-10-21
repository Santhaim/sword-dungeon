// 핵앤슬래시 본체(10-21 사용자 «장르를 핵앤슬래시로» · «롬 파일 쓰지 말고 순수 만들어서»)
//   그림 = window.ART(art/ · 우리가 그린 것만) · 이동은 직접 · 사거리 안 적에 3연타 자동
//   (A 가로 베기 → B 내려 베기 → C 찌르기) · 스킬 2 · 게이지 필살기 · 회피(무적 잠깐)
//   그림은 원본 크기 1:1, 화면 배율은 정수(S)라 픽셀이 고르게 선명하다
'use strict';
const HNS = (() => {
  const D = DATA;
  const STEP = 1 / 60;
  const TILE = 16, CHUNK = 16 * TILE;
  const ROWS = ['down', 'left', 'right', 'up'];
  let A = null, base = 'art/';
  const imgs = {};
  let cv, ctx, dpr = 1, S = 2, VW = 480, VH = 320;
  let zoomAdj = 0;
  let G = null;
  let speed = 1;
  let hooks = {};                       // ui 쪽 알림: hud · over · toast
  const chunks = new Map();
  const tintCache = new Map();
  let joy = null;                       // 왼손 조이스틱 · 마우스 «누른 곳으로»
  let ctrl = 'auto';                    // auto(마우스 = 누른 곳으로 · 터치 = 왼쪽 반 조이스틱) · stick · point
  let dest = null;
  const keys = new Set();
  let botMove = null;                   // 시험용 봇 이동

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  function img(p) {                     // ART.ver = 그림 묶음 판(바뀌면 브라우저가 예전 그림을 버림)
    if (!imgs[p]) { const im = new Image(); im.src = base + p + '?v=' + A.ver; imgs[p] = im; }
    return imgs[p];
  }
  const ready = im => im.complete && im.naturalWidth > 0;

  // ── 화면: 짧은 쪽에 원본 약 300px · 정수 배율(가로 화면 기준 — 넓게 보임)
  function resize() {
    dpr = window.devicePixelRatio || 1;
    const r = cv.parentElement.getBoundingClientRect();
    cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    S = Math.max(1, Math.round(Math.min(cv.width, cv.height) / 300) + zoomAdj);
    VW = cv.width / S; VH = cv.height / S;
  }

  // ── 바닥·기둥·세운 장식: 256px 덩어리마다 같은 씨앗으로 늘 같은 배치
  function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  const infos = new Map();
  function chunkInfo(cx, cy) {
    const key = cx + ',' + cy;
    let inf = infos.get(key);
    if (inf) return inf;
    const r = seeded(Math.floor(hash(cx * 31 + 7, cy * 17 + 3) * 4294967296));
    inf = { solid: [] };                              // 기둥(사각 상자) · 장식(원)
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const clear = (x, y, m) => Math.hypot(x, y) > 60 && inf.solid.every(o => Math.abs(o.x - x) > m + 18 || Math.abs(o.y - y) > m + 18);
    const pb = A.pillar.box;
    for (let k = 0, n = r() < 0.5 ? 1 : (r() < 0.6 ? 2 : 0); k < n; k++) {
      const x = ox + 24 + Math.floor(r() * (CHUNK - 48)), y = oy + 52 + Math.floor(r() * (CHUNK - 64));
      if (clear(x, y, 30)) inf.solid.push({ kind: 'pillar', x, y, x0: x - pb[0] / 2, y0: y - pb[1], x1: x + pb[0] / 2, y1: y });
    }
    const names = Object.keys(A.props);
    for (let k = 0, n = Math.floor(r() * 4); k < n; k++) {
      const name = names[Math.floor(r() * names.length)], o = A.props[name];
      const x = ox + 16 + Math.floor(r() * (CHUNK - 32)), y = oy + 16 + Math.floor(r() * (CHUNK - 24));
      if (clear(x, y, 12)) inf.solid.push({ kind: 'prop', name, x, y, r: name === 'bones' ? 0 : o.r });   // 뼈 무더기는 밟고 지나감
    }
    infos.set(key, inf);
    if (infos.size > 300) infos.delete(infos.keys().next().value);
    return inf;
  }
  function chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = chunks.get(key);
    if (c) return c;
    const t = A.tiles, im = img(t.file);
    if (!ready(im)) return null;
    c = document.createElement('canvas'); c.width = c.height = CHUNK;
    const g = c.getContext('2d');
    const tot = t.weights.reduce((a, b) => a + b, 0);
    for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
      let rr = hash(cx * 16 + tx, cy * 16 + ty) * tot, k = 0;
      while (k < t.n - 1 && rr >= t.weights[k]) { rr -= t.weights[k]; k++; }
      g.drawImage(im, k * TILE, 0, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
    }
    chunks.set(key, c);
    if (chunks.size > 48) chunks.delete(chunks.keys().next().value);
    return c;
  }
  // 기둥(사각)·장식(원)에 부딪히면 밀어냄 — 밀린 쪽(법선 합)을 돌려줌
  function solve(ent, r) {
    const cx = Math.floor(ent.x / CHUNK), cy = Math.floor(ent.y / CHUNK);
    let nx = 0, ny = 0;
    for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
      for (const o of chunkInfo(gx, gy).solid) {
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

  // ── 새 판
  function start() {
    const h = D.HERO;
    G = {
      t: 0, hero: A.hero,
      p: { x: 0, y: 0, vx: 0, vy: 1, hp: h.hp, maxHp: h.hp, dir: 'down', walkT: 0, moving: false, hurtT: 0, r: 6,
           atk: null, combo: 0, lastAtk: -9, dash: null, inv: 0, hop: 0 },
      dmg: h.dmg, lv: 1, xp: 0, kills: 0, gauge: 0, cds: D.SKILLS.map(() => 0), dodgeCd: 0,
      enemies: [], gems: [], nums: [], drops: [], ghosts: [], fx: [],
      spawnT: 0.5, over: false, paused: false, god: false, uid: 1, hitStop: 0, shake: 0,
    };
    chunks.clear(); infos.clear(); dest = null;
    hooks.hud && hooks.hud(G);
  }

  // ── 적
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
  function spawnEnemy(def, x, y) {
    const st = D.enemy(def.rank, G.lv, def.kind);
    G.enemies.push({ id: G.uid++, def, x, y, hp: st.hp, maxHp: st.hp, speed: st.speed * rand(0.9, 1.1), dmg: st.dmg, xp: st.xp,
                     r: Math.max(5, Math.min(def.wh[0], def.wh[1]) * 0.36), row: 0, animT: Math.random() * 2, flash: 0,
                     kx: 0, ky: 0, hitCd: 0.6 });
  }
  // 무리(3~5마리) 단위로 화면 바로 밖에 — 레벨이 오르면 센 적이 섞임
  function spawnPack() {
    const pool = A.monsters.filter(m => m.rank <= D.rankMax(G.lv));
    const def = pick(pool.length ? pool : A.monsters);
    const p = G.p, a = p.moving && Math.random() < 0.6 ? Math.atan2(p.vy, p.vx) + rand(-0.8, 0.8) : rand(0, Math.PI * 2);
    const R = Math.hypot(VW, VH) / 2 + rand(20, 60), cx = p.x + Math.cos(a) * R, cy = p.y + Math.sin(a) * R;
    for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) {
      const e = { x: cx + rand(-24, 24), y: cy + rand(-24, 24) };
      if (!solve(e, 8)) spawnEnemy(def, e.x, e.y);
    }
  }
  function hurtEnemy(e, dmg, kx, ky) {
    if (e.hp <= 0) return false;
    const n = Math.max(1, Math.round(dmg * rand(0.9, 1.1)));
    e.hp -= n; e.flash = 0.1;
    e.kx += kx || 0; e.ky += ky || 0;
    if (G.nums.length < 70) G.nums.push({ x: e.x, y: e.y - e.def.wh[1] * 0.8, n, t: 0 });
    G.fx.push({ k: 'spark', x: e.x + rand(-3, 3), y: e.y - e.def.wh[1] * 0.45 + rand(-3, 3), t: 0, dur: 0.16 });
    G.gauge = Math.min(D.ULT.need, G.gauge + D.ULT.perHit);
    if (e.hp <= 0) {
      G.kills++;
      G.gauge = Math.min(D.ULT.need, G.gauge + D.ULT.perKill);
      G.ghosts.push({ def: e.def, x: e.x, y: e.y, row: e.row, t: 0 });
      G.gems.push({ x: e.x + rand(-3, 3), y: e.y + rand(-3, 3), v: e.xp, pull: false });
      if (Math.random() < D.HEAL_DROP) G.drops.push({ k: 'potion', x: e.x, y: e.y, t: 0 });
    }
    return true;
  }

  // ── 주인공: 3연타 · 스킬 · 필살기 · 회피
  const dirOf = (dx, dy) => Math.abs(dx) > Math.abs(dy) * 0.9 ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  const dirVec = d => ({ down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[d]);
  function nearestEnemy(maxR) {
    let best = null, bd = Infinity;
    const p = G.p;
    near(p.x, p.y, maxR + 16, e => {
      const d = Math.hypot(e.x - p.x, e.y - p.y) - e.r;
      if (d < maxR && d < bd) { bd = d; best = e; }
    });
    return best;
  }
  // 부채꼴(가운데 ang · 폭 arc°) 안 적에게 피해 — 맞힌 수 · 맞히면 잠깐 멈춤(손맛)
  function slashArc(ang, range, arc, dmg, kb) {
    const p = G.p, half = arc * Math.PI / 360;
    let n = 0;
    near(p.x, p.y, range + 24, e => {
      const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
      if (d - e.r > range) return;
      let da = Math.atan2(dy, dx) - ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (half < Math.PI && Math.abs(da) > half + Math.atan2(e.r, Math.max(d, 1))) return;
      const ux = d > 0.1 ? dx / d : Math.cos(ang), uy = d > 0.1 ? dy / d : Math.sin(ang);
      if (hurtEnemy(e, dmg, ux * kb, uy * kb)) n++;
    });
    if (n) G.hitStop = Math.max(G.hitStop, D.HIT_STOP);
    return n;
  }
  // 동작 하나(시트의 act 6칸 · 칸마다 시간) — 칸 hit 에 onHit 한 번
  function playAct(act, fd, hit, onHit, ang) {
    const fds = Array.isArray(fd) ? fd : [fd, fd, fd, fd, fd, fd];
    G.p.atk = { act, fds, hit, onHit, ang, t: 0, fi: 0, done: false, total: fds.reduce((a, b) => a + b, 0) };
  }
  function startCombo(tg) {
    const p = G.p;
    if (G.t - p.lastAtk > D.COMBO_RESET) p.combo = 0;
    const c = D.COMBO[p.combo];
    const dx = tg.x - p.x, dy = tg.y - p.y;
    p.dir = dirOf(dx, dy);
    playAct(c.act, c.fd, c.hit, a => slashArc(a.ang, c.range, c.arc, G.dmg * c.mul, c.kb), Math.atan2(dy, dx));
    p.combo = (p.combo + 1) % D.COMBO.length;
  }
  function facingAng() {
    const p = G.p;
    if (p.moving) return Math.atan2(p.vy, p.vx);
    const [x, y] = dirVec(p.dir);
    return Math.atan2(y, x);
  }
  const busy = () => !G || G.over || G.paused;
  function useSkill(i) {
    const p = G && G.p, sk = D.SKILLS[i];
    if (busy() || !sk || G.cds[i] > 0 || p.dash) return false;
    G.cds[i] = sk.cd;
    const tg = nearestEnemy(160);
    let ang = tg ? Math.atan2(tg.y - p.y, tg.x - p.x) : facingAng();
    if (sk.key === 'spin') {                          // 회전 베기: 둘레 전부
      playAct(sk.act, sk.fd, 2, () => slashArc(0, sk.r, 360, G.dmg * sk.mul, sk.kb), ang);
      G.fx.push({ k: 'ring', x: p.x, y: p.y - 8, r: sk.r, t: 0, dur: 0.28 });
    } else if (sk.key === 'dash') {                   // 돌진 베기: 움직이는 쪽(없으면 가까운 적 쪽)으로 미끄러지며 지나는 적을 벰
      if (p.moving) ang = Math.atan2(p.vy, p.vx);
      p.dir = dirOf(Math.cos(ang), Math.sin(ang));
      p.dash = { t: 0, dur: sk.dur, ux: Math.cos(ang), uy: Math.sin(ang), spd: sk.dist / sk.dur, hit: new Set(), sk };
      p.inv = Math.max(p.inv, sk.dur + 0.1);
      playAct(sk.act, sk.fd, 99, null, ang);
    }
    hooks.hud && hooks.hud(G);
    return true;
  }
  function useUlt() {
    const p = G && G.p, u = D.ULT;
    if (busy() || G.gauge < u.need || p.dash) return false;
    G.gauge = 0;
    p.inv = Math.max(p.inv, 0.6);
    playAct(u.act, u.fd, 3, () => {
      slashArc(0, u.r, 360, G.dmg * u.mul, u.kb);
      G.fx.push({ k: 'storm', x: p.x, y: p.y - 8, r: u.r, t: 0, dur: 0.55 });
      G.shake = 0.35; G.hitStop = 0.09;
    }, facingAng());
    hooks.toast && hooks.toast(u.name + '!');
    hooks.hud && hooks.hud(G);
    return true;
  }
  function dodge() {
    const p = G && G.p, dg = D.DODGE;
    if (busy() || G.dodgeCd > 0 || p.dash) return false;
    G.dodgeCd = dg.cd;
    let ux, uy, back = false;
    if (p.moving) { ux = p.vx; uy = p.vy; } else { const [fx, fy] = dirVec(p.dir); ux = -fx; uy = -fy; back = true; }   // 서 있으면 백스텝
    const l = Math.hypot(ux, uy) || 1;
    p.atk = null;                                     // 공격을 끊고 피함
    p.dash = { t: 0, dur: dg.dur, ux: ux / l, uy: uy / l, spd: dg.dist / dg.dur, dodge: true, back };
    if (!back) p.dir = dirOf(ux, uy);
    p.inv = Math.max(p.inv, dg.inv);
    G.fx.push({ k: 'dust', x: p.x, y: p.y, t: 0, dur: 0.3 });
    hooks.hud && hooks.hud(G);
    return true;
  }

  // ── 진행 한 칸
  function update(dt) {
    const p = G.p;
    G.t += dt;
    for (const f of G.fx) f.t += dt;
    G.fx = G.fx.filter(f => f.t < f.dur);
    for (const n of G.nums) n.t += dt;
    G.nums = G.nums.filter(n => n.t < 0.6);
    G.shake = Math.max(0, G.shake - dt);
    if (G.hitStop > 0) { G.hitStop -= dt; return; }
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
      if (d.hit) near(p.x, p.y, 30, e => {          // 돌진 베기: 지나는 적에게 한 번씩
        if (d.hit.has(e.id) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + d.sk.w) return;
        d.hit.add(e.id);
        const side = Math.random() < 0.5 ? 1 : -1;
        if (hurtEnemy(e, G.dmg * d.sk.mul, -d.uy * d.sk.kb * side, d.ux * d.sk.kb * side)) G.hitStop = Math.max(G.hitStop, D.HIT_STOP * 0.6);
      });
      if (G.fx.length < 120) G.fx.push({ k: 'after', x: p.x, y: p.y - p.hop, dir: p.dir, col: heroCol(), t: 0, dur: d.dodge ? 0.16 : 0.2 });
      if (solve(p, 5) || d.t >= d.dur) { p.dash = null; p.hop = 0; }
    } else if (p.moving) {
      const spd = D.HERO.speed * (p.atk ? D.MOVE_WHILE_ATK : 1);
      p.x += mx * spd * dt; p.y += my * spd * dt;
      p.vx = mx; p.vy = my;
      p.walkT += dt * (0.6 + ml);
      if (!p.atk) p.dir = dirOf(mx, my);
    }
    solve(p, 5);
    p.hp = Math.min(p.maxHp, p.hp + D.HERO.regen * dt);
    p.hurtT = Math.max(0, p.hurtT - dt);
    p.inv = Math.max(0, p.inv - dt);
    G.dodgeCd = Math.max(0, G.dodgeCd - dt);
    for (let i = 0; i < G.cds.length; i++) G.cds[i] = Math.max(0, G.cds[i] - dt);
    if (p.atk) {                                       // 동작 칸 넘기기 · 피해 칸에서 한 번
      const a = p.atk;
      a.t += dt;
      let acc = 0, fi = 0;
      while (fi < a.fds.length - 1 && a.t >= acc + a.fds[fi]) { acc += a.fds[fi]; fi++; }
      a.fi = fi;
      if (!a.done && fi >= a.hit) { a.done = true; a.onHit && a.onHit(a); }
      if (a.t >= a.total) { p.atk = null; p.lastAtk = G.t; }
    }
    G.spawnT -= dt;
    if (G.spawnT <= 0) { G.spawnT = 1.2; if (G.enemies.length < D.alive(G.lv)) spawnPack(); }
    rebuildGrid();
    if (!p.atk && !p.dash) { const tg = nearestEnemy(D.HERO.range); if (tg) startCombo(tg); }   // 일반 공격(3연타) 자동
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const dx = p.x - e.x, dy = p.y - e.y, l = Math.hypot(dx, dy) || 1;
      const stick = l < e.r + p.r + 2;                // 붙으면 더 밀고 들어오지 않음
      e.x += ((stick ? 0 : dx / l * e.speed) + e.kx) * dt; e.y += ((stick ? 0 : dy / l * e.speed) + e.ky) * dt;
      e.kx *= 0.84; e.ky *= 0.84;
      const hit = solve(e, e.r * 0.8);
      if (hit) {                                      // 기둥을 끼고 돌아가게
        let tx = -hit.y, ty = hit.x;
        if (tx * dx + ty * dy < 0) { tx = -tx; ty = -ty; }
        const tl = Math.hypot(tx, ty) || 1;
        e.x += tx / tl * e.speed * dt * 0.9; e.y += ty / tl * e.speed * dt * 0.9;
      }
      e.row = e.def.nondir ? 0 : (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0));
      e.animT += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.hitCd = Math.max(0, e.hitCd - dt);
      const cell = grid.get(Math.floor(e.x / GC) * 100003 + Math.floor(e.y / GC));
      if (cell && cell.length > 1) for (const o of cell) {
        if (o === e) continue;
        const ox = e.x - o.x, oy = e.y - o.y, d2 = ox * ox + oy * oy, rr = e.r + o.r;
        if (d2 > 0.01 && d2 < rr * rr) { const d = Math.sqrt(d2), push = (rr - d) * 0.3 / d; e.x += ox * push; e.y += oy * push; }
      }
      if (l < e.r + p.r + 3 && e.hitCd <= 0) {
        e.hitCd = 1.0;
        if (!G.god && p.inv <= 0) { p.hp -= e.dmg; p.hurtT = 0.25; G.nums.push({ x: p.x, y: p.y - 40, n: e.dmg, t: 0, c: '#ff6a5a' }); }
        if (p.hp <= 0) { p.hp = 0; G.over = true; hooks.over && hooks.over(G); return; }
      }
      if (l > Math.hypot(VW, VH) * 1.1) e.hp = 0;     // 너무 멀어진 적은 치움(새 무리가 다시 나옴)
    }
    G.enemies = G.enemies.filter(e => e.hp > 0);
    for (const g of G.gems) {
      const d2 = dist2(g, p);
      if (d2 < D.PICKUP * D.PICKUP) g.pull = true;
      if (g.pull) { const l = Math.sqrt(d2) || 1; g.x += (p.x - g.x) / l * 180 * dt; g.y += (p.y - g.y) / l * 180 * dt; }
      if (d2 < 64) { g.got = true; gainXp(g.v); }
    }
    G.gems = G.gems.filter(g => !g.got);
    for (const d of G.drops) {
      d.t += dt;
      if (dist2(d, p) < 196) {
        d.got = true;
        const v = Math.round(p.maxHp * D.HEAL_PCT);
        p.hp = Math.min(p.maxHp, p.hp + v);
        G.nums.push({ x: p.x, y: p.y - 40, n: '+' + v, t: 0, c: '#8dffb4' });
        G.fx.push({ k: 'sparkle', x: p.x, y: p.y - 18, t: 0, dur: 0.6, c: '#9dffc0' });
      }
    }
    G.drops = G.drops.filter(d => !d.got);
    for (const gh of G.ghosts) gh.t += dt;
    G.ghosts = G.ghosts.filter(gh => gh.t < 0.3);
  }
  function gainXp(v) {
    G.xp += v;
    while (G.xp >= D.xpNeed(G.lv)) {
      G.xp -= D.xpNeed(G.lv); G.lv++;
      const p = G.p;
      p.maxHp = Math.round(D.HERO.hp * (1 + D.LV_HP * (G.lv - 1))); p.hp = p.maxHp;          // 레벨 업 = 체력 가득
      G.dmg = D.HERO.dmg * (1 + D.LV_DMG * (G.lv - 1));
      G.fx.push({ k: 'sparkle', x: p.x, y: p.y - 18, t: 0, dur: 0.8, c: '#ffe08a' });
      G.fx.push({ k: 'lvup', x: p.x, y: p.y, t: 0, dur: 0.8 });
      hooks.toast && hooks.toast(`레벨 업! Lv ${G.lv}`);
    }
  }
  function sim(sec, bot) {                            // 시험: sec 초를 한 번에(봇 이동 · 알림 끔)
    const saved = hooks;
    hooks = {};
    try { for (let i = 0, n = Math.round(sec / STEP); i < n && !G.over; i++) { botMove = bot ? bot(G) : null; update(STEP); } }
    finally { botMove = null; hooks = saved; }
    return G;
  }

  // ── 그리기
  function tinted(im, sx, sy, w, h, color) {
    const key = im.src + '|' + sx + '|' + sy + '|' + color;
    let c = tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.drawImage(im, sx, sy, w, h, 0, 0, w, h);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
      tintCache.set(key, c);
      if (tintCache.size > 600) tintCache.delete(tintCache.keys().next().value);
    }
    return c;
  }
  function drawCell(def, row, col, x, y, flash, alpha, tint) {
    const im = img(def.file);
    if (!ready(im)) return;
    const [cw, ch] = def.cell, sx = col * cw, sy = row * ch;
    const dx = Math.round(x - def.foot[0]), dy = Math.round(y - def.foot[1]);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    if (tint) ctx.drawImage(tinted(im, sx, sy, cw, ch, tint), dx, dy);
    else ctx.drawImage(im, sx, sy, cw, ch, dx, dy, cw, ch);
    if (flash) { ctx.globalAlpha = 0.7; ctx.drawImage(tinted(im, sx, sy, cw, ch, '#fff'), dx, dy); }
    ctx.globalAlpha = 1;
  }
  function drawPiece(o, x, y, alpha) {               // 한 장 안의 조각(장식·물약): x·y·cell·foot
    const im = img(o.file);
    if (!ready(im)) return;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.drawImage(im, o.x, o.y, o.cell[0], o.cell[1], Math.round(x - o.foot[0]), Math.round(y - o.foot[1]), o.cell[0], o.cell[1]);
    ctx.globalAlpha = 1;
  }
  function shadow(x, y, rx, a) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.35, 0, 0, 7); ctx.fill(); }
  function monCol(def, row, t) {
    const n = (def.walkLen && def.walkLen[row]) || def.walk[1];
    return n <= 1 ? def.stand : def.walk[0] + (Math.floor(t * 7) % n);
  }
  function heroCol() {
    const p = G.p, h = A.hero, row = ROWS.indexOf(p.dir);
    if (p.atk) { const act = h.acts[p.atk.act]; return act.col + Math.min(act.len[row] - 1, p.atk.fi); }
    if (p.dash && p.dash.dodge) return h.walk[1];
    return p.moving ? h.walk[Math.floor(p.walkT * 8) % h.walk.length] : h.stand;
  }
  function sparkle(f) {                               // 반짝이(레벨 업·회복): 위로 흩어지는 작은 십자
    const k = f.t / f.dur;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.3, r = 4 + 14 * k * (0.6 + 0.4 * ((i * 37) % 5) / 5);
      const x = Math.round(f.x + Math.cos(a) * r), y = Math.round(f.y - 10 * k + Math.sin(a) * r * 0.6);
      ctx.globalAlpha = 1 - k; ctx.fillStyle = i % 2 ? '#ffffff' : f.c;
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    if (!cv) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c0a10'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!G) return;
    const p = G.p;
    const sh = G.shake > 0 ? Math.round(rand(-2, 2)) : 0, sv = G.shake > 0 ? Math.round(rand(-2, 2)) : 0;
    const ox = Math.floor(VW / 2 - p.x) + sh, oy = Math.floor(VH / 2 - p.y + 12) + sv;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const cx0 = Math.floor(-ox / CHUNK), cy0 = Math.floor(-oy / CHUNK);
    for (let cy = cy0; cy * CHUNK + oy < VH; cy++) for (let cx = cx0; cx * CHUNK + ox < VW; cx++) {
      const c = chunk(cx, cy);
      if (c) ctx.drawImage(c, cx * CHUNK + ox, cy * CHUNK + oy);
    }
    ctx.save(); ctx.translate(ox, oy);
    const inView = (x, y, m) => Math.abs(x - p.x) < VW / 2 + m && Math.abs(y - p.y) < VH / 2 + m + 12;
    for (const f of G.fx) {                          // 바닥에 깔리는 것
      const k = f.t / f.dur;
      if (f.k === 'storm') {
        ctx.globalAlpha = 0.35 * (1 - k); ctx.fillStyle = '#9ad8ff';
        ctx.beginPath(); ctx.ellipse(f.x, f.y + 8, f.r * (0.4 + 0.6 * k), f.r * 0.62 * (0.4 + 0.6 * k), 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      } else if (f.k === 'lvup') {
        ctx.globalAlpha = 0.6 * (1 - k); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - 1, 10 + 20 * k, 4 + 8 * k, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.k === 'dust') {
        ctx.globalAlpha = 0.5 * (1 - k); ctx.fillStyle = '#b8aec8';
        for (let i = -1; i <= 1; i += 2) { ctx.beginPath(); ctx.ellipse(f.x + i * (4 + 8 * k), f.y - 1, 3 + 2 * k, 1.5 + k, 0, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    for (const g of G.gems) {
      if (!inView(g.x, g.y, 8)) continue;
      ctx.fillStyle = g.v >= 5 ? '#ff5a6a' : g.v >= 3 ? '#4fe08a' : '#58b8ff';
      const x = Math.round(g.x), y = Math.round(g.y);
      ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 2, 1, 1);
    }
    for (const d of G.drops) {
      if (!inView(d.x, d.y, 20)) continue;
      shadow(d.x, d.y, 4, 0.3);
      drawPiece(A.items.potion, d.x, d.y - 2 + Math.round(Math.sin(d.t * 4) * 1.5));
    }
    if (dest) {
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(G.t * 10); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(dest.x, dest.y, 6, 3, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
    for (const f of G.fx) if (f.k === 'after') drawCell(A.hero, ROWS.indexOf(f.dir), f.col, f.x, f.y, false, 0.45 * (1 - f.t / f.dur), '#8fd8ff');
    // 적·주인공·기둥·장식(발 높이 순)
    const list = G.enemies.filter(e => inView(e.x, e.y, 60));
    list.push(p);
    for (let cy = Math.floor((p.y - VH / 2 - 60) / CHUNK); cy * CHUNK < p.y + VH / 2 + 80; cy++)
      for (let cx = Math.floor((p.x - VW / 2 - 60) / CHUNK); cx * CHUNK < p.x + VW / 2 + 60; cx++)
        for (const o of chunkInfo(cx, cy).solid) if (inView(o.x, o.y, 50)) list.push(o);
    list.sort((a, b) => a.y - b.y);
    for (const e of list) {
      if (e === p) {
        shadow(p.x, p.y - 1, 8, 0.32);
        if (!(p.hurtT > 0 && Math.floor(p.hurtT * 30) % 2)) drawCell(A.hero, ROWS.indexOf(p.dir), heroCol(), p.x, p.y - p.hop, false, p.inv > 0 && p.dash && p.dash.dodge ? 0.75 : 1);
      } else if (e.kind === 'pillar') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(Math.round(e.x0 + 2), Math.round(e.y1 - 1), e.x1 - e.x0, 4);
        drawPiece({ file: A.pillar.file, x: 0, y: 0, cell: A.pillar.cell, foot: A.pillar.foot }, e.x, e.y);
      } else if (e.kind === 'prop') {
        const o = A.props[e.name];
        if (e.r) shadow(e.x, e.y, o.cell[0] * 0.4, 0.28);
        drawPiece(o, e.x, e.y);
      } else {
        shadow(e.x, e.y - 1, e.r + 1, 0.25);
        drawCell(e.def, e.row, monCol(e.def, e.row, e.animT), e.x, e.y, e.flash > 0);
      }
    }
    for (const gh of G.ghosts) drawCell(gh.def, gh.row, gh.def.stand, gh.x, gh.y, false, 1 - gh.t / 0.3);
    for (const f of G.fx) {                          // 위 효과
      const k = f.t / f.dur;
      if (f.k === 'spark') {
        ctx.globalAlpha = 1 - k; ctx.fillStyle = '#fff';
        const s = Math.round(2 + 4 * k), x = Math.round(f.x), y = Math.round(f.y);
        ctx.fillRect(x - s, y, s * 2 + 1, 1); ctx.fillRect(x, y - s, 1, s * 2 + 1);
        ctx.fillStyle = '#9ae6ff'; ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.globalAlpha = 1;
      } else if (f.k === 'ring') {
        ctx.globalAlpha = 0.9 * (1 - k); ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.55 + 0.45 * k), f.r * 0.6 * (0.55 + 0.45 * k), 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 1; ctx.stroke(); ctx.globalAlpha = 1;
      } else if (f.k === 'storm') {
        ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.3 + 0.7 * k), f.r * 0.6 * (0.3 + 0.7 * k), 0, 0, 7); ctx.stroke();
        for (let i = 0; i < 10; i++) {               // 사방으로 뻗는 칼바람
          const a = i * Math.PI / 5 + f.t * 4, r0 = f.r * 0.25 * (1 + k), r1 = f.r * (0.55 + 0.45 * k);
          ctx.strokeStyle = i % 2 ? '#9ae6ff' : '#ffffff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * 0.6); ctx.lineTo(f.x + Math.cos(a + 0.3) * r1, f.y + Math.sin(a + 0.3) * r1 * 0.6); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (f.k === 'sparkle') sparkle(f);
    }
    ctx.restore();
    // 글자(기기 픽셀): 피해 숫자
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = `bold ${Math.round(6.5 * S)}px sans-serif`; ctx.textAlign = 'center';
    ctx.lineWidth = Math.max(2, S * 0.9); ctx.strokeStyle = '#000';
    for (const n of G.nums) {
      const x = (n.x + ox) * S, y = (n.y + oy - n.t * 14) * S;
      ctx.globalAlpha = Math.min(1, 2 - n.t * 3);
      ctx.strokeText(n.n, x, y); ctx.fillStyle = n.c || '#fff'; ctx.fillText(n.n, x, y);
    }
    ctx.globalAlpha = 1;
    if (joy && joy.mode === 'point') {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(joy.x * dpr, joy.y * dpr, 12 * dpr, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (joy) {                                 // 왼손 조이스틱
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
    if (G && !G.paused && !G.over) {
      acc += dt * speed;
      let n = 0;
      while (acc >= STEP && n < 10) { update(STEP); acc -= STEP; n++; if (G.over || G.paused) break; }
      if (n >= 10) acc = 0;
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.08; hooks.hud && hooks.hud(G); }
    }
    render();
  }

  function init(canvas, art, h) {
    cv = canvas; ctx = cv.getContext('2d');
    A = art; hooks = h;
    for (const m of A.monsters) img(m.file);
    for (const f of [A.hero.file, A.tiles.file, A.pillar.file, A.items.potion.file]) img(f);
    resize();
    window.addEventListener('resize', resize);
    // 조작: 터치 = 화면 왼쪽 절반에서 누른 자리가 조이스틱 중심(오른쪽은 버튼 손) · 마우스 = 누른 곳으로
    cv.addEventListener('pointerdown', e => {
      e.preventDefault();
      const mode = ctrl === 'auto' ? (e.pointerType === 'mouse' ? 'point' : 'stick') : ctrl;
      if (mode === 'stick' && joy) return;            // 이미 왼손이 잡고 있음
      if (mode === 'stick' && ctrl === 'auto' && e.offsetX > cv.clientWidth * 0.55) return;   // 오른쪽 = 버튼 손
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
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      if (!G || e.repeat) return;
      if (e.code === 'Digit1' || e.code === 'KeyJ') useSkill(0);
      else if (e.code === 'Digit2' || e.code === 'KeyK') useSkill(1);
      else if (e.code === 'Digit3' || e.code === 'KeyL') useUlt();
      else if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') dodge();
    });
    window.addEventListener('keyup', e => keys.delete(e.code));
    window.addEventListener('blur', () => keys.clear());
    requestAnimationFrame(loop);
  }

  return {
    init, start, resize, useSkill, useUlt, dodge, img,
    get G() { return G; },
    setSpeed(v) { speed = v; }, get speed() { return speed; },
    setCtrl(v) { ctrl = v; joy = null; dest = null; }, get ctrl() { return ctrl; },
    setZoom(z) { zoomAdj = Math.max(0, z | 0); resize(); }, get zoomAdj() { return zoomAdj; },
    pause(v) { if (G) G.paused = v; },
    test: {
      sim,
      god() { G.god = !G.god; return G.god; },
      level() { gainXp(D.xpNeed(G.lv) - G.xp); },
      fill() { G.gauge = D.ULT.need; },
      bench(n) { const t0 = performance.now(); for (let i = 0; i < n; i++) render(); return (performance.now() - t0) / n; },
    },
  };
})();
