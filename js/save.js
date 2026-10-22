// 판 밖 기록(금화·창고·장비·축복·해금·도전 과제·통계) — 브라우저 저장소(localStorage) 한 칸에 JSON
//   판(SAVE.P.v)이 바뀌면 빈 기록에 옛 값을 덮어 가며 읽어 들임(새 칸은 기본값)
'use strict';
const SAVE = (() => {
  const KEY = 'hns.profile.v1';
  const blank = () => ({
    v: 1, nextId: 1,
    gold: 0,
    stash: [],                       // 창고 아이템
    equip: {},                       // 직업별 { weapon, armor, ring, amulet } = 아이템 id
    bless: {},                       // 축복 단계
    unlocked: { classes: ['swordsman'], dungeons: ['crypt'] },
    ach: {},                         // 끝낸 도전 과제
    stats: { kills: {}, runs: 0, clears: {}, bosses: {}, goldTotal: 0, maxLv: 0, ultKills: 0, chests: 0, legends: 0, evos: 0, dodges: 0, elites: 0, goblins: 0, secrets: 0, bestTime: {} },
    cls: 'swordsman', dungeon: 'crypt',
    sound: true, ctrl: 'auto', zoom: 0,
  });
  function merge(a, b) {                 // b 의 값을 a(기본값) 위에 — 객체는 안쪽까지
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  function load() {
    try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.v === 1) return merge(blank(), p); } catch (e) { /* 깨진 기록 → 새로 */ }
    return blank();
  }
  let P = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* 저장 못 해도 게임은 그대로 */ } }
  return {
    get P() { return P; },
    save,
    newId() { return P.nextId++; },
    reset() { P = blank(); save(); },
    stat(k, n) { P.stats[k] = (P.stats[k] || 0) + (n === undefined ? 1 : n); },
    kill(kind, n) { P.stats.kills[kind] = (P.stats.kills[kind] || 0) + (n || 1); },
  };
})();
