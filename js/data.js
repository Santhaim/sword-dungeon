// 던전 원정대(10-23 사용자 «검사의 던전 말고 다른 이름 · 직업이 넷» → 이름 바꿈 · 공개 주소 sword-dungeon 은 그대로) — 숫자·내용 전부(직업·스킬·카드·능력·진화·몬스터·보스·던전·장비·축복·도전 과제) · 손볼 곳은 여기
//   10-21~22 사용자: 뱀서(카드·진화·상자) + 홀즈 오브 토먼트(장비 들고 나오기·등급·도전 과제) + 해머워치2(손맛·발견) 장점만
'use strict';
const DATA = (() => {
  const pct = v => Math.round(v * 100) + '%';
  const D = {};
  // 조사: 받침 있으면 a(이·을·은), 없으면 b(가·를·는)
  D.josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return w + (c >= 0 && c < 11172 && c % 28 ? a : b); };

  // ── 직업 — attack: 'combo'(근접 3연타) · 'bow'(화살) · 'gun'(연사 + 장전) · 'magic'(따라가 터지는 마법탄)
  //   weapon = 장비 무기 종류 · basic = 일반 공격 이름(카드)
  D.CLASSES = {
    swordsman: {
      // 10-22 사용자 «필살이랑 회전 베기가 별 차이 없음 → 회전 빼고 돌진·필살만»
      // 10-22 사용자 «회피를 빼고 아까 뺀 두 번째 스킬을 회피 대신» → skills = [자동 스킬, 손으로 쓰는 몸 옮기기(회피 자리)] · manual = 손으로 쓰는 쪽
      // 10-22 사용자 «검사 자동 스킬이 전부 돌진» → 자동은 제자리 기술 대지 가르기(몸이 저절로 튀어 나가지 않게) · 내달리는 건 손으로 쓰는 찌르기 하나
      name: '검사', art: 'hero_swordsman', desc: '가까이 오면 3연타 · 대지 가르기(자동) · 찌르기 · 필살 검풍 난무', weapon: 'sword', basic: '3연타', basicIcon: '⚔',
      hp: 140, speed: 64, dmg: 12, range: 30, regen: 0.8, attack: 'combo', skills: ['rift', 'thrust'], manual: 'thrust', ult: 'storm',
    },
    archer: {
      // 10-22 사용자 «궁수도 검사처럼 스킬 2개(스킬 하나 + 필살)» · «스킬은 자동으로» → 직업마다 자동 스킬 하나
      //   같은 날 «회피를 빼고 그 자리에» → 뺐던 몸 옮기기(뛰며 쏘기·구르며 난사·순간 이동)가 회피 칸으로 돌아옴(손으로)
      name: '궁수', art: 'hero_archer', desc: '멀리서 자동 사격 · 부채 사격(자동) · 뛰며 쏘기 · 필살 화살비', weapon: 'bow', basic: '일반 사격', basicIcon: '🏹',
      hp: 105, speed: 70, dmg: 9, range: 150, regen: 0.6, attack: 'bow', skills: ['volley', 'leap'], manual: 'leap', ult: 'rain',
    },
    gunner: {
      name: '권총수', art: 'hero_gunner', desc: '빠른 연사(다 쏘면 장전) · 수류탄(자동) · 구르며 난사 · 필살 총알 폭풍', weapon: 'gun', basic: '연사', basicIcon: '🔫',
      hp: 125, speed: 68, dmg: 10, range: 140, regen: 0.6, attack: 'gun', skills: ['grenade', 'roll'], manual: 'roll', ult: 'barrage',   // 10-22 체력 115→125 · 공격 8→10
    },
    mage: {
      name: '마법사', art: 'hero_mage', desc: '쫓아가 터지는 마법탄 · 메테오(자동) · 순간 이동 · 필살 눈보라', weapon: 'staff', basic: '마법탄', basicIcon: '🔮',
      hp: 100, speed: 64, dmg: 13, range: 150, regen: 0.5, attack: 'magic', skills: ['meteor', 'blink'], manual: 'blink', ult: 'blizzard',   // 10-22 체력 92→100
    },
  };
  // 검사 3연타: fd = 칸마다 시간 · hit = 피해 칸 · range·arc(도) = 앞쪽 부채꼴
  //   10-22 회전 베기를 빼면서 무리 처리 몫을 3연타로(부채꼴 ×1.35 · 사거리 ×1.15) — 봇: 회전 없이 짐승 굴 0/2 → 이렇게 3/4(예전 4/4)
  D.COMBO = [
    { act: 'A', name: '가로 베기', fd: [0.05, 0.06, 0.045, 0.05, 0.06, 0.07], hit: 3, range: 39, arc: 149, mul: 1.0, kb: 70 },
    { act: 'B', name: '내려 베기', fd: [0.05, 0.07, 0.045, 0.05, 0.06, 0.08], hit: 3, range: 39, arc: 108, mul: 1.25, kb: 90 },
    { act: 'C', name: '찌르기', fd: [0.05, 0.07, 0.04, 0.06, 0.06, 0.11], hit: 3, range: 55, arc: 46, mul: 1.7, kb: 130 },
  ];
  D.BOW = { act: 'S', fd: [0.07, 0.09, 0.06, 0.08], hit: 2, speed: 260, life: 0.7, pierce: 2 };   // 10-22 필살이 쿨타임이 되며 무리 처리 몫을 관통 +1 로
  D.GUN = { act: 'G', fd: [0.05, 0.05, 0.05], hit: 1, speed: 380, life: 0.42, mag: 20, reload: 0.9, pierce: 1 };   // 10-22 탄창 16→20
  D.MAGIC = { act: 'M', fd: [0.09, 0.1, 0.09, 0.12], hit: 2, speed: 190, life: 1.0, aoe: 22, turn: 4 };   // 10-22 폭발 18 → 22(필살 쿨타임 보전)
  D.COMBO_RESET = 0.8;
  D.MOVE_WHILE_ATK = 0.85;
  D.CRIT = { chance: 0.08, mul: 2 };
  // 스킬(직업마다 둘: 자동 하나 + 회피 자리 몸 옮기기 하나) · 필살기 — 레벨(1~5)마다 «up» 이 더해짐(카드로 올림)
  D.SKILLS = {
    spin: { name: '회전 베기', short: '회전', icon: '🌀', cd: 4.5, mul: 3.2, r: 56, kb: 140, act: 'A', fd: 0.035,   // (지금은 쓰는 직업 없음)
            ups: ['피해 +30%', '범위 +20%', '재사용 −20%', '두 바퀴(한 번 더 벰)'] },
    dash: { name: '돌진 베기', short: '돌진', icon: '💨', cd: 4, mul: 4.0, dist: 96, dur: 0.18, w: 24, kb: 110, act: 'C', fd: 0.04,   // (지금은 쓰는 직업 없음 · 10-22 검사 자동을 대지 가르기로)
            ups: ['피해 +30%', '거리 +25%', '재사용 −20%', '끝 폭발 범위 +40%'] },
    // 검사 자동(10-22): 내려찍으면 적이 몰린 쪽으로 땅이 갈라지며 바위가 차례로 솟음 · len = 금 길이 · r = 바위 하나 둘레
    //   stagger = 맞은 적의 공격 예고를 끊고 이만큼 쉬게 함(초 · 보스 빼고) · look = 모양(A 빛 기둥 · B 바위 폭발 · C 빛의 검 — game.js RIFT_LOOK)
    rift: { name: '대지 가르기', short: '가르기', icon: '⛰', cd: 4, mul: 4.2, len: 120, r: 20, kb: 70, stagger: 0.45, look: 'A', act: 'B', fd: 0.04,   // 10-22 사용자 «가르기는 A 안으로»
            ups: ['피해 +30%', '길이 +25%', '재사용 −20%', '세 갈래로 갈라짐'] },
    // 손으로 쓰는 몸 옮기기(회피 자리 · 무적 순간 + 공격) — 10-22: 검사 찌르기(사용자 «찌르기로») · 궁수 뛰며 쏘기 · 권총수 구르며 난사 · 마법사 순간 이동
    thrust: { name: '찌르기', short: '찌르기', icon: '🤺',   // 10-23 아이콘 겹침 정리(🗡 은 칼날 폭풍) cd: 2.5, mul: 2.6, dist: 74, dur: 0.15, w: 20, kb: 120, act: 'C', fd: 0.035,
              ups: ['피해 +30%', '거리 +25%', '재사용 −20%', '끝에서 폭발'] },
    volley: { name: '부채 사격', short: '부채', icon: '🪶', cd: 3.2, mul: 1.6, n: 7, spread: 70, act: 'S', fd: 0.04,
              ups: ['피해 +30%', '화살 +3', '재사용 −20%', '관통 +2'] },
    leap: { name: '뛰며 쏘기', short: '도약', icon: '🦘', cd: 3.5, mul: 2.2, dist: 70, dur: 0.22, n: 5, act: 'S', fd: 0.045,
            ups: ['피해 +30%', '화살 +3', '재사용 −20%', '떨어진 자리 폭발'] },
    roll: { name: '구르며 난사', short: '구르기', icon: '🔄', cd: 3.5, mul: 1.4, n: 10, dist: 64, dur: 0.22, act: 'G', fd: 0.04,
            ups: ['피해 +30%', '총알 +5', '재사용 −20%', '구른 자리 폭발'] },
    grenade: { name: '수류탄', short: '수류탄', icon: '💣', cd: 4.5, mul: 5, r: 46, fuse: 0.55, range: 150, act: 'G', fd: 0.05,
               ups: ['피해 +30%', '범위 +20%', '재사용 −20%', '세 개 던짐'] },
    meteor: { name: '메테오', short: '메테오', icon: '☄', cd: 5.5, mul: 9, r: 54, delay: 0.8, range: 170, act: 'M', fd: 0.06,
              ups: ['피해 +30%', '범위 +20%', '재사용 −20%', '떨어진 자리 불바다'] },
    blink: { name: '순간 이동', short: '이동', icon: '✨', cd: 3.5, mul: 2.6, dist: 90, r: 58, act: 'M', fd: 0.04,
             ups: ['서리 피해 +50%', '거리 +30%', '재사용 −20%', '두 번 연속'] },
  };
  // 필살 = 재사용 대기(초)(10-22 사용자 «처치 수로 차는 게이지라 바로바로 써짐 → 쿨타임으로») · ULT_FIRST = 판 시작 때 남은 대기
  //   봇 시험(10-22): 예전 게이지는 무리 속에서 3~5초마다 차서 화력의 큰 몫이었음 → 30~40초면 짐승 굴에서 거의 다 죽고(검사 0/6)
  //   15초면 정복(검사 3/3) — 바로바로는 아니되 자주 쓰는 큰 한 방으로 15초
  D.ULTS = {
    storm: { name: '검풍 난무', short: '필살', icon: '💥', cd: 15, mul: 12, r: 110, kb: 260, act: 'B', fd: 0.075,
             ups: ['피해 +35%', '범위 +20%', '재사용 −20%', '세 번 몰아침'] },
    rain: { name: '화살비', short: '필살', icon: '🌧', cd: 15, mul: 2.2, r: 100, dur: 2.2, tick: 0.12, act: 'S', fd: 0.07,
            ups: ['피해 +35%', '범위 +20%', '재사용 −20%', '두 곳에 쏟아짐'] },
    // 10-22 사용자 «권총수 필살이 다른 필살에 비해 부실» → 둘레 적을 노려 쏨(셋 중 둘) · 관통 2 · 6발마다 폭발탄 · 0.5초마다 충격파 · 끝에 큰 폭발(r)
    barrage: { name: '총알 폭풍', short: '필살', icon: '🎆', cd: 15, mul: 1.8, r: 90, dur: 3, rate: 30, act: 'G', fd: 0.05,
               ups: ['피해 +35%', '시간 +1초', '재사용 −20%', '총알 두 배'] },
    blizzard: { name: '눈보라', short: '필살', icon: '🌨', cd: 15, mul: 1.6, r: 120, dur: 4, tick: 0.25, act: 'M', fd: 0.08,
                ups: ['피해 +35%', '범위 +20%', '재사용 −20%', '얼려 멈춤'] },
  };
  D.ULT_FIRST = 10;
  D.COMBO_UPS = ['피해 +20%', '공격 속도 +15%', '사거리 +20%', '마지막 타격 충격파'];
  D.BOW_UPS = ['피해 +20%', '공격 속도 +15%', '화살 +1', '관통 +2'];
  D.GUN_UPS = ['피해 +20%', '연사 +15%', '탄창 +6', '관통 +1'];
  D.MAGIC_UPS = ['피해 +20%', '시전 속도 +15%', '폭발 범위 +30%', '한 번에 두 발'];
  D.BASIC_UPS = { combo: D.COMBO_UPS, bow: D.BOW_UPS, gun: D.GUN_UPS, magic: D.MAGIC_UPS };
  // 회피(사용자 «백스텝·구르기 · 0.2~0.3초 무적»): 움직이면 그 쪽, 서 있으면 뒤로 · 미끄러짐 + 잔상
  D.DODGE = { name: '회피', short: '회피', cd: 0.9, dur: 0.2, dist: 48, inv: 0.28 };
  D.HIT_STOP = 0.03;                                   // 일반 공격만(10-22 «스킬 쓰면 끊김» — 스킬·돌진·필살은 화면 전체를 멈추지 않음)
  // 맞은 뒤 무적(초) — 10-22 사용자 «피격 무적 줄이자 · 가만히 있어도 안 죽음» 0.35 → 0.25 · «많이 어려워졌네»에 0.32 로 했다가 사용자 «무적은 0.25 로 두고 흡혈 상한을 5%로»
  D.HURT_INV = 0.25;
  // 흡혈로 차는 체력은 초당 최대 체력의 이만큼까지 — «가만히 서 있으면 안 죽음»의 진짜 원인(무리 속 광역 흡혈 초당 10+)을 막는 손잡이
  //   봇: 흡혈 5% 장비로 가만히 서 있기 상한 없음 600초+ 생존 → 2% 면 379초 · 3%(무적 0.32) 면 262·390초 · 10-22 사용자 «5% 로 해 보자» → 5%
  //   5%(무적 0.25) 시험: 가만히 서 있기(흡혈 5% 장비) 322·225초에 쓰러짐 · 흡혈 3% 장비로 움직이면 400초 2/2(2% 도 2/2) · 흡혈 없이 시작한 봇은 상한과 무관(검사 1/4·궁수 1/2)
  D.LEECH_CAP = 0.05;

  // ── 카드 등급(홀즈 오브 토먼트처럼 색) — 수치 배율 · 나올 무게
  D.RARITY = [
    { name: '일반', color: '#d8d6de', mul: 1, w: 62 },
    { name: '희귀', color: '#5ab0ff', mul: 1.5, w: 26 },
    { name: '영웅', color: '#c27aff', mul: 2.2, w: 10 },
    { name: '전설', color: '#ffa63a', mul: 3, w: 2 },
  ];
  // 자동 능력(뱀서 무기처럼 저절로 · 판마다 최대 MAX_ABIL 개) — 5단계 + 짝 패시브가 있으면 상자에서 진화
  //   cls = 그 직업만(없으면 누구나)
  //   10-22 사용자 «공통 공격 스킬 몇 가지 · 무기 스킬·패시브 개수 상한» → 누구나 쓰는 넷 더(회전 도끼·불기둥·독 안개·회오리) · 상한 공격 4 · 패시브 4
  D.ABILITIES = {
    wave: { name: '검기', icon: '🌙', max: 5, pair: 'sharp', evo: 'heaven', cls: 'swordsman',
            desc: l => l <= 1 ? '일반 공격 3번마다 앞으로 꿰뚫는 검기' : ['', '', '피해 +40%', '2번마다', '크기 +40%', '피해 +60%'][l],
            every: [3, 3, 3, 2, 2, 2], mul: [0, 1.4, 2.0, 2.0, 2.0, 3.2], size: [0, 1, 1, 1, 1.4, 1.4] },
    // 10-23 사용자 «궁수·권총수·마법사도 전용 공격 스킬과 진화» — 검기처럼 그 직업만(짝 = 관통 · 날카로움 · 지혜)
    hawk: { name: '추적 화살', icon: '🦅', max: 5, pair: 'pierce', evo: 'starhunt', cls: 'archer',
            desc: l => l <= 1 ? '3초마다 적을 따라가는 화살 2발' : ['', '', '화살 +1', '피해 +40%', '2.2초마다 · 화살 +1', '화살 +1 · 관통 +1'][l],
            cd: [0, 3, 3, 3, 2.2, 2.2], n: [0, 2, 3, 3, 4, 5], mul: [0, 1.2, 1.2, 1.7, 1.7, 1.7] },
    turret: { name: '포탑', icon: '⚙', max: 5, pair: 'sharp', evo: 'fortress', cls: 'gunner',
              desc: l => l <= 1 ? '6초마다 발밑에 포탑(4초 동안 가까운 적을 쏨)' : ['', '', '더 빨리 쏨', '피해 +30% · 오래(5초)', '포탑 둘', '더 빨리 · 오래(6초)'][l],
              cd: [0, 6, 6, 6, 6, 6], dur: [0, 4, 4, 5, 5, 6], rate: [0, 0.5, 0.4, 0.4, 0.4, 0.3], n: [0, 1, 1, 1, 2, 2], mul: [0, 0.8, 0.8, 1.0, 1.0, 1.0] },
    orbs: { name: '비전 구슬', icon: '🪐', max: 5, pair: 'wisdom', evo: 'galaxy', cls: 'mage',
            desc: l => l <= 1 ? '구슬 2개가 둘레를 돌다 3초마다 적에게 날아가 터짐' : ['', '', '피해 +40%', '구슬 +1 · 폭발 크게', '2.4초마다', '구슬 +1 · 피해 +20%'][l],
            cd: [0, 3, 3, 3, 2.4, 2.4], n: [0, 2, 2, 3, 3, 4], mul: [0, 1.0, 1.4, 1.4, 1.4, 1.7], aoe: [0, 26, 26, 32, 32, 32] },   // 10-23 측정: 1.8배일 땐 비수 3단계의 1.8배 → 낮춤
    // 10-22 사용자 «수호 검 이펙트 · 차라리 검 말고 부메랑» → 빙글빙글 도는 부메랑(열쇠 orbit 은 그대로 — 저장된 기록이 안 깨지게)
    orbit: { name: '수호 부메랑', icon: '🪃', max: 5, pair: 'guard', evo: 'barrier',
             desc: l => l <= 1 ? '부메랑 2개가 빙글빙글 둘레를 돎' : ['', '', '부메랑 +1', '피해 +40%', '부메랑 +1', '빠르게 · 부메랑 +1'][l],
             n: [0, 2, 3, 3, 4, 5], mul: [0, 0.8, 0.8, 1.1, 1.1, 1.3], spin: [0, 3, 3, 3, 3, 4.2], r: 34 },
    bolt: { name: '낙뢰', icon: '⚡', max: 5, pair: 'focus', evo: 'thunder',
            desc: l => l <= 1 ? '2.5초마다 가까운 적에게 번개' : ['', '', '한 번에 2곳', '피해 +50%', '1.8초마다', '한 번에 3곳'][l],
            cd: [0, 2.5, 2.5, 2.5, 1.8, 1.8], n: [0, 1, 2, 2, 2, 3], mul: [0, 2.6, 2.6, 3.9, 3.9, 3.9] },
    nova: { name: '서리 고리', icon: '❄', max: 5, pair: 'vigor', evo: 'glacier',
            desc: l => l <= 1 ? '4초마다 퍼지는 서리 고리(느려짐)' : ['', '', '피해 +50%', '범위 +25%', '3초마다', '얼려 멈춤'][l],
            cd: [0, 4, 4, 4, 3, 3], mul: [0, 1.2, 1.8, 1.8, 1.8, 1.8], r: [0, 70, 70, 88, 88, 88] },
    knives: { name: '비수', icon: '🔪', max: 5, pair: 'haste', evo: 'tempest',
              desc: l => l <= 1 ? '가까운 적에게 비수를 던짐' : ['', '', '비수 +1', '피해 +40%', '비수 +1', '빠르게 · 꿰뚫음'][l],
              cd: [0, 1.4, 1.4, 1.4, 1.2, 1.0], n: [0, 1, 2, 2, 3, 3], mul: [0, 1.0, 1.0, 1.4, 1.4, 1.6] },
    axe: { name: '회전 도끼', icon: '🪓', max: 5, pair: 'might', evo: 'axestorm',
           desc: l => l <= 1 ? '도끼를 던지면 빙글빙글 돌아옴(오갈 때 다 벰)' : ['', '', '도끼 +1', '피해 +40%', '멀리 · 크게', '도끼 +1 · 빠르게'][l],
           cd: [0, 2.4, 2.4, 2.4, 2.4, 1.8], n: [0, 1, 2, 2, 2, 3], mul: [0, 0.9, 0.9, 1.2, 1.2, 1.3], reach: [0, 100, 100, 100, 130, 130], size: [0, 1, 1, 1, 1.3, 1.3] },
    // ↑ 10-23 도끼가 둘 이상일 때 적을 비껴가던 것을 고치니(game.js) 3단계가 비수의 3.5배 → 배율 절반쯤으로
    flame: { name: '불기둥', icon: '🔥', max: 5, pair: 'reach', evo: 'volcano',
             desc: l => l <= 1 ? '3초마다 적 발밑에서 불기둥이 솟음' : ['', '', '불기둥 +1', '피해 +50%', '2.2초마다', '불기둥 +1 · 불바닥'][l],
             cd: [0, 3, 3, 3, 2.2, 2.2], n: [0, 1, 2, 2, 2, 3], mul: [0, 2.4, 2.4, 3.6, 3.6, 2.8], r: 18 },   // 10-23 5단계(셋+불바닥) 3.6배는 화산(진화)과 같아져 → 2.8배
    // 10-23 사용자 «흡혈은 진화와 상관없는 패시브로 · 독 안개 짝은 다른 걸로» → 민첩(움직이며 독을 퍼뜨리는 역병과 맞음)
    miasma: { name: '독 안개', icon: '☠', max: 5, pair: 'swift', evo: 'plague',
              desc: l => l <= 1 ? '2.5초마다 선 자리에 독 안개(3초 · 독 피해)' : ['', '', '범위 +25%', '피해 +50%', '오래(4.5초)', '느려짐 · 피해 +30%'][l],
              cd: [0, 2.5, 2.5, 2.5, 2.5, 2.5], mul: [0, 0.35, 0.35, 0.52, 0.52, 0.68], r: [0, 34, 42, 42, 42, 42], dur: [0, 3, 3, 3, 4.5, 4.5] },
    tornado: { name: '회오리', icon: '🌪', max: 5, pair: 'magnet', evo: 'eye',
               desc: l => l <= 1 ? '4초마다 회오리가 앞으로 나가며 적을 빨아들임' : ['', '', '피해 +40%', '회오리 +1', '크게 · 오래', '회오리 +1'][l],
               cd: [0, 4, 4, 4, 4, 4], n: [0, 1, 1, 2, 2, 3], mul: [0, 0.5, 0.7, 0.7, 0.7, 0.7], r: [0, 18, 18, 18, 24, 24], dur: [0, 2.5, 2.5, 2.5, 3.5, 3.5] },
  };
  // 진화(뱀서) — 능력 5단계 + 짝 패시브 → 상자에서
  //   10-23 사용자 «아이콘 겹침» → 진화·패시브·필살 아이콘이 서로 안 겹치게(부메랑 결계 💫 · 칼날 폭풍 🗡 · 도끼 폭풍 🌀 · 폭풍의 눈 👁)
  D.EVOS = {
    heaven: { name: '천검', icon: '🌠', from: 'wave', desc: '모든 일반 공격이 검기 셋을 부채꼴로 · 끝없이 꿰뚫음' },
    barrier: { name: '부메랑 결계', icon: '💫', from: 'orbit', desc: '금빛 부메랑 일곱 · 넓게 돎 · 날아오는 탄을 막음' },
    thunder: { name: '뇌신', icon: '🌩', from: 'bolt', desc: '1.2초마다 번개 4곳 · 맞은 적에서 3번 튐' },
    glacier: { name: '빙하 결계', icon: '🧊', from: 'nova', desc: '2초마다 큰 서리 · 얼려 멈춤 · 얼음 조각이 흩어짐' },
    tempest: { name: '칼날 폭풍', icon: '🗡', from: 'knives', desc: '0.5초마다 비수 여덟 자루가 사방으로 · 꿰뚫음' },
    axestorm: { name: '도끼 폭풍', icon: '🌀', from: 'axe', desc: '1.2초마다 큰 도끼 넷이 사방으로 날았다 돌아옴' },
    volcano: { name: '화산', icon: '🌋', from: 'flame', desc: '1.5초마다 큰 불기둥 다섯 · 불바닥이 오래 탐' },
    plague: { name: '역병', icon: '🦠', from: 'miasma', desc: '몸 둘레에 늘 독 안개가 따라다님 · 느려짐 · 피해 2배' },
    eye: { name: '폭풍의 눈', icon: '👁', from: 'tornado', desc: '회오리 셋이 몸 둘레를 돌며 적을 빨아들임' },
    starhunt: { name: '별빛 사냥', icon: '🌟', from: 'hawk', desc: '1.2초마다 별빛 추적 화살 다섯 · 맞으면 작게 터짐' },
    fortress: { name: '포탑 요새', icon: '🏰', from: 'turret', desc: '포탑 셋이 늘 둘레를 따라다니며 빠르게 관통탄' },
    galaxy: { name: '은하', icon: '🌌', from: 'orbs', desc: '구슬 여섯이 넓게 돌며 0.6초마다 하나씩 날아가 크게 터짐' },
  };
  // 패시브(판마다 최대 MAX_PASS 개 · 5단계) — v = 단계마다(등급 배율 곱함)
  D.PASSIVES = {
    might: { name: '힘', icon: '💪', stat: 'dmg', v: 0.10, fmt: v => '공격력 +' + pct(v) },
    vigor: { name: '체력', icon: '❤', stat: 'hp', v: 0.12, fmt: v => '최대 체력 +' + pct(v) },
    swift: { name: '민첩', icon: '👟', stat: 'speed', v: 0.07, fmt: v => '이동 속도 +' + pct(v) },
    haste: { name: '손놀림', icon: '✋', stat: 'atkspd', v: 0.08, fmt: v => '공격 속도 +' + pct(v) },
    sharp: { name: '날카로움', icon: '🎯', stat: 'crit', v: 0.05, fmt: v => '치명타 +' + pct(v) },
    focus: { name: '집중', icon: '🧘', stat: 'cdr', v: 0.07, fmt: v => '재사용 대기 −' + pct(v) },
    leech: { name: '흡혈', icon: '🩸', stat: 'lifesteal', v: 0.008, fmt: v => '평타·스킬 피해의 ' + (v * 100).toFixed(1) + '% 회복' },
    guard: { name: '철벽', icon: '🛡', stat: 'armor', v: 0.05, fmt: v => '받는 피해 −' + pct(v) },
    wisdom: { name: '지혜', icon: '📖', stat: 'xp', v: 0.10, fmt: v => '경험치 +' + pct(v) },
    greed: { name: '탐욕', icon: '💰', stat: 'gold', v: 0.05, fmt: v => '금화 +' + pct(v) },
    magnet: { name: '자석', icon: '🧲', stat: 'pickup', v: 0.3, fmt: v => '줍는 거리 +' + pct(v) },
    reach: { name: '광역', icon: '⭕', stat: 'area', v: 0.08, fmt: v => '범위 +' + pct(v) },   // 10-22 «넓은 칼날» → 권총수·궁수에게도 맞는 이름(사용자 «왜 권총수에게 칼날»)
    // 관통(10-22 사용자 «관통 1, 관통 2 이런 패시브»): 궁수·권총수만 · int = 정수(일반·희귀 +1 · 영웅·전설 +2)
    pierce: { name: '관통', icon: '🪡', stat: 'pierce', v: 1, int: true, cls: ['archer', 'gunner'], fmt: v => '화살·총알 관통 +' + v },
  };
  // 판마다 가질 수 있는 수(10-22 사용자 «개수 상한» · 화면에 «공격 n/4 · 패시브 n/4») — 진화마다 짝 패시브 하나라 넷·넷이 딱 맞음
  D.MAX_ABIL = 4; D.MAX_PASS = 4; D.MAX_LV = 5;

  // ── 몬스터(사용자: 원거리 공격 · 던전마다 공격 동작 · 굼뜨게)
  //   atk: 'hop'(젤리 · 움츠렸다 튀어 오름) · 'dive'(박쥐 · 급강하) · 'melee'(멈춰 들어 올렸다 내려침 · 앞쪽 부채꼴)
  //        'shoot'(거리 두고 겨눴다 쏨) · 'lunge'(늑대 · 웅크렸다 덮침) · 'charge'(멧돼지 · 선 예고 뒤 돌진) · 'slam'(오우거 · 바닥 원 예고)
  //   windup = 예고 시간(굼뜨게) · rec = 쉬는 시간 · art = 그림 묶음 이름(없으면 그 몬스터는 안 나옴)
  D.MONSTERS = {
    slime: { name: '젤리', art: ['slime_0', 'slime_1', 'slime_2', 'slime_3', 'slime_4'], hp: 16, dmg: 5, speed: 30, xp: 1,
             atk: 'hop', range: 40, windup: 0.5, rec: 0.9, leap: 46 },
    bat: { name: '박쥐', art: ['bat_0', 'bat_1', 'bat_2'], hp: 11, dmg: 4, speed: 48, xp: 1, atk: 'dive', range: 60, windup: 0.4, rec: 0.8, leap: 70, fly: true },
    // 근접(10-22 사용자 «몬스터 공격이 너무 느림 → 근접은 더 일찍»): 예고 ×0.6 · 쉼 짧게 · 조금 먼 데서 시작해 예고 동안에도 다가옴(게임 코드)
    skeleton: { name: '해골 병사', art: ['skeleton'], hp: 30, dmg: 9, speed: 32, xp: 2, atk: 'melee', range: 24, arc: 100, windup: 0.36, rec: 0.5 },
    skel_archer: { name: '해골 궁수', art: ['skel_archer'], hp: 22, dmg: 7, speed: 28, xp: 2, atk: 'shoot', range: 150, keep: 95, windup: 0.8, rec: 1.2,
                   proj: 'arrow', pspd: 120 },
    wolf: { name: '늑대', art: ['wolf'], hp: 24, dmg: 7, speed: 50, xp: 2, atk: 'lunge', range: 46, windup: 0.75, rec: 0.9, leap: 60 },
    boar: { name: '멧돼지', art: ['boar'], hp: 48, dmg: 12, speed: 34, xp: 3, atk: 'charge', range: 120, windup: 0.8, rec: 1.2, leap: 150 },
    goblin: { name: '고블린', art: ['goblin'], hp: 24, dmg: 6, speed: 38, xp: 2, atk: 'melee', range: 22, arc: 100, windup: 0.36, rec: 0.55 },
    shaman: { name: '고블린 주술사', art: ['shaman'], hp: 24, dmg: 10, speed: 28, xp: 3, atk: 'shoot', range: 150, keep: 100, windup: 0.9, rec: 1.4,
              proj: 'orb', pspd: 90 },
    orc: { name: '오크', art: ['orc'], hp: 70, dmg: 14, speed: 30, xp: 4, atk: 'melee', range: 28, arc: 120, windup: 0.48, rec: 0.65 },
    ogre: { name: '오우거', art: ['ogre'], hp: 160, dmg: 20, speed: 24, xp: 8, atk: 'slam', range: 40, aoe: 34, windup: 0.85, rec: 1.1 },
  };
  // 정예(뱀서·홀즈): 크고 금빛 테두리 · 체력 ×8 · 상자를 떨굼 · 덧붙은 성질 하나
  D.ELITE = { hp: 8, dmg: 1.5, scale: 1.35, speed: 1.1, xp: 10, gold: [8, 16] };
  D.AFFIX = {
    swift: { name: '날쌘', speed: 1.5 },
    tough: { name: '단단한', hp: 1.8 },
    vamp: { name: '흡혈하는', heal: 0.03 },
    volatile: { name: '폭발하는', boom: 1 },
  };
  // 보스(사용자: 스킬과 패턴) — 기술마다 예고(빨간 바닥) 뒤에 터짐 · 체력 절반 아래로 더 빠르고 거칠게
  D.BOSSES = {
    // 거대 젤리 셋(10-22 사용자 «모두 쓰자 · 능력치는 순서대로 조금씩 강하게»): 지하 묘지 3분 초록 → 6분 푸른(중간 보스) → 9분 보라
    //   kids = 쓰러지면 갈라지는 작은 젤리 색(같은 색 작은 젤리 그림)
    giant_slime: { name: '초록 거대 젤리', art: 'slime_boss', hp: 1150, dmg: 12, speed: 22, r: 17, gold: [30, 45],
                   moves: ['jump', 'jump', 'spit'], split: true, kids: 'slime_0' },
    jelly_blue: { name: '푸른 거대 젤리', art: 'slime_boss_b', hp: 1350, dmg: 14, speed: 24, r: 18, gold: [40, 60],
                  moves: ['jump', 'spit', 'jump'], split: true, kids: 'slime_1' },
    jelly_purple: { name: '보라 거대 젤리', art: 'slime_boss_p', hp: 1550, dmg: 16, speed: 26, r: 19, gold: [50, 70],
                    moves: ['jump', 'spit', 'jump', 'spit'], split: true, kids: 'slime_3' },
    skeleton_king: { name: '해골 왕', art: 'skeleton_king', hp: 3100, dmg: 20, speed: 26, r: 14, gold: [100, 150],
                     moves: ['sweep', 'spikes', 'summon', 'sweep'], rage: ['whirl', 'spikes'] },
    boar_king: { name: '멧돼지 왕', art: 'boar_king', hp: 1650, dmg: 18, speed: 28, r: 16, gold: [50, 70],
                 moves: ['charge', 'charge', 'stomp'] },
    alpha_wolf: { name: '우두머리 늑대', art: 'alpha_wolf', hp: 3600, dmg: 22, speed: 40, r: 14, gold: [110, 160],
                  moves: ['dashes', 'howl', 'claw', 'dashes'], rage: ['dashes', 'claw'] },
    shaman_elder: { name: '주술사 장로', art: 'shaman_elder', hp: 1950, dmg: 18, speed: 24, r: 12, gold: [55, 75],
                    moves: ['orbs', 'summon', 'orbs'] },
    orc_warlord: { name: '오크 대장', art: 'orc_warlord', hp: 4300, dmg: 26, speed: 26, r: 16, gold: [130, 180],
                   moves: ['quake', 'axes', 'sweep', 'quake'], rage: ['axes', 'quake'] },
    golem: { name: '바위 골렘', art: 'golem', hp: 2400, dmg: 22, speed: 18, r: 18, gold: [60, 80], moves: ['slam', 'boulders'] },
    ogre_chief: { name: '오우거 족장', art: 'ogre_chief', hp: 5300, dmg: 30, speed: 22, r: 20, gold: [150, 210],
                  moves: ['leap', 'boulders', 'quake', 'leap'], rage: ['leap', 'quake'] },
  };
  // 던전(해머워치·홀즈처럼 테마마다 몬스터·보스) — mobs: [몬스터, 나오기 시작(초), 무게] · tier = 강함
  D.DUNGEONS = [
    { key: 'crypt', name: '지하 묘지', tiles: 'tiles_crypt', tier: 1, mid: 'jelly_blue', boss: 'skeleton_king',
      minis: { 180: 'giant_slime', 540: 'jelly_purple' },             // 정예 무리 대신 나오는 보스(3분 초록 · 9분 보라)
      mobs: [['slime', 0, 10], ['bat', 40, 6], ['skeleton', 90, 8], ['skel_archer', 170, 5]] },
    { key: 'den', name: '짐승 굴', tiles: 'tiles_den', tier: 1.6, mid: 'boar_king', boss: 'alpha_wolf',
      mobs: [['bat', 0, 6], ['slime', 0, 6], ['wolf', 40, 7], ['boar', 120, 5], ['skel_archer', 240, 3]] },
    { key: 'fort', name: '고블린 요새', tiles: 'tiles_fort', tier: 2.0, mid: 'shaman_elder', boss: 'orc_warlord',
      mobs: [['goblin', 0, 10], ['wolf', 30, 4], ['shaman', 80, 5], ['orc', 150, 6]] },
    { key: 'valley', name: '거인 골짜기', tiles: 'tiles_valley', tier: 2.7, mid: 'golem', boss: 'ogre_chief',
      mobs: [['goblin', 0, 8], ['boar', 30, 5], ['orc', 90, 7], ['ogre', 240, 4], ['shaman', 200, 3]] },
  ];
  // 한 판 = 12분(폰에 맞게) — 3·9분 정예 무리 · 6분 중간 보스 · 12분 마지막 보스
  D.RUN = { len: 720, eliteWave: [180, 540], mid: 360, boss: 720, eliteEvery: [55, 85] };
  // 시간에 따라 적이 단단해지고(제곱 항) 아파짐 · 살아 있는 적 수도 늘어남 — 봇 시험(10-22)으로 맞춤
  //   처음 3분은 약하게(배우는 시간) → 6분 보통 → 12분 1.7배
  //   던전 단계(tier)는 주로 체력에 · 피해에는 조금만(뒤 던전 첫 1분에 몰살당하지 않게)
  //   10-22 필살이 쿨타임(15초)이 되며 무리를 치워 주던 몫이 줄어 적 체력 ×0.9
  D.enemyScale = (tier, sec) => { const m = sec / 60; return { hp: 0.9 * (0.4 + 0.6 * tier) * (1 + 0.25 * m + 0.02 * m * m), dmg: (0.6 + tier * 0.2) * (0.6 + 0.11 * m) }; };
  D.bossHp = (tier, sec) => { const m = sec / 60; return (0.4 + 0.6 * tier) * (1 + 0.2 * m + 0.01 * m * m); };   // 보스는 덜 가파르게(싸움 1~2분)
  D.alive = (sec, lv) => Math.min(150, 18 + Math.floor(sec / 8) + lv * 2);
  D.SPAWN_EVERY = 0.35; D.PACK = [4, 8];
  D.xpNeed = lv => 10 + lv * 8 + lv * lv;
  D.GOLD_DROP = 0.025; D.HEAL_DROP = 0.008; D.HEAL_PCT = 0.25; D.PICKUP = 40;
  D.MAGNET_BOSS = 0.6;                                 // 보스(마지막 빼고)를 잡으면 이 확률로 자석(바닥 보석·금화를 다 끌어옴)
  D.ITEM_DROP = { mob: 0.0008, elite: 0.25 };

  // ── 장비 — 칸 4 · 등급 4 · 붙는 성질 무작위
  //   10-22 사용자 «해머워치2처럼 바로 줍고 장비 · 한 판에 하나만 들고 나오니 답답» → 판 안에서 줍는 즉시 더 좋으면 낌 · 주운 건 끝나면 전부 창고로(쓰러져도)
  D.SLOTS = { weapon: '무기', armor: '갑옷', ring: '반지', amulet: '목걸이' };
  D.STASH_MAX = 150;                                   // 창고가 이보다 많아지면 안 낀 것 중 낮은 등급·레벨부터 분해(전설 빼고)
  D.ITEM_RARITY = [
    { name: '일반', color: '#d8d6de', n: 1, scrap: 8 },
    { name: '마법', color: '#5a9cff', n: 2, scrap: 20 },
    { name: '희귀', color: '#ffd84a', n: 3, scrap: 45 },
    { name: '전설', color: '#ff8a2a', n: 3, scrap: 120, unique: true },
  ];
  // 장비 바탕 = [이름, 종류(아이콘 모양), 단계(던전 순서가 이 이상일 때 나옴), 고유 성능(늘 붙는 줄)]
  //   10-22 사용자 «아이템 이름 통일 · 무기가 8가지일 필요가 있나 · 석궁·장총이 활·권총 칸에 있어 어색» → 무기는 직업마다 4가지 = 단계마다 하나
  //   이름 = «재질 + 종류» · 재질이 곧 단계(청동 1 · 강철 2 · 미스릴 3 · 룬 4) — 무기·갑옷 같은 말 · 고유 성능도 단계마다 같음
  const TIERS = ['청동', '강철', '미스릴', '룬'];
  const WEAPON_IMP = [{}, { dmg: 0.08 }, { dmg: 0.08, atkspd: 0.06 }, { dmg: 0.12, crit: 0.05 }];
  const ARMOR_IMP = [{}, { hp: 0.10 }, { hp: 0.08, speed: 0.05 }, { hp: 0.12, armor: 0.05 }];
  D.ITEM_BASES = {
    weapon: Object.entries({ sword: '검', bow: '활', gun: '권총', staff: '지팡이' })
      .flatMap(([k, w]) => TIERS.map((t, i) => [t + ' ' + w, k, i + 1, WEAPON_IMP[i]])),
    armor: TIERS.map((t, i) => [t + ' 갑옷', 'armor', i + 1, ARMOR_IMP[i]]),
    ring: [['구리 반지', 'ring'], ['은 반지', 'ring'], ['금 반지', 'ring']],
    amulet: [['루비 목걸이', 'amulet'], ['사파이어 목걸이', 'amulet'], ['에메랄드 목걸이', 'amulet'], ['자수정 목걸이', 'amulet']],   // 10-22 «목걸이는 보석 이름으로»
  };
  // 옛 기록(10-22 전)의 바탕 이름 → 새 이름 — save.js 가 한 번만 바꿈(고유 성능도 새 바탕 것으로) · 무기는 옛 단계대로 · null = 아이템 레벨(주운 던전) 단계로
  D.ITEM_RENAME = {
    '녹슨 검': '청동 검', '기사의 검': '청동 검', '쌍날 검': '강철 검', '대검': '강철 검', '룬 검': '미스릴 검', '마검': '미스릴 검', '용 비늘 검': '룬 검', '성검': '룬 검',
    '사냥 활': '청동 활', '장궁': '청동 활', '짧은 활': '강철 활', '석궁': '강철 활', '요정 활': '미스릴 활', '뼈 활': '미스릴 활', '폭풍 활': '룬 활', '별빛 활': '룬 활',
    '낡은 권총': '청동 권총', '연발 권총': '청동 권총', '황동 권총': '강철 권총', '산탄 권총': '강철 권총', '장총': '미스릴 권총', '쌍권총': '미스릴 권총', '용의 숨결': '룬 권총', '천둥 권총': '룬 권총',
    '참나무 지팡이': '청동 지팡이', '수정 지팡이': '청동 지팡이', '별 지팡이': '강철 지팡이', '해골 지팡이': '강철 지팡이',
    '불꽃 지팡이': '미스릴 지팡이', '얼음 지팡이': '미스릴 지팡이', '대마법사의 지팡이': '룬 지팡이', '혼돈의 지팡이': '룬 지팡이',
    '가죽 조끼': null, '사슬 갑옷': null, '판금 갑옷': null,
    '뼈 목걸이': '자수정 목걸이', '호박 목걸이': '루비 목걸이', '별 목걸이': '사파이어 목걸이',
  };
  // 성질: v = 기본값(아이템 레벨·강화로 커짐) · slots = 붙을 수 있는 칸
  D.AFFIXES = {
    dmg: { name: '공격력', v: 0.08, fmt: v => '+' + pct(v), slots: ['weapon', 'ring', 'amulet'] },
    hp: { name: '체력', v: 0.10, fmt: v => '+' + pct(v), slots: ['armor', 'amulet', 'ring'] },
    armor: { name: '받는 피해', v: 0.04, fmt: v => '−' + pct(v), slots: ['armor'] },
    speed: { name: '이동 속도', v: 0.04, fmt: v => '+' + pct(v), slots: ['armor', 'amulet'] },
    atkspd: { name: '공격 속도', v: 0.05, fmt: v => '+' + pct(v), slots: ['weapon', 'ring'] },
    crit: { name: '치명타', v: 0.03, fmt: v => '+' + pct(v), slots: ['weapon', 'ring', 'amulet'] },
    critdmg: { name: '치명 피해', v: 0.15, fmt: v => '+' + pct(v), slots: ['weapon', 'amulet'] },
    cdr: { name: '재사용 대기', v: 0.04, fmt: v => '−' + pct(v), slots: ['ring', 'amulet'] },
    lifesteal: { name: '흡혈', v: 0.01, fmt: v => (v * 100).toFixed(1) + '%', slots: ['weapon', 'ring'] },
    xp: { name: '경험치', v: 0.06, fmt: v => '+' + pct(v), slots: ['amulet', 'ring'] },
    gold: { name: '금화', v: 0.10, fmt: v => '+' + pct(v), slots: ['ring', 'amulet', 'armor'] },
    area: { name: '범위', v: 0.06, fmt: v => '+' + pct(v), slots: ['weapon', 'amulet'] },
    skill: { name: '스킬 피해', v: 0.10, fmt: v => '+' + pct(v), slots: ['weapon', 'amulet', 'ring'] },
    regen: { name: '초당 회복', v: 0.4, fmt: v => '+' + v.toFixed(1), slots: ['armor', 'amulet'] },
  };
  // 전설 고유 효과(홀즈·디아블로처럼 빌드를 바꿈)
  D.UNIQUES = {
    twinspin: { name: '질풍', desc: '스킬을 쓸 때마다 필살 재사용 −2초' },   // 열쇠 이름은 그대로(저장된 장비가 깨지지 않게) · 전엔 «쌍회전»
    thunderhit: { name: '천둥 칼날', desc: '치명타 때 번개가 떨어짐' },
    frostdodge: { name: '서리 걸음', desc: '회피한 자리에 서리 고리' },
    vampcrit: { name: '피의 굶주림', desc: '치명타 피해의 5% 회복' },
    goldrush: { name: '황금 손', desc: '적 처치 때 금화가 더 자주(×2)' },
    phoenix: { name: '불사조 깃털', desc: '판마다 한 번 쓰러져도 체력 50%로 일어남' },
    // 무기 전용(10-22 · wpn = 그 무기에만 붙음)
    whirlblade: { name: '회오리 칼날', desc: '3연타 마지막 타격이 둘레로 충격파', wpn: 'sword' },
    bloodedge: { name: '피의 칼날', desc: '대지 가르기에 맞힌 적마다 체력 2% 회복(한 번에 최대 10%)', wpn: 'sword' },   // 10-22 돌진 끝 폭발 → 대지 가르기
    splitshot: { name: '갈래 화살', desc: '일반 사격이 양옆으로 한 발씩 더', wpn: 'bow' },
    blastarrow: { name: '폭발 화살', desc: '일반 화살이 맞은 자리에서 작게 터짐', wpn: 'bow' },
    pierceround: { name: '관통탄', desc: '총알이 두 마리 더 꿰뚫음', wpn: 'gun' },
    bigmag: { name: '큰 탄창', desc: '탄창 +10 · 장전 40% 빠르게', wpn: 'gun' },
    twinbolt: { name: '쌍둥이 마법탄', desc: '마법탄이 한 발 더', wpn: 'staff' },
    chainbolt: { name: '연쇄 번개', desc: '마법탄이 터지면 가까운 적 둘에게 번개', wpn: 'staff' },
  };
  D.itemLevelOf = tier => Math.max(1, Math.round(tier * 3));
  D.affixScale = (ilvl, up) => (1 + 0.12 * (ilvl - 1)) * (1 + 0.08 * (up || 0));
  D.SMITH = { max: 10, cost: (up, rar) => Math.round((40 + up * up * 15) * (1 + rar * 0.6)) };

  // ── 축복(판 밖 영구 강화 · 금화)
  D.BLESS = {
    hp: { name: '굳센 몸', icon: '❤', max: 10, stat: 'hp', v: 0.05, cost: 60 },
    dmg: { name: '날 선 손', icon: '⚔', max: 10, stat: 'dmg', v: 0.04, cost: 60 },
    speed: { name: '가벼운 발', icon: '👟', max: 5, stat: 'speed', v: 0.03, cost: 90 },
    regen: { name: '되살아남', icon: '✚', max: 5, stat: 'regen', v: 0.2, cost: 80 },
    crit: { name: '매의 눈', icon: '🎯', max: 5, stat: 'crit', v: 0.01, cost: 100 },
    xp: { name: '배움', icon: '📖', max: 5, stat: 'xp', v: 0.05, cost: 80 },
    gold: { name: '재물운', icon: '💰', max: 5, stat: 'gold', v: 0.08, cost: 80 },
    reroll: { name: '다시 뽑기', icon: '🔁', max: 3, stat: 'reroll', v: 1, cost: 250 },
    revive: { name: '두 번째 목숨', icon: '🕊', max: 1, stat: 'revive', v: 1, cost: 1200 },
  };
  D.blessCost = (b, lv) => Math.round(b.cost * 1.6 * Math.pow(lv + 1, 1.7));     // 앞 단계는 싸고 뒤로 갈수록 비쌈(오래 키우는 맛)

  // ── 도전 과제(홀즈: 늘 다음 목표 · 보상 = 금화·해금)
  //   need(P) = 진행 [지금, 목표] · gift = 보상
  const K = (P, k) => (P.stats.kills[k] || 0);
  D.ACH = [
    { id: 'first', name: '첫 원정', desc: '원정을 한 번 떠난다', need: P => [P.stats.runs, 1], gift: { gold: 50 } },
    { id: 'slime300', name: '젤리 사냥꾼', desc: '젤리 300마리', need: P => [K(P, 'slime'), 300], gift: { gold: 120 } },
    { id: 'bone300', name: '뼈 부수기', desc: '해골 300마리', need: P => [K(P, 'skeleton') + K(P, 'skel_archer'), 300], gift: { abil: 'bolt' } },
    { id: 'elite10', name: '정예 사냥', desc: '정예 10마리', need: P => [P.stats.elites, 10], gift: { abil: 'nova' } },
    { id: 'lv20', name: '단련', desc: '한 판에 레벨 20', need: P => [P.stats.maxLv, 20], gift: { gold: 200 } },
    { id: 'crypt', name: '지하 묘지 정복', desc: '해골 왕을 쓰러뜨린다', need: P => [P.stats.bosses.skeleton_king || 0, 1], gift: { dungeon: 'den', cls: 'archer' } },
    { id: 'evo', name: '진화', desc: '능력을 진화시킨다', need: P => [P.stats.evos, 1], gift: { gold: 300 } },
    { id: 'legend', name: '전설', desc: '전설 카드를 고른다', need: P => [P.stats.legends, 1], gift: { gold: 150 } },
    { id: 'wolf300', name: '늑대 사냥꾼', desc: '늑대 300마리', need: P => [K(P, 'wolf'), 300], gift: { gold: 250 } },
    { id: 'den', name: '짐승 굴 정복', desc: '우두머리 늑대를 쓰러뜨린다', need: P => [P.stats.bosses.alpha_wolf || 0, 1], gift: { dungeon: 'fort', cls: 'gunner' } },
    { id: 'goblin', name: '보물 고블린', desc: '도망치는 보물 고블린을 잡는다', need: P => [P.stats.goblins, 1], gift: { gold: 300 } },
    { id: 'secret', name: '숨은 방', desc: '금 간 기둥 속 비밀 상자를 연다', need: P => [P.stats.secrets, 1], gift: { gold: 200 } },
    { id: 'shrine', name: '순례자', desc: '던전의 제단을 10번 밟는다', need: P => [P.stats.shrines || 0, 10], gift: { gold: 250 } },
    { id: 'fort', name: '고블린 요새 정복', desc: '오크 대장을 쓰러뜨린다', need: P => [P.stats.bosses.orc_warlord || 0, 1], gift: { dungeon: 'valley', cls: 'mage' } },
    { id: 'ult30', name: '쓸어버리기', desc: '필살기 한 번에 30마리', need: P => [P.stats.ultKills, 30], gift: { gold: 400 } },
    { id: 'valley', name: '거인 골짜기 정복', desc: '오우거 족장을 쓰러뜨린다', need: P => [P.stats.bosses.ogre_chief || 0, 1], gift: { gold: 1500 } },
  ];
  D.START_ABIL = ['wave', 'hawk', 'turret', 'orbs', 'orbit', 'knives', 'axe', 'flame', 'miasma', 'tornado'];   // 처음부터 카드에 나오는 능력(낙뢰·서리 고리는 도전 과제로 해금)
  return D;
})();
