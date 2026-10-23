// 효과음 — 전부 소리 공식으로 만듦(녹음 파일 없음) · 첫 터치·키 뒤에 켜짐(브라우저 규칙)
//   같은 소리가 한 프레임에 수십 번 겹치지 않게 소리마다 최소 간격을 둠
'use strict';
const SFX = (() => {
  let ac = null, master = null, noiseBuf = null, on = true;
  const last = {};
  const GAP = { hit: 0.035, kill: 0.045, gem: 0.03, coin: 0.05, swing: 0.05, shot: 0.05, gun: 0.045, ehit: 0.06, zap: 0.06, warn: 0.12, frost: 0.1, pot: 0.05 };
  function ctx() {
    if (!ac) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      ac = new C();
      master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
      const n = ac.sampleRate;
      noiseBuf = ac.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  // 음: 높이 f0 → f1(지수로 미끄러짐) · 짧게 올라갔다 사라지는 소리 크기
  function tone(o) {
    const t = ac.currentTime + (o.delay || 0), dur = o.dur;
    const os = ac.createOscillator(), g = ac.createGain();
    os.type = o.type || 'square';
    os.frequency.setValueAtTime(o.f0, t);
    if (o.f1 && o.f1 !== o.f0) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(g); g.connect(master);
    os.start(t); os.stop(t + dur + 0.02);
  }
  // 바람 소리: 잡음을 거르개(가운데 f0 → f1)로
  function hiss(o) {
    const t = ac.currentTime + (o.delay || 0), dur = o.dur;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = o.filter || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.15, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  const arp = (notes, step, o) => notes.forEach((f, i) => tone(Object.assign({ f0: f, f1: f, dur: step * 1.6, delay: i * step }, o)));
  const S = {
    swing: () => hiss({ dur: 0.09, vol: 0.09, f0: 2600, f1: 700, q: 1.3 }),
    hit: () => { tone({ type: 'square', f0: 240, f1: 80, dur: 0.06, vol: 0.09 }); hiss({ dur: 0.05, vol: 0.07, f0: 3200, f1: 1400, q: 0.8 }); },
    crit: () => { tone({ type: 'square', f0: 520, f1: 160, dur: 0.09, vol: 0.12 }); hiss({ dur: 0.08, vol: 0.1, f0: 5000, f1: 2000, q: 0.7 }); },
    kill: () => tone({ type: 'triangle', f0: 500, f1: 1100, dur: 0.07, vol: 0.06 }),
    gem: () => tone({ type: 'sine', f0: 1100, f1: 1600, dur: 0.05, vol: 0.04 }),
    coin: () => { tone({ type: 'square', f0: 1320, dur: 0.05, vol: 0.04 }); tone({ type: 'square', f0: 1760, dur: 0.09, vol: 0.04, delay: 0.05 }); },
    levelup: () => arp([523, 659, 784, 1046, 1318], 0.06, { type: 'square', vol: 0.06 }),
    card: () => tone({ type: 'triangle', f0: 880, f1: 1320, dur: 0.1, vol: 0.07 }),
    legend: () => { arp([784, 988, 1175, 1568], 0.07, { type: 'triangle', vol: 0.08 }); hiss({ dur: 0.5, vol: 0.05, f0: 6000, f1: 9000, q: 2, delay: 0.1 }); },
    chest: () => { arp([392, 523, 659, 784, 1046, 1318], 0.07, { type: 'square', vol: 0.06 }); hiss({ dur: 0.6, vol: 0.05, f0: 5000, f1: 9000, q: 3, delay: 0.3 }); },
    roll: () => tone({ type: 'square', f0: 1200, dur: 0.025, vol: 0.03 }),
    skill: () => { hiss({ dur: 0.28, vol: 0.16, f0: 500, f1: 3500, q: 0.8 }); tone({ type: 'sawtooth', f0: 180, f1: 360, dur: 0.2, vol: 0.06 }); },
    dash: () => hiss({ dur: 0.18, vol: 0.14, f0: 900, f1: 4000, q: 0.9 }),
    dodge: () => hiss({ dur: 0.12, vol: 0.08, f0: 700, f1: 1800, q: 1.1 }),
    ult: () => { tone({ type: 'sawtooth', f0: 140, f1: 40, dur: 0.7, vol: 0.22 }); hiss({ dur: 0.7, vol: 0.22, f0: 4000, f1: 250, q: 0.6 }); arp([392, 523, 784], 0.05, { type: 'square', vol: 0.06 }); },
    hurt: () => tone({ type: 'sawtooth', f0: 320, f1: 110, dur: 0.13, vol: 0.12 }),
    warn: () => { tone({ type: 'square', f0: 660, dur: 0.06, vol: 0.05 }); tone({ type: 'square', f0: 660, dur: 0.06, vol: 0.05, delay: 0.09 }); },
    boss: () => { tone({ type: 'sawtooth', f0: 95, f1: 55, dur: 1.1, vol: 0.2 }); hiss({ dur: 1.0, vol: 0.12, f0: 300, f1: 120, q: 0.7, filter: 'lowpass' }); },
    slam: () => { tone({ type: 'sine', f0: 120, f1: 35, dur: 0.35, vol: 0.3 }); hiss({ dur: 0.3, vol: 0.14, f0: 900, f1: 120, q: 0.6, filter: 'lowpass' }); },
    shot: () => hiss({ dur: 0.07, vol: 0.07, f0: 3000, f1: 6000, q: 2 }),
    gun: () => { hiss({ dur: 0.06, vol: 0.1, f0: 2400, f1: 600, q: 0.7 }); tone({ type: 'square', f0: 160, f1: 60, dur: 0.05, vol: 0.06 }); },
    reload: () => { tone({ type: 'square', f0: 900, dur: 0.03, vol: 0.05 }); tone({ type: 'square', f0: 600, dur: 0.04, vol: 0.05, delay: 0.12 }); },
    eshot: () => tone({ type: 'square', f0: 700, f1: 350, dur: 0.1, vol: 0.04 }),
    ehit: () => tone({ type: 'square', f0: 180, f1: 120, dur: 0.05, vol: 0.05 }),
    pot: () => {                                      // 항아리 깨짐(10-23): 짧은 쨍 + 높은 조각 소리 둘 + 낮은 퍽
      hiss({ dur: 0.12, vol: 0.11, f0: 4200, f1: 1600, q: 1.1 });
      tone({ type: 'triangle', f0: 1900, f1: 1500, dur: 0.06, vol: 0.05 });
      tone({ type: 'triangle', f0: 2600, f1: 2200, dur: 0.05, vol: 0.035, delay: 0.045 });
      tone({ type: 'sine', f0: 180, f1: 90, dur: 0.08, vol: 0.08 });
    },
    zap: () => { hiss({ dur: 0.16, vol: 0.12, f0: 7000, f1: 2000, q: 0.5 }); tone({ type: 'square', f0: 1800, f1: 300, dur: 0.12, vol: 0.05 }); },
    frost: () => hiss({ dur: 0.3, vol: 0.08, f0: 6000, f1: 9000, q: 3 }),
    fire: () => { hiss({ dur: 0.35, vol: 0.12, f0: 300, f1: 1800, q: 0.6 }); tone({ type: 'sawtooth', f0: 90, f1: 160, dur: 0.25, vol: 0.05 }); },
    poison: () => { tone({ type: 'sine', f0: 300, f1: 520, dur: 0.08, vol: 0.05 }); tone({ type: 'sine', f0: 260, f1: 480, dur: 0.08, vol: 0.04, delay: 0.09 }); },
    whirl: () => hiss({ dur: 0.6, vol: 0.09, f0: 400, f1: 1600, q: 1.5 }),
    axe: () => hiss({ dur: 0.14, vol: 0.08, f0: 1500, f1: 500, q: 1.2 }),
    clear: () => arp([523, 659, 784, 1046, 784, 1046, 1318], 0.11, { type: 'square', vol: 0.07 }),
    lose: () => arp([392, 330, 262, 196], 0.16, { type: 'triangle', vol: 0.08 }),
    click: () => tone({ type: 'square', f0: 900, dur: 0.03, vol: 0.03 }),
  };
  function play(name) {
    if (!on || !S[name]) return;
    if (!ctx()) return;
    const now = ac.currentTime;
    if (last[name] !== undefined && now - last[name] < (GAP[name] || 0.02)) return;
    last[name] = now;
    try { S[name](); } catch (e) { /* 소리는 실패해도 게임은 그대로 */ }
  }
  return {
    play,
    ctx,                                              // 배경음(js/bgm.js)이 같은 소리판을 씀(폰에서 판을 둘 만들지 않게)
    unlock() { if (on) ctx(); },
    get on() { return on; },
    set on(v) { on = !!v; if (on) ctx(); },
  };
})();
