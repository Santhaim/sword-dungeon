// 핵앤슬래시 숫자들(능력치·3연타·스킬·필살기·적·경험치) — 손볼 곳은 여기만
'use strict';
const DATA = {
  // 검사(3D 시트 · 3연타 A·B·C) — 10-21 사용자: 이동은 직접 · 사거리 안 적에 일반 공격 자동 · 스킬 2 · 게이지 필살기
  HERO: { name: '검사', hp: 120, speed: 64, dmg: 12, range: 30, regen: 0.4 },
  // 3연타: fd = 칸마다 시간(초) · hit = 피해가 들어가는 칸(0부터) · range·arc(도) = 앞쪽 부채꼴 · mul = 배율 · kb = 밀어내기
  COMBO: [
    { act: 'A', name: '가로 베기', fd: [0.05, 0.06, 0.045, 0.05, 0.06, 0.07], hit: 3, range: 34, arc: 110, mul: 1.0, kb: 70 },
    { act: 'B', name: '내려 베기', fd: [0.05, 0.07, 0.045, 0.05, 0.06, 0.08], hit: 3, range: 34, arc: 80, mul: 1.25, kb: 90 },
    { act: 'C', name: '찌르기', fd: [0.05, 0.07, 0.04, 0.06, 0.06, 0.11], hit: 3, range: 48, arc: 34, mul: 1.7, kb: 130 },
  ],
  COMBO_RESET: 0.8,            // 이 시간 안에 다음 공격이 안 나오면 1타부터
  MOVE_WHILE_ATK: 0.35,        // 공격하는 동안 이동 속도
  SKILLS: [
    { key: 'spin', name: '회전 베기', short: '회전', cd: 5, mul: 1.8, r: 46, kb: 110, act: 'A', fd: 0.035 },
    { key: 'dash', name: '돌진 베기', short: '돌진', cd: 7, mul: 1.5, dist: 84, dur: 0.18, w: 14, kb: 90, act: 'C', fd: 0.04 },
  ],
  ULT: { key: 'storm', name: '검풍 난무', short: '필살', need: 100, mul: 5, r: 92, kb: 220, act: 'B', fd: 0.075, perHit: 3, perKill: 6 },
  // 회피(10-21 사용자 «회피 버튼 · 백스텝이나 구르기 · 0.2~0.3초 무적»): 움직이는 중이면 그 쪽으로, 서 있으면 뒤로 물러남
  //   구르기 대신 미끄러지기 + 잔상 — 손그림 머리를 붙이는 방식이라 몸을 굴리면 머리가 어색함
  DODGE: { name: '회피', short: '회피', cd: 0.9, dur: 0.2, dist: 48, inv: 0.28 },
  HIT_STOP: 0.04,              // 맞힌 순간 잠깐 멈춤(손맛)
  // 적 — 등급(1~30)·주인공 레벨에 따라
  enemy(rank, lv, kind) {
    const spd = { slime: 24, bat: 40, goblin: 32 }[kind] || 30;
    return {
      hp: Math.round((14 + rank * 3) * (1 + (lv - 1) * 0.15)),
      dmg: Math.round(4 + rank * 0.4 + lv * 0.6),
      speed: spd + rank * 0.3,
      xp: 1 + Math.floor(rank / 4),
    };
  },
  rankMax: lv => 3 + lv * 2.5,                         // 이 레벨에서 나오는 적 등급 위
  alive: lv => Math.min(42, 10 + lv * 2),              // 주변에 살아 있는 적 수 목표
  xpNeed: lv => 10 + lv * 8 + lv * lv,
  LV_HP: 0.08, LV_DMG: 0.07,                          // 레벨 업마다 체력·공격 +(스탯 찍기는 다음 판)
  HEAL_DROP: 0.04, HEAL_PCT: 0.25, PICKUP: 40,
  SPEEDS: [1, 1.5, 2],
};
