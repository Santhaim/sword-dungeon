// 화면 위 글자·버튼·창(시작·일시정지·끝) · 설정 저장
'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const D = DATA;
  const SET = 'hns.settings';
  let set = { zoom: 0, ctrl: 'auto' };
  try { Object.assign(set, JSON.parse(localStorage.getItem(SET) || '{}')); } catch (e) { /* 기본값 */ }
  const save = () => { try { localStorage.setItem(SET, JSON.stringify(set)); } catch (e) { /* 무시 */ } };
  if (!window.ART) {
    $('pbox').innerHTML = '<h2>그림 묶음이 없습니다</h2><p>py work\\tools\\make_hns_art.py art_orig hns</p>';
    $('panel').hidden = false;
    return;
  }

  // ── 화면 위 글자·버튼 상태
  const cool = (b, k) => { b.style.setProperty('--cd', (k * 100).toFixed(1) + '%'); b.classList.toggle('wait', k > 0); };
  function hud(G) {
    const p = G.p;
    $('hLv').textContent = 'Lv ' + G.lv;
    $('hpFill').style.width = (100 * p.hp / p.maxHp) + '%';
    $('hpTxt').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('xpFill').style.width = Math.min(100, 100 * G.xp / D.xpNeed(G.lv)) + '%';
    $('hKills').textContent = '☠ ' + G.kills;
    cool($('bS1'), G.cds[0] / D.SKILLS[0].cd);
    cool($('bS2'), G.cds[1] / D.SKILLS[1].cd);
    cool($('bDodge'), G.dodgeCd / D.DODGE.cd);
    const g = Math.min(1, G.gauge / D.ULT.need);
    $('bUlt').style.setProperty('--g', (g * 100).toFixed(1) + '%');
    $('bUlt').classList.toggle('full', g >= 1);
  }
  let toastT = null;
  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1500);
  }
  // 버튼은 눌린 순간 바로(떼기 기다리지 않음) · 여러 손가락 동시에
  const press = (id, fn) => $(id).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); fn(); });
  press('bS1', () => HNS.useSkill(0));
  press('bS2', () => HNS.useSkill(1));
  press('bUlt', () => HNS.useUlt());
  press('bDodge', () => HNS.dodge());
  for (const [id, sk] of [['bS1', D.SKILLS[0]], ['bS2', D.SKILLS[1]], ['bUlt', D.ULT], ['bDodge', D.DODGE]]) $(id).querySelector('span').textContent = sk.short;

  // 세로로 들고 있으면 «가로로 돌리면 편해요»
  const orient = () => { $('rotate').hidden = innerWidth >= innerHeight; };
  window.addEventListener('resize', orient); orient();

  // ── 창
  let panelLoop = null;
  function open(html, onOpen) { $('pbox').innerHTML = html; $('panel').hidden = false; panelLoop = null; if (onOpen) onOpen($('pbox')); }
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

  function showStart() {
    HNS.pause(true);
    open(`<h2>검사의 던전 (시험판)</h2>
      <canvas id="hero" width="48" height="48"></canvas>
      <div class="help">
        <b>왼손</b><span>화면 왼쪽을 눌러 끌면 이동</span>
        <b>공격</b><span>적이 가까이 오면 저절로 3연타(가로 베기 → 내려 베기 → 찌르기)</span>
        <b>오른손</b><span>회피(잠깐 무적) · 회전 베기 · 돌진 베기 · 필살기(게이지가 차면)</span>
        <b>키보드</b><span>WASD/방향키 이동 · 1·2 스킬 · 3 필살기 · Space 회피 · 마우스는 누른 곳으로</span>
      </div>
      <div class="row"><button id="fs">전체 화면으로 시작</button><button class="main" id="go">시작</button></div>`, box => {
      box.querySelector('#go').onclick = () => { close(); HNS.start(); HNS.pause(false); };
      box.querySelector('#fs').onclick = async () => { await fullscreen(); close(); HNS.start(); HNS.pause(false); };
      const c = box.querySelector('#hero'), g = c.getContext('2d'), h = ART.hero;
      const seq = [0, 1, 2, 3, 4, 1, 2, 3, 4].concat(...['A', 'B', 'C'].map(k => [0, 1, 2, 3, 4, 5].map(i => h.acts[k].col + i)), [0, 0, 0]);
      loopPanel(t => {
        const im = HNS.img(h.file);
        g.clearRect(0, 0, 48, 48);
        if (!im.complete || !im.naturalWidth) return;
        g.imageSmoothingEnabled = false;
        const col = seq[Math.floor(t / 110) % seq.length];
        g.drawImage(im, col * h.cell[0], 0, h.cell[0], h.cell[1], 0, 0, 48, 48);
      });
    });
  }

  function showPause() {
    const G = HNS.G;
    if (!G || G.over) return;
    HNS.pause(true);
    const CTRL = [['auto', '자동'], ['stick', '조이스틱'], ['point', '누른 곳으로']];
    open(`<h2>일시정지</h2>
      <p>조작 — 자동: 터치는 왼쪽 반 조이스틱 · 마우스는 누른 곳으로</p>
      <div class="row" id="pct">${CTRL.map(([k, t]) => `<button data-c="${k}" class="${HNS.ctrl === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="row"><button id="pz1">화면 기본</button><button id="pz2">화면 크게</button><button id="pfs">전체 화면</button></div>
      <p>시험 메뉴</p>
      <div class="row"><button id="tg" class="${G.god ? 'on' : ''}">무적</button><button id="tl">레벨 업</button><button id="tf">필살 게이지</button></div>
      <div class="row"><button id="pq">처음 화면</button><button class="main" id="pc">계속</button></div>`, box => {
      box.querySelectorAll('#pct button').forEach(b => b.onclick = () => {
        set.ctrl = b.dataset.c; HNS.setCtrl(set.ctrl); save();
        box.querySelectorAll('#pct button').forEach(x => x.classList.toggle('on', x === b));
      });
      box.querySelector('#pz1').onclick = () => { set.zoom = 0; HNS.setZoom(0); save(); };
      box.querySelector('#pz2').onclick = () => { set.zoom = Math.min(2, HNS.zoomAdj + 1); HNS.setZoom(set.zoom); save(); };
      box.querySelector('#pfs').onclick = () => fullscreen();
      box.querySelector('#tg').onclick = e => e.target.classList.toggle('on', HNS.test.god());
      box.querySelector('#tl').onclick = () => { HNS.test.level(); hud(G); };
      box.querySelector('#tf').onclick = () => { HNS.test.fill(); hud(G); };
      box.querySelector('#pq').onclick = () => showStart();
      box.querySelector('#pc').onclick = () => { close(); HNS.pause(false); };
    });
  }

  function showOver(G) {
    setTimeout(() => open(`<h2>쓰러졌다…</h2>
      <div class="stat">레벨 ${G.lv} · 쓰러뜨린 적 ${G.kills}</div>
      <div class="row"><button id="oq">처음 화면</button><button class="main" id="or">다시 하기</button></div>`, box => {
      box.querySelector('#oq').onclick = () => showStart();
      box.querySelector('#or').onclick = () => { close(); HNS.start(); HNS.pause(false); };
    }), 600);
  }

  HNS.init($('cv'), ART, { hud, over: showOver, toast });
  HNS.setZoom(set.zoom);
  HNS.setCtrl(set.ctrl || 'auto');
  $('bPause').addEventListener('click', showPause);
  window.addEventListener('keydown', e => { if (e.code === 'Escape' || e.code === 'KeyP') { if ($('panel').hidden) showPause(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && HNS.G && !HNS.G.over && $('panel').hidden) showPause(); });
  showStart();
})();
