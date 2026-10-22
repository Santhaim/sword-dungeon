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
    names: 2,                        // 아이템 이름 판(2 = 10-22 «재질 + 종류» 통일 뒤) — 없으면 옛 기록이라 한 번 바꿈
  });
  function merge(a, b) {                 // b 의 값을 a(기본값) 위에 — 객체는 안쪽까지
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  // 10-22 이름 통일 전 창고 아이템 → 새 바탕 이름(전설 앞말은 그대로) + 새 바탕 고유 성능
  function renameItems(stash) {
    const D = DATA, olds = Object.keys(D.ITEM_RENAME).sort((a, b) => b.length - a.length);   // 긴 이름부터 끝맞춤
    for (const it of stash) {
      const o = olds.find(n => it.name.endsWith(n)), bases = D.ITEM_BASES[it.slot];
      if (!o || !bases) continue;
      const order = D.DUNGEONS.reduce((k, d, i) => D.itemLevelOf(d.tier) <= it.ilvl ? i + 1 : k, 1);
      const b = bases.find(x => x[0] === (D.ITEM_RENAME[o] || (bases[order - 1] || bases[0])[0]));
      if (!b) continue;
      it.name = it.name.slice(0, it.name.length - o.length) + b[0];
      it.aff = Object.entries(b[3] || {}).map(([k, v]) => ({ k, v, imp: true })).concat(it.aff.filter(a => !a.imp));
    }
  }
  function load() {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (p && p.v === 1) {
        const out = merge(blank(), p);
        if (!p.names) {                  // 바꾸다 탈이 나도 기록은 그대로(복사본에서 바꾸고 다 되면 갈아 끼움 · 다음에 다시)
          try { const st = JSON.parse(JSON.stringify(out.stash)); renameItems(st); out.stash = st; } catch (e) { out.names = 0; }
        }
        return out;
      }
    } catch (e) { /* 깨진 기록 → 새로 */ }
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
