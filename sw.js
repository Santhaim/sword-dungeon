// 홈 화면 앱(오프라인) — 네트워크 우선, 끊기면 캐시
// GitHub Pages 는 파일마다 max-age=600 을 붙여 고친 판이 늦게 뜰 수 있음 → 같은 사이트 파일은 cache:'no-cache' 로 매번 «바뀌었나» 확인
const CACHE = 'sword-dungeon-v5';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'css/style.css', 'js/data.js', 'js/save.js', 'js/audio.js', 'js/bgm_data.js', 'js/bgm.js', 'js/game.js', 'js/main.js', 'art/art.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' })))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const same = new URL(e.request.url).origin === self.location.origin;
  const req = !same ? e.request
    : e.request.mode === 'navigate' ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(req)
      .then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});
