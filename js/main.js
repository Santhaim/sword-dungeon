// 화면 위 글자·버튼·창 — 마을(출정·장비·축복·대장간·도전·설정) · 레벨 업 카드 · 상자 · 결과 · 일시정지
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const D = DATA;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const click = () => SFX.play('click');
  if (!window.ART) {
    $('pbox').innerHTML = '<h2>그림 묶음이 없습니다</h2><p>py work\\tools\\make_hns_art.py art_orig hns</p>';
    $('panel').hidden = false;
    return;
  }
  const P = () => SAVE.P;
  SFX.on = P().sound;
  BGM.on = P().music !== false; BGM.vol = P().musicVol ?? 0.5;   // 배경음(10-22 · 기록에 없으면 켜짐·보통)
  // 배경음 켜기·크기 줄(마을 설정 · 일시정지 설정에 같은 줄)
  const musicRow = () => `<div class="row"><button id="bgm" class="${BGM.on ? 'on' : ''}">${BGM.on ? '배경음 켜짐' : '배경음 꺼짐'}</button>
      <label class="vol">크기 <input id="bgmv" type="range" min="0" max="100" step="5" value="${Math.round(BGM.vol * 100)}"></label></div>`;
  function bindMusic(box) {
    box.querySelector('#bgm').onclick = e => { BGM.on = !BGM.on; P().music = BGM.on; SAVE.save(); e.target.classList.toggle('on', BGM.on); e.target.textContent = BGM.on ? '배경음 켜짐' : '배경음 꺼짐'; };
    box.querySelector('#bgmv').oninput = e => { BGM.vol = e.target.value / 100; P().musicVol = BGM.vol; };
    box.querySelector('#bgmv').onchange = () => SAVE.save();
  }
  const fmtTime = t => { const s = Math.max(0, Math.floor(t)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const clsOK = k => !!ART.heroes[k];                  // 그림이 있는 직업만 고를 수 있음

  // ── 화면 위 글자(판 안)
  const cool = (b, k) => { b.style.setProperty('--cd', (Math.max(0, Math.min(1, k)) * 100).toFixed(1) + '%'); b.classList.toggle('wait', k > 0); };
  // 스킬 버튼 칸 → 스킬 번호(10-22 회피를 빼고 몸 옮기기 스킬을 그 자리에): 자동 스킬은 위쪽 S2 · 손 스킬은 큰 회피 칸 · S1 은 숨김
  const slotOf = (C, btn) => btn === 'bDodge' ? C.skills.indexOf(C.manual) : btn === 'bS2' ? C.skills.findIndex(k => k !== C.manual) : -1;
  let abilSig = '';
  function hud(G) {
    const p = G.p;
    BGM.follow(G);                                    // 배경음: 그 던전 곡 · 보스가 있으면 보스 곡 · 6·9분에 세짐
    $('hLv').textContent = 'Lv ' + G.lv;
    $('hpFill').style.width = (100 * p.hp / p.maxHp) + '%';
    $('hpTxt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('xpFill').style.width = Math.min(100, 100 * G.xp / D.xpNeed(G.lv)) + '%';
    $('hKills').textContent = '☠ ' + G.kills;
    $('hGold').textContent = '💰 ' + G.gold;
    const tm = $('hTime');
    tm.textContent = fmtTime(G.t);
    tm.classList.toggle('late', G.t >= D.RUN.boss - 60 && !G.bossDone);
    for (const id of ['bS2', 'bDodge']) {
      const i = slotOf(G.C, id);
      if (i >= 0) cool($(id), G.cds[i] / G.cdMax[i]); else if (id === 'bDodge') cool($(id), G.dodgeCd / G.dodgeMax);   // 손 스킬이 없는 직업이면 예전 회피
    }
    const g = G.ultCd > 0 ? 1 - G.ultCd / Math.max(0.01, G.ultMax) : 1;          // 필살: 재사용 대기가 줄수록 금빛이 참
    $('bUlt').style.setProperty('--g', (Math.max(0, Math.min(1, g)) * 100).toFixed(1) + '%');
    $('bUlt').classList.toggle('full', g >= 1);
    $('buffs').textContent = (G.buff.fury > 0 ? `🔥 공격 ${Math.ceil(G.buff.fury)}  ` : '') + (G.buff.swift > 0 ? `💨 속도 ${Math.ceil(G.buff.swift)}` : '');
    const b = G.boss;
    $('bossBar').hidden = !b;
    if (b) { $('bossFill').style.width = (100 * Math.max(0, b.hp) / b.maxHp) + '%'; $('bossBar').classList.toggle('rage', !!b.boss.rage); }
    // 가진 능력·패시브(작은 아이콘 + 단계)
    const sig = G.abil.map(a => a.k + a.lv).join() + '|' + Object.keys(G.evo).join() + '|' + Object.entries(G.pass).map(([k, v]) => k + v.lv).join();
    if (sig !== abilSig) {
      abilSig = sig;
      const ab = G.abil.map(a => { const AB = D.ABILITIES[a.k], ev = G.evo[AB.evo]; return `<i class="${ev ? 'evo' : ''}">${ev ? D.EVOS[AB.evo].icon : AB.icon}<sub>${ev ? '★' : a.lv}</sub></i>`; });
      const ps = Object.entries(G.pass).map(([k, v]) => `<i class="ps">${D.PASSIVES[k].icon}<sub>${v.lv}</sub></i>`);
      $('abil').innerHTML = ab.join('') + (ps.length ? '<s></s>' : '') + ps.join('');
    }
  }
  let toastT = null;
  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1600);
  }
  function loot(html, color, sec) {                   // 오른쪽 위 «주운 것» 줄(sec 초 뒤 사라짐 · 기본 2.6)
    const el = document.createElement('div'), s = (sec || 2.6) * 1000;
    el.className = 'lt'; el.style.color = color || '#fff'; el.innerHTML = html;
    $('loot').prepend(el);
    while ($('loot').children.length > 4) $('loot').lastChild.remove();
    setTimeout(() => el.classList.add('off'), s);
    setTimeout(() => el.remove(), s + 600);
    return el;
  }
  let bannerT = null;
  function banner(small, big, color) {
    const b = $('banner');
    b.querySelector('small').textContent = small; b.querySelector('b').textContent = big;
    b.style.color = color || '#ffcf5a'; b.classList.add('on');
    clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 2400);
  }

  // 버튼은 눌린 순간 바로(떼기 기다리지 않음) · 여러 손가락 동시에
  const press = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); SFX.unlock(); fn(); });
  press('bS1', () => { const G = HNS.G; if (G) { const i = slotOf(G.C, 'bS1'); if (i >= 0) HNS.useSkill(i); } });
  press('bS2', () => { const G = HNS.G; if (G) { const i = slotOf(G.C, 'bS2'); if (i >= 0) HNS.useSkill(i); } });
  press('bUlt', () => HNS.useUlt());
  press('bDodge', () => HNS.useMove());
  const orient = () => { $('rotate').hidden = innerWidth >= innerHeight; };
  window.addEventListener('resize', orient); orient();

  // ── 창
  let panelLoop = null;
  function open(html, onOpen, wide) {
    const box = $('pbox');
    box.className = wide ? 'wide' : '';
    box.innerHTML = html; $('panel').hidden = false; panelLoop = null;
    box.scrollTop = 0;
    if (onOpen) onOpen(box);
  }
  function close() { $('panel').hidden = true; panelLoop = null; }
  function loopPanel(draw) {
    const me = {}; panelLoop = me;
    (function f(t) { if (panelLoop !== me) return; draw(t); requestAnimationFrame(f); })(performance.now());
  }
  async function fullscreen() {                       // 폰: 전체 화면 + 가로 고정(되는 기기만)
    try { await document.documentElement.requestFullscreen(); } catch (e) { /* 안 되는 브라우저 */ }
    try { await screen.orientation.lock('landscape'); } catch (e) { /* 안 되는 기기 */ }
    setTimeout(() => HNS.resize(), 300);
  }
  const setMode = town => { $('app').classList.toggle('town', town); };
  // 폰에 설치(10-22 사용자 «내 폰에 설치할 수 있게»): 크롬이 «설치할 수 있음»을 알려 주면 출정 탭에 단추 · 설치한 앱으로 열면 안 보임
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); installEvt = e;
    if ($('app').classList.contains('town') && tab === 'go') showTown('go');
  });
  window.addEventListener('appinstalled', () => { installEvt = null; toast('설치했습니다 — 홈 화면의 «던전 원정대»로 여세요'); });

  // 주인공 미리보기(서기 → 걷기 → 3연타/활)
  function heroPreview(c, cls) {
    const g = c.getContext('2d'), h = ART.heroes[cls] || ART.heroes.swordsman;
    const acts = Object.keys(h.acts);
    const seq = [h.stand, h.stand].concat(h.walk, h.walk, ...acts.map(k => Array.from({ length: h.acts[k].len[0] }, (_, i) => h.acts[k].col + i)), [h.stand, h.stand]);
    let row = 0, last = -1;
    loopPanel(t => {
      if (!c.isConnected) return;
      const im = HNS.img(h.file);
      if (!im.complete || !im.naturalWidth) return;
      const f = Math.floor(t / 110) % seq.length;
      if (f === last) return;
      if (f === 0 && last > 0) row = (row + 1) % 4;
      last = f;
      g.clearRect(0, 0, c.width, c.height);
      g.imageSmoothingEnabled = false;
      g.drawImage(im, seq[f] * h.cell[0], [0, 2, 3, 1][row] * h.cell[1], h.cell[0], h.cell[1], 0, 0, c.width, c.height);
    });
  }

  // ── 아이템 글
  const SLOT_IC = { weapon: '⚔', armor: '🛡', ring: '💍', amulet: '📿' };
  // 아이콘(10-22 «그럴싸하게» → js/icons.js 도트 그림)
  const itemIcon = it => `<img class="ico" src="${ICONS.url(it)}" alt="">`;
  const slotIcon = s => `<img class="ico dim" src="${ICONS.slotUrl(s)}" alt="">`;
  const itemName = it => (it.up ? `+${it.up} ` : '') + it.name;
  const statsOf = it => { const s = {}, k = D.affixScale(it.ilvl, it.up); for (const a of it.aff) s[a.k] = (s[a.k] || 0) + a.v * k; return s; };
  const fmtGap = (k, v) => k === 'regen' ? Math.abs(v).toFixed(1) : k === 'lifesteal' ? (Math.abs(v) * 100).toFixed(1) + '%' : Math.round(Math.abs(v) * 100) + '%';
  // 강화 맞춰 견주기(10-24 사용자 «동렙일 때 비교도» → 시안 셋 중 A «한 줄»): 아이템 레벨은 주운 던전으로 정해져 못 올리니 «지금 낀 것만큼 강화하면»으로 견줌
  //   지금은 ▼·≈ 인데 낀 것만큼 강화하면 ▲ 가 되는 장비에만 한 줄 + 드는 금화 · 나머지 카드는 그대로
  const upCost = (it, to) => { let c = 0; for (let u = it.up; u < to; u++) c += D.SMITH.cost(u, it.rar); return c; };
  function upHint(it, vs) {
    if (!vs || vs === 'empty' || vs.up <= it.up) return '';
    const base = HNS.itemScore(vs), now = HNS.itemScore(it) - base, up = HNS.itemScore(Object.assign({}, it, { up: vs.up })) - base;
    if (now >= 0.3 || up < 0.3) return '';
    return `<div class="uph">🔨 +${vs.up}까지 강화하면 <i class="cmp up">▲ 좋아짐</i> <small>${upCost(it, vs.up)}💰</small></div>`;
  }
  // 성질 줄 · vs = 비교할 «지금 낀 것»(10-22 사용자 «착용템이랑 인벤토리 템 수치 비교해서 +−») — 줄마다 ▲초록 / ▼빨강 · 낀 것에만 있던 성질은 «빠짐» 줄
  //   (받는 피해·재사용 대기도 값이 클수록 좋음 → 모든 성질이 ▲ = 좋아짐)
  function affLines(it, vs) {
    const s = D.affixScale(it.ilvl, it.up), mine = statsOf(it), theirs = vs && vs !== 'empty' ? statsOf(vs) : vs === 'empty' ? {} : null, shown = new Set();
    let h = it.aff.map(a => {
      const A = D.AFFIXES[a.k], v = a.v * s;
      let gap = '';
      if (theirs && !shown.has(a.k)) {
        shown.add(a.k);
        const d = mine[a.k] - (theirs[a.k] || 0);
        if (Math.abs(d) >= 0.004) gap = ` <em class="${d > 0 ? 'up' : 'dn'}">${d > 0 ? '▲' : '▼'}${fmtGap(a.k, d)}</em>`;
      }
      return `<li class="${a.imp ? 'imp' : ''}">${A.name} ${v < 0 ? '−' + Math.round(-v * 100) + '%' : A.fmt(v)}${gap}</li>`;
    }).join('');
    if (it.uniq) h += `<li class="uq">★ ${esc(D.UNIQUES[it.uniq].desc)}${vs && vs !== 'empty' && vs.uniq !== it.uniq ? ' <em class="up">새 효과</em>' : ''}</li>`;
    if (theirs) {
      for (const k in theirs) if (!(k in mine) && Math.abs(theirs[k]) >= 0.004) h += `<li class="lost">${D.AFFIXES[k].name} <em class="dn">▼${fmtGap(k, theirs[k])}</em> <small>빠짐</small></li>`;
      if (vs !== 'empty' && vs.uniq && vs.uniq !== it.uniq) h += `<li class="lost">★ ${esc(D.UNIQUES[vs.uniq].name)} <small>효과 빠짐</small></li>`;
    }
    return h;
  }
  // 낀 것과 견준 한 줄 머리표: 칸이 비었으면 «빈 칸» · 아니면 점수(성질 크기·레벨·강화·전설)로 ▲ 좋아짐 / ▼ 나빠짐 / 비슷
  function cmpBadge(it, vs) {
    if (!vs) return '';
    if (vs === 'empty') return '<i class="cmp up">▲ 빈 칸</i>';
    const d = HNS.itemScore(it) - HNS.itemScore(vs);
    return Math.abs(d) < 0.3 ? '<i class="cmp eq">≈ 비슷</i>' : d > 0 ? '<i class="cmp up">▲ 좋아짐</i>' : '<i class="cmp dn">▼ 나빠짐</i>';
  }
  function itemHtml(it, attrs, extra, vs) {           // vs = 견줄 «지금 낀 것»(빈 칸이면 'empty' · 안 견주면 없음)
    const R = D.ITEM_RARITY[it.rar];
    return `<div class="it r${it.rar}" ${attrs || ''} style="--rc:${R.color}"><div class="ih"><span class="ii">${itemIcon(it)}</span><b>${esc(itemName(it))}${it.isNew ? ' <i class="new">새</i>' : ''}</b>
      <small>${R.name} · ${D.SLOTS[it.slot]} · Lv${it.ilvl}${cmpBadge(it, vs)}</small></div><ul>${affLines(it, vs)}</ul>${upHint(it, vs)}${extra || ''}</div>`;
  }
  const scrapOf = it => Math.round(D.ITEM_RARITY[it.rar].scrap * (1 + it.up * 0.3));
  const STAT_NAME = { dmg: '공격력', hp: '체력', speed: '이동 속도', atkspd: '공격 속도', crit: '치명타', critdmg: '치명 피해', cdr: '재사용 대기', lifesteal: '흡혈',
                      armor: '받는 피해', xp: '경험치', gold: '금화', pickup: '줍는 거리', area: '범위', skill: '스킬 피해', regen: '초당 회복', reroll: '다시 뽑기', revive: '두 번째 목숨',
                      ultc: '필살 충전' };
  // 능력치 표(10-22 사용자 «전체 능력치 + 레벨업 스킬·장비로 오른 몫은 () 안에»)
  //   [열쇠, 이름, 전체 값(직업, 합), 오른 몫(직업, 몫), 0 이어도 늘 보임]
  const pc = v => Math.round(v * 100) + '%';
  const STAT_ROWS = [
    ['hp', '체력', (C, s) => Math.round(C.hp * (1 + s)), (C, v) => '+' + Math.round(C.hp * v), 1],
    ['dmg', '공격력', (C, s) => +(C.dmg * (1 + s)).toFixed(1), (C, v) => '+' + +(C.dmg * v).toFixed(1), 1],
    ['atkspd', '공격 속도', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v), 1],
    ['speed', '이동 속도', (C, s) => Math.round(C.speed * (1 + Math.min(D.SPEED_CAP, s))), (C, v) => '+' + Math.round(C.speed * v), 1],
    ['crit', '치명타', (C, s) => pc(Math.min(0.75, D.CRIT.chance + s)), (C, v) => '+' + pc(v), 1],
    ['critdmg', '치명 피해', (C, s) => '×' + (D.CRIT.mul + s).toFixed(2), (C, v) => '+' + pc(v), 1],
    ['regen', '초당 회복', (C, s) => (C.regen + s).toFixed(1), (C, v) => '+' + v.toFixed(1), 1],
    ['skill', '스킬 피해', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v)],
    ['area', '범위', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v)],
    ['cdr', '재사용 대기', (C, s) => '−' + pc(Math.min(0.6, s)), (C, v) => '−' + pc(v)],
    ['ultc', '필살 충전', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v)],
    ['armor', '받는 피해', (C, s) => '−' + pc(Math.min(0.7, s)), (C, v) => '−' + pc(v)],
    ['lifesteal', '흡혈', (C, s) => (s * 100).toFixed(1) + '%', (C, v) => '+' + (v * 100).toFixed(1) + '%'],
    ['xp', '경험치', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v)],
    ['gold', '금화', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v)],
    ['pickup', '줍는 거리', (C, s) => '+' + pc(s), (C, v) => '+' + pc(v)],
    ['pierce', '관통', (C, s) => '+' + Math.round(s), (C, v) => '+' + Math.round(v)],
  ];
  function statTable(C, parts) {
    const SRC = [['bless', '축복'], ['gear', '장비'], ['card', '레벨업']];
    return `<div class="stt">${STAT_ROWS.map(([k, name, total, part, always]) => {
      const sum = SRC.reduce((a, [s]) => a + (parts[s][k] || 0), 0);
      if (!sum && !always) return '';
      const bits = SRC.filter(([s]) => parts[s][k]).map(([s, n]) => `${n} ${part(C, parts[s][k])}`);
      return `<div><span>${name}</span><b>${total(C, sum)}</b>${bits.length ? `<small>(${bits.join(' · ')})</small>` : ''}</div>`;
    }).join('')}</div>`;
  }

  // ── 마을
  let tab = 'go';
  const TABS = [['go', '출정'], ['gear', '장비'], ['bless', '축복'], ['smith', '대장간'], ['ach', '도전'], ['opt', '설정']];
  function showTown(t) {
    if (t) tab = t;
    HNS.pause(true);
    setMode(true);
    BGM.follow(null);                                 // 마을 곡
    const done = HNS.checkAch();
    if (done.length) SAVE.save();
    const achNew = done.length;
    open(`<div class="town">
      <div class="th"><b>던전 원정대</b><span class="gold">💰 ${P().gold}</span></div>
      <div class="tabs">${TABS.map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${n}${k === 'ach' && achNew ? ' •' : ''}</button>`).join('')}</div>
      <div class="tc" id="tc"></div></div>`, box => {
      box.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { click(); showTown(b.dataset.t); });
      ({ go: townGo, gear: townGear, bless: townBless, smith: townSmith, ach: townAch, opt: townOpt })[tab](box.querySelector('#tc'));
      for (const a of done) loot(`🏆 ${esc(a.name)}`, '#ffcf5a');
    }, true);
  }
  // 같은 탭을 다시 그림 — 창(스크롤) 위치는 그대로(10-23 사용자 «분해 누르면 창이 위로 올라감 · 강화하면 위치가 바뀜»)
  function redrawTown() { const y = $('pbox').scrollTop; showTown(); $('pbox').scrollTop = y; }
  function townGo(el) {
    const pf = P();
    if (!clsOK(pf.cls) || !pf.unlocked.classes.includes(pf.cls)) pf.cls = 'swordsman';
    if (!pf.unlocked.dungeons.includes(pf.dungeon)) pf.dungeon = 'crypt';
    const C = D.CLASSES[pf.cls];
    const cls = Object.keys(D.CLASSES).map(k => {
      const ok = pf.unlocked.classes.includes(k) && clsOK(k);
      const why = !pf.unlocked.classes.includes(k) ? '잠김' : '그림 준비 중';
      return `<button data-c="${k}" class="${pf.cls === k ? 'on' : ''}" ${ok ? '' : 'disabled'}>${D.CLASSES[k].name}${ok ? '' : ` <small>${why}</small>`}</button>`;
    }).join('');
    const duns = D.DUNGEONS.map((d, i) => {
      const ok = pf.unlocked.dungeons.includes(d.key), cl = pf.stats.clears[d.key] || 0;
      const stars = '★'.repeat(i + 1);
      return `<button data-d="${d.key}" class="dun ${pf.dungeon === d.key ? 'on' : ''}" ${ok ? '' : 'disabled'}><b>${d.name}</b><small>${ok ? stars + (cl ? ` · 정복 ${cl}` : '') : '잠김'}</small></button>`;
    }).join('');
    const S = D.SKILLS, U = D.ULTS[C.ult];
    // 다음 목표(홀즈처럼 늘 하나): 아직 못 한 도전 과제 중 진행이 가장 많이 된 것
    const next = D.ACH.filter(a => !pf.ach[a.id]).map(a => { const [v, n] = a.need(pf); return { a, v, n, k: v / n }; }).sort((x, y) => y.k - x.k)[0];
    const goal = next ? `<div class="goal">🎯 다음 목표: <b>${next.a.name}</b> — ${next.a.desc} <span>${Math.min(next.v, next.n)} / ${next.n}</span></div>` : '<div class="goal">🏆 도전 과제를 모두 끝냈습니다!</div>';
    el.innerHTML = `<div class="go">
      <div class="gl"><canvas id="hero" width="96" height="96"></canvas>
        <div class="cdesc"><b>${C.name}</b><span>${esc(C.desc)}</span>
        <span class="dim">${C.skills.map(k => `${S[k].icon} ${S[k].name}`).join(' · ')} · ${U.icon} ${U.name}</span></div></div>
      <div class="gr">
        <div class="lbl">직업</div><div class="row wrap" id="cls">${cls}</div>
        <div class="lbl">던전 (12분 · 6분 중간 보스 · 12분 마지막 보스)</div><div class="duns" id="duns">${duns}</div>
        ${installEvt ? '<div class="row"><button id="inst" class="inst">📲 폰에 앱으로 설치</button></div>' : ''}
        <div class="row"><button id="fs">전체 화면으로 출정</button><button class="main" id="go">출정</button></div>
        ${goal}
        <details class="pst" open><summary>${C.name} 능력치 <small class="dim">— 괄호 = 축복·장비로 오른 몫</small></summary>${statTable(C, HNS.statParts(pf.cls))}</details>
        <details><summary>조작법</summary><div class="help">
          <b>왼손</b><span>화면 왼쪽을 눌러 끌면 이동</span>
          <b>공격</b><span>적이 가까이 오면 저절로(검사 3연타 · 궁수 화살)</span>
          <b>오른손</b><span>큰 단추 = 직업 기술(찌르기·도약·구르기·순간 이동 · 잠깐 무적) · 필살기(재사용 대기) · 스킬은 저절로</span>
          <b>키보드</b><span>WASD·방향키 이동 · Space 직업 기술 · 3 필살기 · Esc 일시정지 · 마우스는 누른 곳으로</span>
          <b>장비</b><span>주우면 더 좋을 때 바로 장착(아니면 오른쪽 위 «장착» 단추) · 주운 건 모두 창고로(쓰러져도)</span>
          <b>설치</b><span>크롬 ⋮ 메뉴 → «홈 화면에 추가» → «설치» · 아이폰은 사파리 공유 단추 → «홈 화면에 추가»</span>
          <b>요령</b><span>몬스터는 공격 전에 빨갛게 예고 — 그때 비키거나 회피 · 항아리는 부딪히거나 때리면 깨짐(회복약·자석·금화 · 드물게 숨은 상자)</span>
        </div></details>
      </div></div>`;
    heroPreview(el.querySelector('#hero'), pf.cls);
    el.querySelectorAll('#cls button').forEach(b => b.onclick = () => { click(); pf.cls = b.dataset.c; SAVE.save(); redrawTown(); });
    el.querySelectorAll('#duns button').forEach(b => b.onclick = () => { click(); pf.dungeon = b.dataset.d; SAVE.save(); redrawTown(); });
    el.querySelector('#go').onclick = () => startRun();
    el.querySelector('#fs').onclick = async () => { await fullscreen(); startRun(); };
    const ib = el.querySelector('#inst');
    if (ib) ib.onclick = async () => { click(); const ev = installEvt; installEvt = null; ev.prompt(); try { await ev.userChoice; } catch (e) { /* 닫음 */ } showTown('go'); };
  }
  function townGear(el) {
    const pf = P(), cls = pf.cls, eq = pf.equip[cls] || (pf.equip[cls] = {});
    const byId = id => pf.stash.find(i => i.id === id);
    const usable = it => it.slot !== 'weapon' || it.cls === cls;
    // 10-23 사용자 «인벤토리에 장비템은 안 보이게 · 장비 쪽에서 해제» → 장착한 것은 위 칸에만(해제 단추) · 창고 목록엔 안 낀 것만
    const slots = Object.keys(D.SLOTS).map(s => {
      const it = byId(eq[s]);
      return `<div class="slot" data-s="${s}">${it ? itemHtml(it, `data-id="${it.id}"`, '<div class="row"><button data-a="off">해제</button></div>') : `<div class="empty">${slotIcon(s)} ${D.SLOTS[s]} — 비어 있음</div>`}</div>`;
    }).join('');
    // 장착한 것(10-23 사용자 «다른 캐릭터가 장비하고 있는 것도 인벤토리에서 안 보이게») — 어느 직업이든 장착 중이면 창고 목록에서 뺌
    const allWorn = new Set(); for (const c in pf.equip) for (const s in pf.equip[c]) allWorn.add(pf.equip[c][s]);
    // 창고 장비마다 같은 칸에 «지금 장착한 것»과 견줌(다른 직업 무기는 안 견줌)
    const vsOf = it => !usable(it) ? null : byId(eq[it.slot]) || 'empty';
    const shown = pf.stash.filter(it => !allWorn.has(it.id)).sort((a, b) => b.rar - a.rar || b.ilvl - a.ilvl || a.id - b.id);
    const list = shown.map(it => itemHtml(it, `data-id="${it.id}"`,
      `<div class="row">${usable(it) ? '<button data-a="on">장착</button>' : '<button disabled>다른 직업 무기</button>'}
       <button data-a="scrap">분해 +${scrapOf(it)}💰</button></div>`, vsOf(it))).join('');
    // 한꺼번에 분해(10-22 주운 장비가 전부 창고로 들어오며 · 장착한 것·전설은 빼고)
    const bulk = maxRar => pf.stash.filter(it => it.rar <= maxRar && !it.uniq && !allWorn.has(it.id));
    const bulkBtn = (r, label) => { const xs = bulk(r); return `<button data-b="${r}" ${xs.length ? '' : 'disabled'}>${label} ${xs.length}개 분해 +${xs.reduce((a, it) => a + scrapOf(it), 0)}💰</button>`; };
    el.innerHTML = `<div class="lbl">${D.josa(D.CLASSES[cls].name, '이', '가')} 장착한 장비</div>
      <div class="slots">${slots}</div>
      <div class="lbl">능력치 <small class="dim">— 괄호 = 축복·장비로 오른 몫(판 안에선 레벨업 몫도 · 일시정지에서 봄)</small></div>${statTable(D.CLASSES[cls], HNS.statParts(cls))}
      <div class="lbl">창고 ${shown.length}개 <small class="dim">— 장착한 것(다른 직업 것도)은 빠짐 · 던전에서 주운 장비는 모두 여기로(쓰러져도) · 장착 포함 ${pf.stash.length} / ${D.STASH_MAX} · 넘치면 장착 안 한 낮은 등급부터 분해</small></div>
      <div class="row wrap">${bulkBtn(0, '일반')}${bulkBtn(1, '마법까지')}</div>
      <div class="items">${list || '<p>아직 없음 — 던전에서 주워 오세요</p>'}</div>`;
    el.querySelectorAll('button[data-b]').forEach(b => b.onclick = () => {
      click();
      const xs = new Set(bulk(+b.dataset.b));
      pf.gold += [...xs].reduce((a, it) => a + scrapOf(it), 0);
      pf.stash = pf.stash.filter(it => !xs.has(it)); SFX.play('coin');
      SAVE.save(); redrawTown();
    });
    el.querySelectorAll('.slots .it, .items .it').forEach(card => card.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => {
      click();
      const it = byId(+card.dataset.id);
      if (!it) return;
      if (b.dataset.a === 'on') eq[it.slot] = it.id;
      else if (b.dataset.a === 'off') delete eq[it.slot];
      else if (b.dataset.a === 'scrap') {
        for (const c in pf.equip) for (const s in pf.equip[c]) if (pf.equip[c][s] === it.id) delete pf.equip[c][s];
        pf.stash = pf.stash.filter(x => x !== it); pf.gold += scrapOf(it); SFX.play('coin');
      }
      SAVE.save(); redrawTown();
    }));
  }
  function townBless(el) {
    const pf = P();
    // 효과 글(10-23): «이름 지금 → 다음» · 받는 피해·재사용 대기는 «−» · 1.5% 같은 몫은 소수 한 자리까지
    const nameOf = (k, b) => k === 'regen' ? '초당 회복' : k === 'reroll' ? '카드 다시 뽑기' : STAT_NAME[b.stat];
    const valOf = (k, b, n) => k === 'regen' ? '+' + (b.v * n).toFixed(1) : k === 'reroll' ? n + '번' :
      (b.stat === 'armor' || b.stat === 'cdr' ? '−' : '+') + +(b.v * 100 * n).toFixed(1) + '%';
    el.innerHTML = `<p>금화로 영구 강화 — 모든 직업에 적용 <small class="dim">(능력치는 출정·장비 탭에서)</small></p><div class="bl">${Object.entries(D.BLESS).map(([k, b]) => {
      const lv = pf.bless[k] || 0, max = lv >= b.max, cost = D.blessCost(b, lv);
      const eff = k === 'revive' ? (max ? '최고 단계 · ' : '') + '판마다 한 번 되살아남'
        : max ? `최고 단계 · ${nameOf(k, b)} ${valOf(k, b, lv)}`
        : lv ? `${nameOf(k, b)} ${valOf(k, b, lv)} → ${valOf(k, b, lv + 1)}` : `다음: ${nameOf(k, b)} ${valOf(k, b, 1)}`;
      return `<div class="b"><span class="bi">${b.icon}</span><div><b>${b.name} <small class="dim">${lv} / ${b.max}</small></b><small>${eff}</small>
        <div class="pips">${Array.from({ length: b.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
        <button data-k="${k}" ${max || pf.gold < cost ? 'disabled' : ''}>${max ? '끝' : cost + '💰'}</button></div>`;
    }).join('')}</div>`;
    el.querySelectorAll('button[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k, B = D.BLESS[k], lv = pf.bless[k] || 0, cost = D.blessCost(B, lv);
      if (lv >= B.max || pf.gold < cost) return;
      pf.gold -= cost; pf.bless[k] = lv + 1; SAVE.save(); SFX.play('levelup'); redrawTown();
    });
  }
  function townSmith(el) {
    const pf = P(), S = D.SMITH;
    // 순서 = 등급 · 아이템 레벨 · 얻은 순(10-23 사용자 «강화하면 위치가 바뀜» — 강화 단계로 줄 세우던 것을 뺌)
    const list = pf.stash.slice().sort((a, b) => b.rar - a.rar || b.ilvl - a.ilvl || a.id - b.id).map(it => {
      const max = it.up >= S.max, cost = S.cost(it.up, it.rar);
      return itemHtml(it, `data-id="${it.id}"`, `<div class="row"><button data-a="up" ${max || pf.gold < cost ? 'disabled' : ''}>${max ? '최고 강화' : `+${it.up + 1} 강화 ${cost}💰`}</button></div>`);
    }).join('');
    el.innerHTML = `<p>강화 한 번마다 그 아이템의 모든 성질 +8% (실패 없음 · 최대 +${S.max})</p><div class="items">${list || '<p>창고가 비었습니다</p>'}</div>`;
    el.querySelectorAll('.items .it').forEach(card => { const b = card.querySelector('button[data-a]'); if (b) b.onclick = () => {
      const it = pf.stash.find(i => i.id === +card.dataset.id);
      if (!it || it.up >= S.max) return;
      const cost = S.cost(it.up, it.rar);
      if (pf.gold < cost) return;
      pf.gold -= cost; it.up++; SAVE.save(); SFX.play('slam'); redrawTown();
    }; });
  }
  function townAch(el) {
    const pf = P();
    const gift = g => [g.gold && `💰${g.gold}`, g.abil && `능력 «${D.ABILITIES[g.abil].name}» 해금`, g.dungeon && `던전 «${D.DUNGEONS.find(d => d.key === g.dungeon).name}» 열림`,
                       g.cls && `직업 «${D.CLASSES[g.cls].name}» 열림`].filter(Boolean).join(' · ');
    el.innerHTML = `<div class="ach">${D.ACH.map(a => {
      const [v, n] = a.need(pf), ok = pf.ach[a.id];
      return `<div class="a ${ok ? 'ok' : ''}"><span class="ai">${ok ? '🏆' : '🔒'}</span><div><b>${a.name}</b><small>${a.desc} — 보상: ${gift(a.gift)}</small>
        <div class="prog"><i style="width:${Math.min(100, 100 * v / n)}%"></i><span>${Math.min(v, n)} / ${n}</span></div></div></div>`;
    }).join('')}</div>`;
  }
  function townOpt(el) {
    const pf = P();
    const CTRL = [['auto', '자동'], ['stick', '조이스틱'], ['point', '누른 곳으로']];
    el.innerHTML = `<div class="lbl">소리</div><div class="row"><button id="snd" class="${pf.sound ? 'on' : ''}">${pf.sound ? '효과음 켜짐' : '효과음 꺼짐'}</button></div>${musicRow()}
      <div class="lbl">조작 — 자동: 터치는 왼쪽 반 조이스틱 · 마우스는 누른 곳으로</div>
      <div class="row" id="pct">${CTRL.map(([k, t]) => `<button data-c="${k}" class="${pf.ctrl === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="lbl">화면</div><div class="row"><button id="z0" class="${!pf.zoom ? 'on' : ''}">기본</button><button id="z1" class="${pf.zoom === 1 ? 'on' : ''}">크게</button><button id="z2" class="${pf.zoom === 2 ? 'on' : ''}">더 크게</button><button id="fs">전체 화면</button></div>
      <div class="lbl">시험용</div><div class="row"><button id="all">모두 열기(직업·던전·능력 + 금화 1만)</button><button id="wipe">기록 지우기</button></div>
      <p class="dim">기록은 이 브라우저에만 저장됩니다(홈 화면 앱도 같은 곳).</p>`;
    el.querySelector('#snd').onclick = () => { pf.sound = !pf.sound; SFX.on = pf.sound; SAVE.save(); click(); redrawTown(); };
    bindMusic(el);
    el.querySelectorAll('#pct button').forEach(b => b.onclick = () => { pf.ctrl = b.dataset.c; HNS.setCtrl(pf.ctrl); SAVE.save(); click(); redrawTown(); });
    for (const z of [0, 1, 2]) el.querySelector('#z' + z).onclick = () => { pf.zoom = z; HNS.setZoom(z); SAVE.save(); click(); redrawTown(); };
    el.querySelector('#fs').onclick = () => fullscreen();
    el.querySelector('#all').onclick = () => {
      pf.unlocked.classes = Object.keys(D.CLASSES); pf.unlocked.dungeons = D.DUNGEONS.map(d => d.key);
      pf.unlocked.abil = Object.keys(D.ABILITIES); pf.gold += 10000; SAVE.save(); SFX.play('chest'); showTown('opt'); toast('모두 열렸습니다');
    };
    let armed = false;
    el.querySelector('#wipe').onclick = e => {
      if (!armed) { armed = true; e.target.textContent = '정말 지울까요? 한 번 더'; return; }
      SAVE.reset(); SFX.on = SAVE.P.sound; BGM.on = SAVE.P.music !== false; HNS.setCtrl(SAVE.P.ctrl); HNS.setZoom(SAVE.P.zoom); showTown('go'); toast('기록을 지웠습니다');
    };
  }

  // ── 판
  function startRun() {
    const pf = P();
    close(); setMode(false);
    const C = D.CLASSES[pf.cls];
    for (const id of ['bS1', 'bS2']) {
      const i = slotOf(C, id);
      $(id).hidden = i < 0;
      $(id).classList.add('auto');                    // 10-22 스킬은 자동(버튼은 대기 표시 · 눌러도 됨)
      if (i >= 0) $(id).querySelector('span').textContent = D.SKILLS[C.skills[i]].short;
    }
    $('bUlt').querySelector('span').textContent = D.ULTS[C.ult].short;
    const mv = slotOf(C, 'bDodge');                   // 회피 칸 = 그 직업의 몸 옮기기(손으로)
    $('bDodge').querySelector('span').textContent = mv >= 0 ? D.SKILLS[C.skills[mv]].short : D.DODGE.short;
    abilSig = ''; $('abil').innerHTML = ''; $('loot').innerHTML = '';
    HNS.start(pf.cls, pf.dungeon);
    HNS.pause(false);
    const dun = D.DUNGEONS.find(d => d.key === pf.dungeon);
    banner('12분 버티고 마지막 보스를 쓰러뜨려라', dun.name);
  }
  // 레벨 업: 카드 셋(등급 색) · 다시 뽑기
  function cardHtml(c, i) {
    const R = D.RARITY[c.rar || 0];
    const kind = { skill: '직업 스킬', abil: '공격 스킬', pass: '패시브', evo: '진화', heal: '회복', gold: '금화' }[c.type];
    const lv = c.type === 'evo' ? '진화' : c.isNew ? '새로' : c.lv ? 'Lv ' + c.lv : '';
    return `<div class="card r${c.rar || 0}" data-i="${i}" style="--rc:${R.color}">
      <div class="rr">${R.name}</div><div class="ic">${c.icon || (c.type === 'gold' ? '💰' : '❤')}</div>
      <div class="nm">${esc(c.name)}</div><div class="lv">${kind}${lv ? ' · ' + lv : ''}</div>
      <div class="ds">${esc(c.desc || '')}</div>${c.extra ? `<div class="ex">${esc(c.extra)}</div>` : ''}${c.hint ? `<div class="ev">${esc(c.hint)}</div>` : ''}</div>`;
  }
  // 진화 짝(10-23 사용자 «스킬 고를 때 아래에 짝 패시브도 있으면 고를 때 도움») — 가진 공격 스킬마다 «단계 + 짝 패시브(가짐 ✓) → 진화»
  function pairsHtml(G) {
    if (!G.abil.length) return '';
    const xs = G.abil.map(a => {
      const AB = D.ABILITIES[a.k], PS = D.PASSIVES[AB.pair], EV = D.EVOS[AB.evo];
      if (G.evo[AB.evo]) return `<span class="done">${EV.icon} ${EV.name} ★</span>`;
      const has = !!G.pass[AB.pair], ready = has && a.lv >= AB.max;
      return `<span${ready ? ' class="go"' : ''}>${AB.icon} ${AB.name} ${a.lv}/${AB.max} + <b class="${has ? 'ok' : 'no'}">${PS.icon} ${PS.name} ${has ? '✓' : '없음'}</b> → ${EV.icon} ${EV.name}${ready ? ' · 상자!' : ''}</span>`;
    });
    return `<div class="pairs"><small>진화 짝</small>${xs.join('')}</div>`;
  }
  function showCards(G, offers) {
    open(`<h2>레벨 업! <small>Lv ${G.lv} · 공격 스킬 ${G.abil.length}/${D.MAX_ABIL} · 패시브 ${Object.keys(G.pass).length}/${D.MAX_PASS}</small></h2>
      <div class="cards">${offers.map(cardHtml).join('')}</div>
      ${pairsHtml(G)}
      <div class="row">${G.rerolls > 0 ? `<button id="rr">🔁 다시 뽑기 (${G.rerolls})</button>` : ''}</div>`, box => {
      const t0 = performance.now();
      box.querySelectorAll('.card').forEach(el => el.onclick = () => {
        if (performance.now() - t0 < 400) return;     // 싸우다 누르던 손가락이 바로 고르지 않게
        close(); HNS.pickCard(offers[+el.dataset.i]);
      });
      const rr = box.querySelector('#rr');
      if (rr) rr.onclick = () => { const o = HNS.reroll(); if (o) showCards(G, o); };
    }, true);
  }
  // 상자: 아이콘이 돌다가 멈춤(뱀서 룰렛) — 누르면 바로 멈춤
  function showChest(G, rewards) {
    const pool = Object.values(D.ABILITIES).map(a => a.icon).concat(Object.values(D.PASSIVES).map(p => p.icon), ['⚔', '🌀', '💨', '💥', '💰']);
    open(`<h2>${rewards.length > 1 ? '큰 보물 상자!' : '보물 상자!'}</h2>
      <div class="cards" id="slots">${rewards.map((c, i) => `<div class="card spin" data-i="${i}" style="--rc:#888"><div class="ic">❔</div><div class="nm">…</div></div>`).join('')}</div>
      <div class="row"><button class="main" id="ok" disabled>받기</button></div>`, box => {
      const slots = [...box.querySelectorAll('#slots .card')];
      const t0 = performance.now(), stopAt = rewards.map((_, i) => 900 + i * 450);
      let skip = false, done = 0;
      const reveal = i => { slots[i].outerHTML = cardHtml(rewards[i], i); SFX.play(rewards[i].rar >= 3 ? 'legend' : 'card'); };
      loopPanel(t => {
        let left = 0;
        slots.forEach((el, i) => {
          if (el.dataset.done) return;
          if (skip || t - t0 > stopAt[i]) { el.dataset.done = 1; done++; reveal(i); return; }
          left++;
          if (Math.floor(t / 70) !== +(el.dataset.f || -1)) { el.dataset.f = Math.floor(t / 70); el.querySelector('.ic').textContent = pool[Math.floor(Math.random() * pool.length)]; SFX.play('roll'); }
        });
        if (!left && done >= slots.length) { const ok = box.querySelector('#ok'); if (ok && ok.disabled) ok.disabled = false; }
      });
      box.querySelector('#slots').onclick = () => { skip = true; };
      box.querySelector('#ok').onclick = () => { close(); HNS.nextPanel(); };
    }, true);
  }
  function onBoss(G, e) {
    if (!e) return;
    const kind = e.boss.final ? '마지막 보스' : (G.dun && e.boss.key !== G.dun.mid ? '보스 출현' : '중간 보스');   // 3·9분 보스(지하 묘지 젤리) = «보스 출현»
    banner(kind, e.boss.def.name, e.boss.final ? '#ff6a5a' : '#ffb04a');
    $('bossName').textContent = e.boss.def.name;
  }
  // 장비를 주우면(10-22 «해머워치2처럼 바로 줍고 장비»): 더 좋으면 이미 장착(«장착!») · 아니면 줄에 «장착» 단추(5초 · 멈추지 않고 바로 장착)
  //   10-23 사용자 «끼기·빼기 말고 다른 말» → 장착·해제(판 중 가방은 «장착 중»)
  function onItem(G, it, on) {
    const R = D.ITEM_RARITY[it.rar];
    const el = loot(`${itemIcon(it)} ${esc(it.name)} <small>${R.name}</small>${on ? ' <em>장착!</em>' : ' <button class="ltb">장착</button>'}`, R.color, on ? 2.6 : 5);
    const b = el.querySelector('.ltb');
    if (b) b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (HNS.G === G && !G.done) { HNS.wear(it); b.outerHTML = '<em>장착!</em>'; } });
  }
  function buildHtml(G) {
    const ab = G.abil.map(a => {                      // 진화 전이면 짝 패시브(10-23 · 다 갖추면 «진화 준비»)
      const AB = D.ABILITIES[a.k], ev = G.evo[AB.evo], ready = a.lv >= AB.max && G.pass[AB.pair];
      const tip = ev ? '' : ready ? ' <small class="go">진화 준비 — 상자!</small>' : ` <small>+${D.PASSIVES[AB.pair].name}</small>`;
      return `<span>${ev ? D.EVOS[AB.evo].icon + ' ' + D.EVOS[AB.evo].name + ' ★' : AB.icon + ' ' + AB.name + ' ' + a.lv}${tip}</span>`;
    });
    const ps = Object.entries(G.pass).map(([k, v]) => `<span>${D.PASSIVES[k].icon} ${D.PASSIVES[k].name} ${v.lv}</span>`);
    const C = G.C, sk = [[C.basic, 'basic'], ...C.skills.map((k, i) => [D.SKILLS[k].name, 's' + i]), [D.ULTS[C.ult].name, 'ult']]
      .map(([n, k]) => `<span>${n} ${G.skLv[k]}</span>`);
    return `<div class="build">${sk.join('')}</div>
      <div class="build"><span class="dim">공격 스킬 ${G.abil.length}/${D.MAX_ABIL}</span>${ab.join('')}</div>
      <div class="build"><span class="dim">패시브 ${ps.length}/${D.MAX_PASS}</span>${ps.join('')}</div>`;
  }
  function showPause() {
    const G = HNS.G;
    if (!G || G.over || G.done || !$('panel').hidden) return;
    HNS.pause(true);
    const slots = Object.keys(D.SLOTS);
    const wornHtml = slots.map((s, i) => `<div class="slot">${G.worn[i] ? itemHtml(G.worn[i]) : `<div class="empty">${slotIcon(s)} ${D.SLOTS[s]} — 비어 있음</div>`}</div>`).join('');
    // 최근에 주운 것부터 · 장착한 것은 위 칸에만(10-23 «인벤토리에 장비템은 안 보이게») · 지금 장착한 것과 견줌
    const bag = G.bag.slice().reverse().filter(it => !G.worn.includes(it)).map(it => { const i = slots.indexOf(it.slot);
      return itemHtml(it, `data-id="${it.id}"`, '<div class="row"><button data-a="wear">장착</button></div>', G.worn[i] || 'empty'); }).join('');
    open(`<h2>일시정지 <small>${fmtTime(G.t)} · ${G.dun.name}</small></h2>
      ${buildHtml(G)}
      <details open><summary>능력치 — 괄호 = 축복·장비·레벨업으로 오른 몫</summary>${statTable(G.C, HNS.statParts())}</details>
      <details ${G.bag.length ? 'open' : ''}><summary>장비 — 장착한 것 · 이번 판에 주운 것 ${G.bag.length}개(끝나면 모두 창고로)</summary>
        <div class="lbl">장착한 장비</div><div class="slots">${wornHtml}</div>
        <div class="lbl">이번 판에 주운 것 — 장착 안 한 것(최근 것부터)</div><div class="items">${bag || '<p>장착 안 한 주운 장비 없음</p>'}</div></details>
      <details><summary>설정</summary>
        <div class="row"><button id="snd" class="${SFX.on ? 'on' : ''}">${SFX.on ? '효과음 켜짐' : '효과음 꺼짐'}</button><button id="pfs">전체 화면</button></div>
        ${musicRow()}
        <div class="row" id="pct">${[['auto', '자동'], ['stick', '조이스틱'], ['point', '누른 곳으로']].map(([k, t]) => `<button data-c="${k}" class="${HNS.ctrl === k ? 'on' : ''}">${t}</button>`).join('')}</div>
        <div class="row"><button id="z0">화면 기본</button><button id="z1">크게</button><button id="z2">더 크게</button></div></details>
      <details><summary>시험 메뉴</summary>
        <div class="row wrap"><button id="tg" class="${G.god ? 'on' : ''}">무적</button><button id="tl">레벨 업</button><button id="tf">필살 바로</button><button id="tc">상자</button><button id="ti">아이템</button></div>
        <div class="row wrap"><button id="te">정예</button><button id="tgb">보물 고블린</button><button id="tb1">중간 보스</button><button id="tb2">마지막 보스</button><button id="tt">+1분</button></div></details>
      <div class="row"><button id="pq">포기하고 마을로</button><button class="main" id="pc">계속</button></div>`, box => {
      box.querySelectorAll('.items .it').forEach(card => { const b = card.querySelector('button[data-a]'); if (b) b.onclick = () => {
        const it = G.bag.find(x => x.id === +card.dataset.id); if (it) { HNS.wear(it); close(); showPause(); }
      }; });
      box.querySelector('#snd').onclick = e => { SFX.on = !SFX.on; P().sound = SFX.on; SAVE.save(); e.target.classList.toggle('on', SFX.on); e.target.textContent = SFX.on ? '효과음 켜짐' : '효과음 꺼짐'; };
      bindMusic(box);
      box.querySelector('#pfs').onclick = () => fullscreen();
      box.querySelectorAll('#pct button').forEach(b => b.onclick = () => {
        P().ctrl = b.dataset.c; HNS.setCtrl(b.dataset.c); SAVE.save();
        box.querySelectorAll('#pct button').forEach(x => x.classList.toggle('on', x === b));
      });
      for (const z of [0, 1, 2]) box.querySelector('#z' + z).onclick = () => { P().zoom = z; HNS.setZoom(z); SAVE.save(); };
      const T = HNS.test, done = fn => () => { fn(); hud(G); close(); HNS.pause(false); };
      box.querySelector('#tg').onclick = e => e.target.classList.toggle('on', T.god());
      box.querySelector('#tl').onclick = done(() => T.level());
      box.querySelector('#tf').onclick = done(() => T.fill());
      box.querySelector('#tc').onclick = done(() => T.chest(1));
      box.querySelector('#ti').onclick = done(() => T.item(2));
      box.querySelector('#te').onclick = done(() => T.elite());
      box.querySelector('#tgb').onclick = done(() => T.goblin());
      box.querySelector('#tb1').onclick = done(() => T.boss(false));
      box.querySelector('#tb2').onclick = done(() => T.boss(true));
      box.querySelector('#tt').onclick = done(() => T.time(G.t + 60));
      let armed = false;
      box.querySelector('#pq').onclick = e => {
        if (!armed) { armed = true; e.target.textContent = '정말 포기? 한 번 더'; return; }
        close(); HNS.giveUp(); showOver(G, true);
      };
      box.querySelector('#pc').onclick = () => { close(); HNS.pause(false); };
    });
  }
  function statsHtml(G) {
    return `<div class="stat">버틴 시간 ${fmtTime(G.t)} · 레벨 ${G.lv} · 처치 ${G.kills}${G.run.elites ? ` · 정예 ${G.run.elites}` : ''}${G.run.goblins ? ' · 보물 고블린!' : ''}</div>`;
  }
  function resultHtml(res) {
    const ach = res.ach.map(a => `<div class="lt" style="color:#ffcf5a">🏆 ${esc(a.name)} 달성!</div>`).join('');
    return `<div class="stat">금화 +${res.gold}${res.scrap ? ` · 창고가 넘쳐 ${res.scrapped}개 분해 +${res.scrap}` : ''} → 💰 ${P().gold}</div>${ach}`;
  }
  // 주운 장비(10-22 «한 판에 하나만 들고 나오니 답답» → 전부 창고로): 좋은 등급부터 몇 개만 보여 주고 나머지는 «외 N개»
  function keptHtml(G) {
    if (!G.bag.length) return '<p>주운 장비가 없습니다</p>';
    const xs = G.bag.slice().sort((a, b) => b.rar - a.rar || b.ilvl - a.ilvl), top = xs.slice(0, 6);
    return `<p>주운 장비 <b>${G.bag.length}개</b>를 모두 창고에 넣었습니다${xs.length > top.length ? ` (좋은 것 ${top.length}개만 보임)` : ''}</p>
      <div class="items">${top.map(it => itemHtml(it)).join('')}</div>`;
  }
  function endButtons(box) {
    box.querySelector('#ot').onclick = () => showTown('go');
    box.querySelector('#or').onclick = () => startRun();
  }
  function showOver(G, quit) {
    setTimeout(() => {
      const res = HNS.finish();
      if (!res) return;
      open(`<h2>${quit ? '원정 포기' : '쓰러졌다…'}</h2>${statsHtml(G)}${buildHtml(G)}
        <p>쓰러지면 금화는 절반 · 주운 장비는 그대로 창고로</p>${keptHtml(G)}${resultHtml(res)}
        <div class="row"><button id="ot">마을로</button><button class="main" id="or">다시 출정</button></div>`, endButtons);
    }, quit ? 0 : 900);
  }
  function showClear(G) {
    const res = HNS.finish();
    if (!res) return;
    open(`<h2>🏆 ${G.dun.name} 정복!</h2>${statsHtml(G)}${keptHtml(G)}${resultHtml(res)}
      <div class="row"><button id="ot">마을로</button><button class="main" id="or">다시 출정</button></div>`, endButtons);
  }

  HNS.init($('cv'), ART, { hud, over: G => showOver(G, false), clear: showClear, toast, levelup: showCards, chest: showChest, boss: onBoss, item: onItem });
  HNS.setZoom(P().zoom || 0);
  HNS.setCtrl(P().ctrl || 'auto');
  $('bPause').addEventListener('click', showPause);
  window.addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') showPause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) showPause(); });
  showTown('go');
  // 홈 화면 앱(오프라인) — 내 컴퓨터에서 고치며 볼 때(localhost)는 옛 파일을 붙잡지 않게 안 씀
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if ('serviceWorker' in navigator && !local) navigator.serviceWorker.register('sw.js').catch(() => { /* 파일로 열면 안 됨 — 게임은 그대로 */ });
})();
