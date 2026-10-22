// 배경음 — 칩튠 곡을 코드로 연주(음악 파일·녹음 없음) · 곡 데이터 js/bgm_data.js(= work/tools/hns_bgm.py --export · 미리 듣기 mp3 와 같은 데이터)
//   10-22 사용자 «배경음 · 추천안»: 마을 · 던전마다 한 곡(판 시간에 따라 세짐) · 보스가 나오면 보스 곡(잡으면 돌아감)
//   곡 = 섹션(마디마다 16칸) 순서 · orders[세기](0~2) 중 지금 세기의 순서로 돎 · 악기 = 펄스파(duty)·4비트 삼각파·잡음 북 · 메아리 · 킥마다 출렁임(duck)
//   효과음(js/audio.js)과 소리판 하나를 같이 씀 · 첫 터치·키 뒤에 켜짐(브라우저 규칙)
'use strict';
const BGM = (() => {
  const DATA = window.BGM_DATA || { inst: {}, drumVol: {}, use: {}, songs: {} };
  let ac = null, master = null, on = true, vol = 0.5, want = null, cur = null, heat = 0, timer = null;
  const LOOK = 0.3, TICK = 60;                        // 0.3초 앞까지 미리 예약 · 60ms 마다 확인
  let waves = {}, noiseBuf = null, punchCurve = null;

  // ── 곡 글 풀기(hns_bgm.py 와 같은 규칙 — 고치면 둘 다)
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const midi = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); if (!m) throw new Error('음 ' + s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], sus4: [0, 5, 7], 7: [0, 4, 7, 10] };
  const chordOf = s => { const m = /^([A-G][#b]?)(m|dim|sus4|7)?$/.exec(s); return [midi(m[1] + '4') % 12, QUAL[m[2] || '']]; };
  const inRange = (pc, lo) => { const n = lo - (lo % 12) + pc; return n < lo ? n + 12 : n; };
  function notesOf(text) {
    const out = []; let t = 0;
    for (const tok of text.replace(/\|/g, ' ').split(/\s+/)) {
      if (!tok) continue;
      const [nm, d0] = tok.split('/'), d = d0 ? +d0 : 1;
      if (nm !== '.' && nm !== '_') out.push([t, d, midi(nm)]);
      t += d;
    }
    return out;
  }
  function sectionEvents(sec) {                       // 섹션 → 칸마다 [채널, 사건] 목록
    const ch = sec.chords.split(/\s+/).filter(Boolean), bars = ch.length, ev = {};
    const each = (lo, fn) => ch.forEach((c, b) => { const [root, iv] = chordOf(c); fn(b, inRange(root, lo), iv); });
    if (sec.lead) { ev.lead = notesOf(sec.lead); if (sec.lead2) ev.lead2 = ev.lead.map(([t, d, n]) => [t, d, n + sec.lead2.tr]); }
    if (sec.pad) { ev.pad = []; each(sec.pad.lo, (b, r0, iv) => { for (const i of iv.slice(0, 3)) ev.pad.push([b * 16, 16, r0 + i]); }); }
    if (sec.arp) {
      const a = sec.arp; ev.arp = [];
      each(a.lo, (b, r0, iv) => {
        const tones = [...iv.map(i => r0 + i), ...iv.map(i => r0 + 12 + i)];
        for (let s = 0; s < 16; s++) { const i = a.pat[s % a.pat.length]; if (i >= 0) ev.arp.push([b * 16 + s, 1, tones[i % tones.length]]); }   // -1 = 쉼
      });
    }
    if (sec.stab) { const a = sec.stab; ev.stab = []; each(a.lo, (b, r0, iv) => { for (const s of a.hits) for (const i of iv.slice(0, 3)) ev.stab.push([b * 16 + s, 1, r0 + i]); }); }
    if (sec.bass) {
      ev.bass = [];
      each(sec.bass.lo, (b, r0, iv) => {
        let t = 0;
        for (const tok of sec.bass.pat.split(/\s+/)) {
          const [k, d0] = tok.split('/'), d = d0 ? +d0 : 1, n = { r: r0, o: r0 + 12, f: r0 + 7, t: r0 + iv[1] }[k];
          if (n !== undefined) ev.bass.push([b * 16 + t, d, n]);
          t += d;
        }
      });
    }
    const dr = sec.drums || {}, fill = dr.fill || {}; ev.drums = [];
    for (let b = 0; b < bars; b++) for (const k of 'kspohctl') {
      let pat = b === bars - 1 && fill[k] ? fill[k] : dr[k];
      if (!pat) continue;
      if (Array.isArray(pat)) pat = pat[b % pat.length];
      for (let s = 0; s < 16; s++) { const x = pat[s]; if (x === 'x' || (x >= '1' && x <= '9')) ev.drums.push([b * 16 + s, k, x === 'x' ? 1 : +x / 9]); }
    }
    if (sec.cut) {
      const end = bars * 16 - sec.cut;
      for (const k in ev) ev[k] = k === 'drums' ? ev[k].filter(e => e[0] < end) : ev[k].filter(e => e[0] < end).map(([t, d, n]) => [t, Math.min(d, end - t), n]);
    }
    if (sec.riser) ev.riser = [[0, bars * 16 - (sec.cut || 0)]];
    const at = Array.from({ length: bars * 16 }, () => []);
    for (const k in ev) for (const e of ev[k]) at[e[0]].push([k, e]);
    return { bars, at };
  }
  function instsOf(song) {                            // 기본 악기 + 곡 전용(extra) + 곡이 덮어쓴 값(inst)
    const base = Object.assign({}, DATA.inst, song.extra || {}), out = {};
    for (const k in base) out[k] = Object.assign({}, base[k], (song.inst || {})[k] || {});
    return out;
  }

  // ── 소리 만들기
  function waveOf(I) {                                // 펄스파(duty)·4비트 삼각파 = 푸리에 계수로 만든 파형(띠 제한이라 폰에서도 깨끗)
    const key = I.wave === 'pulse' ? 'p' + I.duty : 'tri4';
    if (waves[key]) return waves[key];
    const N = 48, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
    if (I.wave === 'pulse') {
      for (let n = 1; n <= N; n++) { re[n] = 2 * Math.sin(2 * Math.PI * n * I.duty) / (Math.PI * n); im[n] = 2 * (1 - Math.cos(2 * Math.PI * n * I.duty)) / (Math.PI * n); }
    } else {
      const M = 32, x = [];
      for (let i = 0; i < M; i++) { const ph = (i + 0.5) / M; x.push(Math.round(2 * Math.abs(2 * ph - 1) * 7.5) / 7.5 - 1); }
      for (let n = 1; n <= 15; n++) { let a = 0, b = 0; for (let i = 0; i < M; i++) { const th = 2 * Math.PI * n * (i + 0.5) / M; a += x[i] * Math.cos(th); b += x[i] * Math.sin(th); } re[n] = 2 * a / M; im[n] = 2 * b / M; }
    }
    return (waves[key] = ac.createPeriodicWave(re, im, { disableNormalization: true }));
  }
  function note(I, bus, n, t, dur) {                  // 음 하나: 소리 크기 a→d→s · 끝나면 r 동안 줄어듦 · uni = 두 목소리 · vib = 늦게 오는 떨림
    const f = 440 * Math.pow(2, (n - 69) / 12), on = dur * (I.gate ?? 1), end = t + on + I.r + 0.06;
    const voices = I.uni ? [-I.uni, I.uni] : [0], peak = I.vol / Math.sqrt(voices.length);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + I.a);
    g.gain.setTargetAtTime(peak * I.s, t + I.a, Math.max(I.d, 0.001));
    g.gain.setTargetAtTime(0, t + on, Math.max(I.r / 3, 0.003));
    g.connect(bus);
    const w = waveOf(I);
    for (const c of voices) {
      const o = ac.createOscillator();
      o.setPeriodicWave(w); o.frequency.value = f; if (c) o.detune.value = c;
      if (I.vib) {
        const l = ac.createOscillator(), lg = ac.createGain();
        l.frequency.value = I.vib[0];
        lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + I.vib[2]); lg.gain.linearRampToValueAtTime(f * I.vib[1], t + I.vib[2] + 0.1);
        l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(end);
      }
      o.connect(g); o.start(t); o.stop(end);
    }
  }
  function noise(t, dur, off) {
    if (!noiseBuf) { const n = ac.sampleRate; noiseBuf = ac.createBuffer(1, n, n); const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    s.start(t, off === undefined ? Math.random() * 0.8 : off); s.stop(t + dur);
    return s;
  }
  const filt = (type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const decay = (t, v, k) => { const g = ac.createGain(); g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0, t, 1 / k); return g; };   // v·e^(−k·t)
  const chain = (...ns) => { for (let i = 0; i < ns.length - 1; i++) ns[i].connect(ns[i + 1]); return ns[0]; };
  function drum(S, k, t, vel) {
    const V = (DATA.drumVol[k] || 0.1) * vel, out = S.drumBus;
    if (k === 'k') {                                  // 킥: 떨어지는 사인 · punch = 짧고 단단 + 살짝 찌그러뜨림
      const p = S.song.punch, o = ac.createOscillator(), e = decay(t, 1, p ? 16 : 13), g = ac.createGain();
      const f1 = p ? 48 : 45, f0 = p ? 150 : 115;
      o.frequency.setValueAtTime(f0 + f1, t); o.frequency.setTargetAtTime(f1, t, 1 / (p ? 38 : 28));
      g.gain.value = V;
      if (p) { const sh = ac.createWaveShaper(); sh.curve = punchCurve || (punchCurve = Float32Array.from({ length: 257 }, (_, i) => Math.tanh(2.2 * (i / 128 - 1)) / Math.tanh(2.2))); chain(o, e, sh, g, out); }
      else chain(o, e, g, out);
      o.start(t); o.stop(t + 0.25);
      const cg = ac.createGain(); cg.gain.setValueAtTime(V * 0.4, t); cg.gain.linearRampToValueAtTime(0, t + 0.004);
      chain(noise(t, 0.01), cg, out);
      for (const b of S.ducks) { b.g.gain.setValueAtTime(1 - b.depth, t); b.g.gain.setTargetAtTime(1, t, 0.07); }   // 킥마다 출렁임
    } else if (k === 's') {                           // 스네어: 걸러 낸 잡음 + 190Hz 몸통
      chain(noise(t, 0.2), filt('highpass', 1400, 0.7), decay(t, V, 20), out);
      const o = ac.createOscillator(); o.frequency.value = 190; chain(o, decay(t, V * 0.5, 35), out); o.start(t); o.stop(t + 0.2);
    } else if (k === 'p') {                           // 손뼉: 짧은 잡음 셋 + 꼬리
      for (const d of [0, 0.011, 0.022]) chain(noise(t + d, 0.05), filt('bandpass', 1700, 0.9), decay(t + d, V * 2.2, 60), out);
      chain(noise(t, 0.25), filt('bandpass', 1700, 0.9), decay(t, V * 2.2, 18), out);
    } else if (k === 't' || k === 'l') {              // 탐탐 «둥»: 떨어지는 사인(높은 260→150 · 낮은 150→80)
      const o = ac.createOscillator(), [f0, f1] = k === 't' ? [260, 150] : [150, 80];
      o.frequency.setValueAtTime(f0, t); o.frequency.setTargetAtTime(f1, t, 1 / 18);
      chain(o, decay(t, V, 10), out); o.start(t); o.stop(t + 0.4);
    } else if (k === 'h' || k === 'o') {              // 하이햇(닫힘·열림)
      chain(noise(t, k === 'h' ? 0.07 : 0.3), filt('highpass', 7000, 0.7), decay(t, V, k === 'h' ? 75 : 14), out);
    } else {                                          // 심벌
      chain(noise(t, 1.4), filt('highpass', 4500, 0.7), decay(t, V, 3.5), out);
    }
  }
  function riser(S, t, dur) {                         // 빌드업: 차오르는 잡음 + 위로 미끄러지는 음(300→1600Hz)
    const k2 = Float32Array.from({ length: 32 }, (_, i) => Math.pow(i / 31, 2) * 0.22), k15 = Float32Array.from({ length: 32 }, (_, i) => Math.pow(i / 31, 1.5) * 0.05);
    const g = ac.createGain(); g.gain.value = 0; g.gain.setValueCurveAtTime(k2, t, dur);   // 곡선과 같은 때 다른 예약을 겹치면 오류라 곡선만
    chain(noise(t, dur + 0.05), filt('highpass', 2500, 0.7), g, S.drumBus);
    const o = ac.createOscillator(), og = ac.createGain();
    o.setPeriodicWave(waveOf({ wave: 'pulse', duty: 0.5 }));
    o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(1600, t + dur);
    og.gain.value = 0; og.gain.setValueCurveAtTime(k15, t, dur);
    chain(o, og, S.drumBus); o.start(t); o.stop(t + dur + 0.02);
  }

  // ── 곡 돌리기
  function startSong(key, t) {
    const song = DATA.songs[key];
    if (!song) return null;
    const S = { key, song, insts: instsOf(song), stepS: 60 / song.bpm / 4, secs: {}, pos: 0, step: 0, nextT: t, ducks: [], bus: {} };
    S.out = ac.createGain(); S.out.gain.setValueAtTime(0, t); S.out.gain.linearRampToValueAtTime(song.gain || 1, t + 0.5); S.out.connect(master);   // gain = 곡마다 크기(마을은 작게)
    S.drumBus = ac.createGain(); S.drumBus.connect(S.out);
    for (const ch in S.insts) {                       // 채널: 들어옴 → (메아리) → 출렁임 → 곡 출구
      const I = S.insts[ch], inp = ac.createGain(), dk = ac.createGain();
      inp.connect(dk); dk.connect(S.out);
      if (I.echo) {
        const [steps, fb, mix] = I.echo, d = ac.createDelay(2), f = ac.createGain(), w = ac.createGain();
        d.delayTime.value = steps * S.stepS; f.gain.value = fb; w.gain.value = mix;
        inp.connect(d); d.connect(f); f.connect(d); d.connect(w); w.connect(dk);
      }
      if (I.duck) S.ducks.push({ g: dk, depth: I.duck });
      S.bus[ch] = inp;
    }
    for (const name in song.sections) S.secs[name] = sectionEvents(song.sections[name]);
    S.sec = S.secs[order(S)[0]];
    return S;
  }
  const order = S => { const os = S.song.orders || [S.song.order]; return os[Math.min(heat, os.length - 1)]; };
  function nextSection(S) {                           // 한 바퀴 돌면 도입(intro)은 건너뛰고 다시
    const ord = order(S);
    S.pos++;
    if (S.pos >= ord.length) S.pos = ord[0] === 'intro' && ord.length > 1 ? 1 : 0;
    S.sec = S.secs[ord[S.pos]]; S.step = 0;
  }
  function playStep(S, t) {
    for (const [ch, e] of S.sec.at[S.step]) {
      if (ch === 'drums') drum(S, e[1], t, e[2]);
      else if (ch === 'riser') riser(S, t, e[1] * S.stepS);
      else if (S.bus[ch]) note(S.insts[ch], S.bus[ch], e[2], t, e[1] * S.stepS);
    }
  }
  function advance(S, until) {
    while (S.nextT < until) {
      playStep(S, S.nextT);
      S.nextT += S.stepS;
      if (++S.step >= S.sec.bars * 16) nextSection(S);
    }
  }
  let testing = false;
  function tick() {
    if (testing || !ac || !cur || ac.state !== 'running') return;
    if (cur.nextT < ac.currentTime - 0.5) cur.nextT = ac.currentTime + 0.05;   // 오래 멈췄다 돌아오면 밀린 것은 건너뜀
    try { advance(cur, ac.currentTime + LOOK); } catch (e) { cur = null; }      // 소리는 실패해도 게임은 그대로
  }
  function fadeOut(S, t) {
    const o = S.out;
    o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => { try { o.disconnect(); } catch (e) { /* 이미 끊김 */ } }, 1500);
  }
  function play(key) {                                // 곡 바꾸기(같은 곡이면 그대로) · key = 곡 열쇠 또는 자리 이름(town·crypt·boss …)
    key = DATA.use[key] || key;
    want = key;
    if (!ac || !on || ac.state !== 'running' || (cur && cur.key === key)) return;
    const t = ac.currentTime + 0.05;
    if (cur) fadeOut(cur, t);
    try { cur = key && DATA.songs[key] ? startSong(key, t + 0.1) : null; } catch (e) { cur = null; }
  }
  function init() {                                   // 첫 터치·키에서 소리판 열기(효과음과 같은 판)
    if (!ac) {
      if (typeof SFX === 'undefined' || !SFX.ctx) return;   // SFX 는 const(전역 이름이지만 window 속성은 아님)
      ac = SFX.ctx();
      if (!ac) return;
      master = ac.createGain(); master.gain.value = on ? vol * 0.6 : 0;
      const lim = ac.createDynamicsCompressor();       // 크게 해도 찢어지지 않게 살짝 눌러 줌
      lim.threshold.value = -10; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.15;
      master.connect(lim); lim.connect(ac.destination);
      timer = setInterval(tick, TICK);
    }
    const go = () => { if (want && (!cur || cur.key !== want)) play(want); };
    if (ac.state !== 'running' && !document.hidden) ac.resume().then(go); else go();
  }
  // 폰(터치)은 손가락을 «뗄 때»가 사용자 동작으로 쳐짐 → 누를 때·뗄 때·클릭 모두에서 시도
  for (const ev of ['pointerdown', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, init, { passive: true });
  document.addEventListener('visibilitychange', () => {   // 화면을 벗어나면 멈춤(효과음도) · 돌아오면 다시
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume().then(() => { if (want) play(want); });
  });

  return {
    play,
    // 판 따라가기: 보스가 있으면 보스 곡 · 아니면 그 던전 곡 · 6분부터 세기 1 · 9분부터 2(섹션 끝에서 바뀜)
    follow(G) { heat = !G ? 0 : G.t >= 540 ? 2 : G.t >= 360 ? 1 : 0; play(!G ? 'town' : G.boss ? 'boss' : G.dun.key); },
    get on() { return on; },
    set on(v) {
      on = !!v;
      if (!ac) return;
      master.gain.setTargetAtTime(on ? vol * 0.6 : 0, ac.currentTime, 0.08);
      if (!on && cur) { fadeOut(cur, ac.currentTime); cur = null; }
      if (on) init();
    },
    get vol() { return vol; },
    set vol(v) { vol = Math.max(0, Math.min(1, v)); if (ac && on) master.gain.setTargetAtTime(vol * 0.6, ac.currentTime, 0.05); },
    get now() { return cur ? cur.key : null; },
    // 시험: 곡을 sec 초 동안 소리 없이 렌더 → [최대, RMS, 노드 오류 여부] (브라우저 콘솔 · 오류·음량 확인용)
    async test(key, sec, h) {
      const keep = { ac, master, cur, heat, waves, noiseBuf };
      const sr = 22050, oc = new OfflineAudioContext(1, Math.round(sr * sec), sr);
      testing = true;
      ac = oc; master = oc.createGain(); master.connect(oc.destination); waves = {}; noiseBuf = null; heat = h || 0;
      try {
        const S = startSong(DATA.use[key] || key, 0);
        advance(S, sec);
        const d = (await oc.startRendering()).getChannelData(0);
        let pk = 0, ss = 0;
        for (const v of d) { pk = Math.max(pk, Math.abs(v)); ss += v * v; }
        return { key: S.key, peak: +pk.toFixed(3), rms: +Math.sqrt(ss / d.length).toFixed(3) };
      } finally { ({ ac, master, cur, heat, waves, noiseBuf } = keep); testing = false; }
    },
  };
})();
