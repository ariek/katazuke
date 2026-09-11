// 状態管理、保存、画面切り替え

const STORAGE_KEY = 'katazuke.v1';
const LAST_TAB_KEY = 'katazuke.lastTab'; // 最後に見ていたタブ。エクスポートには含めない
const TAB_NAMES = ['quests', 'room', 'log', 'settings'];
const DATA_VERSION = 1;

let state = null;
const SECTIONS_KEY = 'katazuke.sections'; // クエスト画面の折りたたみ状態。エクスポートには含めない
const ui = { tab: 'quests', areaFilter: null, logMonth: null, logDay: null, sections: loadSections(), extraSec: 0, extraTaskId: null };

function loadSections() {
  const defaults = { todo: false, done: false, byArea: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SECTIONS_KEY) || '{}');
    return { ...defaults, ...saved };
  } catch (err) { return defaults; }
}

function saveSections() {
  try { localStorage.setItem(SECTIONS_KEY, JSON.stringify(ui.sections)); } catch (err) { /* 保存できなくても続行 */ }
}

// --- 保存 -------------------------------------------------------------

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptyState() {
  return {
    version: DATA_VERSION,
    player: { xp: 0, level: 1, bestStreak: 0 },
    areas: [],
    tasks: [],
    logs: [],
    session: null,
    sessions: [],
    sample: false,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return migrate(data);
  } catch (err) {
    console.error('保存データを読み込めませんでした', err);
    return null;
  }
}

// 0.x の間は変換処理を書かず、足りない項目を初期値で埋めるだけ（SPEC 9.2）
function migrate(data) {
  if (!data.version) data.version = DATA_VERSION;
  if (!data.player) data.player = { xp: 0, level: 1, bestStreak: 0 };
  if (!Array.isArray(data.areas)) data.areas = [];
  // 旧「エリアの絵（kind）」は色とアイコンに置き換える
  const KIND_TO_ICON = { desk: 'laptop', floor: 'broom', bed: 'bed', closet: 'shirt', kitchen: 'pot', bath: 'bath', entrance: 'house', shelf: 'book', house: 'house' };
  data.areas.forEach((a, i) => {
    if (!a.color) a.color = CATEGORY_COLORS[i % CATEGORY_COLORS.length].id;
    if (!a.icon) a.icon = KIND_TO_ICON[a.kind] || DEFAULT_ICON;
    delete a.kind;
  });
  if (!Array.isArray(data.tasks)) data.tasks = [];
  if (!Array.isArray(data.logs)) data.logs = [];
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (data.session === undefined) data.session = null;
  delete data.timer; // 旧タイマーは使わない
  return data;
}

function saveState() {
  state.player.level = levelInfo(state.player.xp).level;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// --- サンプルデータ ---------------------------------------------------

function sampleState(now = new Date()) {
  const s = emptyState();
  s.sample = true;
  const iso = (d) => new Date(d).toISOString();
  const daysAgo = (n) => addDays(now, -n);
  const daysLater = (n) => addDays(now, n);

  const areaDefs = DEFAULT_AREAS;
  const areas = areaDefs.map(([name, color, icon], i) => ({ id: newId('a'), name, color, icon, order: i }));
  s.areas = areas;
  const A = Object.fromEntries(areaDefs.map(([name], i) => [name, areas[i].id]));

  // repeat: none | daily | weekly | {days: n}
  const t = (areaName, title, difficulty, repeat, opts = {}) => {
    const rep = typeof repeat === 'number' ? { type: 'days', every: repeat } : { type: repeat };
    return {
      id: newId('t'),
      areaId: A[areaName],
      title,
      difficulty,
      repeat: rep,
      note: '',
      deadline: opts.deadline ? iso(opts.deadline) : null,
      deferredAt: null,
      lastDoneAt: opts.lastDone ? iso(opts.lastDone) : null,
      dueAt: opts.due ? iso(opts.due) : null,
      done: false,
      createdAt: iso(daysAgo(7)),
    };
  };

  s.tasks = [
    t('仕事', 'メールの返信', 1, 'daily', { lastDone: daysAgo(2), due: daysAgo(1) }),
    t('仕事', '経費精算を出す', 2, 'weekly', { lastDone: daysAgo(10), due: daysAgo(3) }),
    t('仕事', '会議の資料を作る', 3, 'none', { deadline: daysLater(2) }),
    t('家事', '洗い物をする', 1, 'daily', { lastDone: daysAgo(1), due: daysAgo(0) }),
    t('家事', '洗濯物をたたむ', 1, 2, { lastDone: daysAgo(1), due: daysLater(1) }),
    t('家事', 'ゴミを出す', 1, 'weekly', { lastDone: daysAgo(2), due: daysLater(5) }),
    t('勉強', '英単語を10個おぼえる', 1, 'daily', { lastDone: now, due: daysLater(1) }),
    t('勉強', '参考書を1章読む', 2, 3, { lastDone: daysAgo(3), due: daysAgo(0) }),
    t('健康', 'ストレッチをする', 1, 'daily', { lastDone: daysAgo(1), due: daysAgo(0) }),
    t('健康', '30分歩く', 2, 'daily', { lastDone: daysAgo(3), due: daysAgo(2) }),
    t('買い物', '牛乳を買う', 1, 'none', { deadline: daysLater(1) }),
    t('買い物', '電池を買う', 1, 'none'),
  ];

  s.logs = [
    { taskId: s.tasks[6].id, doneAt: iso(now), xp: 15, baseXp: 15, bonusXp: 0, combo: 0, prev: { done: false, lastDoneAt: iso(daysAgo(1)), dueAt: iso(daysAgo(0)) } },
    { taskId: s.tasks[3].id, doneAt: iso(daysAgo(1)), xp: 27, baseXp: 15, bonusXp: 12, combo: 1 },
    { taskId: s.tasks[4].id, doneAt: iso(daysAgo(1)), xp: 47, baseXp: 25, bonusXp: 22, combo: 2 },
    { taskId: s.tasks[5].id, doneAt: iso(daysAgo(2)), xp: 15, baseXp: 15, bonusXp: 0, combo: 0 },
  ];
  s.player.xp = 104;
  s.player.bestStreak = 3;
  return s;
}

// --- 描画 -------------------------------------------------------------

// スプライトのアイコンを埋め込む HTML
function iconHtml(name, cls = 'icon') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#${name}"/></svg>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderHeader() {
  const info = levelInfo(state.player.xp);
  const streak = currentStreak(state.logs);
  document.getElementById('level-badge').textContent = `Lv.${info.level} ${titleForLevel(info.level)}`;
  document.getElementById('xp-fill').style.width = `${Math.round((info.xpInLevel / info.xpToNext) * 100)}%`;
  document.getElementById('xp-text').textContent = `${info.xpInLevel} / ${info.xpToNext}`;
  document.getElementById('streak').innerHTML = streak > 0
    ? `${iconHtml('i-flame', 'icon icon-flame')} <strong>${streak}</strong>日`
    : `${iconHtml('i-flame', 'icon icon-flame icon-off')} <strong>0</strong>日`;
}

function render() {
  renderHeader();
  renderOverview();
  renderQuests();
  renderTimerMini();
  renderSettings();
  renderLog();
  renderSessionModals();
}

// 休憩とまとめのモーダル（完了演出は effects.js）
function renderSessionModals() {
  const s = state.session;
  const breakModal = document.getElementById('break-modal');
  const summaryModal = document.getElementById('summary-modal');
  setModalVisible(breakModal, !!(s && s.phase === 'break'));
  if (s && s.phase === 'break') {
    const note = document.querySelector('#break-modal .break-note');
    note.hidden = s.combo <= 0;
    document.getElementById('break-combo').innerHTML = comboBadge(s.combo);
    renderTimerTick();
  }
  setModalVisible(summaryModal, !!(s && s.phase === 'summary'));
  if (s && s.phase === 'summary') {
    const r = s.summary;
    const from = new Date(r.startedAt); const to = new Date(r.endedAt);
    const hm = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    document.getElementById('summary-sub').textContent = `${formatShortDate(from)} ${hm(from)} 〜 ${hm(to)}`;
    document.getElementById('summary-xp').textContent = String(r.xp);
    document.getElementById('summary-count').textContent = String(r.completed);
    document.getElementById('summary-combo').textContent = String(r.maxCombo);
    document.getElementById('summary-min').innerHTML = `${Math.max(1, Math.round(r.durationSec / 60))}<small>分</small>`;
    const rankCell = document.getElementById('summary-rank-cell');
    rankCell.hidden = !(r.rank >= 1 && r.rank <= 5);
    document.getElementById('summary-rank').textContent = String(r.rank);
    const best = document.getElementById('summary-best');
    best.hidden = !(r.rank >= 1 && r.rank <= 5);
    best.textContent = r.rank === 1 ? '自己ベスト更新！' : `自己ベスト${r.rank}位！`;
    document.getElementById('summary-title').textContent = r.completed > 0 ? 'おつかれさま！' : 'セッションを終えました';
  }
}

// --- タブ -------------------------------------------------------------

function switchTab(tab) {
  ui.tab = tab;
  try { localStorage.setItem(LAST_TAB_KEY, tab); } catch (err) { /* 保存できなくても続行 */ }
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== tab; });
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
  renderTimerMini();
  document.querySelector('.main').scrollTo(0, 0);
}

// --- 端末の余白（セーフエリア）を実測して CSS に渡す ---------------------
// iOS で env() を使った計算が効かないことがあるため、px の実数に置き換える

function measureInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;'
    + 'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  // 0 のときは上書きせず CSS の env() に任せる（iOS が起動直後に 0 を返すことがある）
  const root = document.documentElement.style;
  if (top > 0) root.setProperty('--inset-top', `${top}px`); else root.removeProperty('--inset-top');
  if (bottom > 0) root.setProperty('--inset-bottom', `${bottom}px`); else root.removeProperty('--inset-bottom');
}

// --- PWA: サービスワーカーの登録と更新通知 ---------------------------

const APP_VERSION = 'v0.7.0';
let waitingWorker = null;

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // 初回インストールではなく、すでに動いている版がある場合だけ知らせる
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
    document.getElementById('app-update').addEventListener('click', async () => {
      try {
        await reg.update();
        if (reg.waiting) offerUpdate(reg.waiting);
        else showToast('最新の版です');
      } catch (err) {
        showToast('確認できませんでした（オフライン？）');
      }
    });
  }).catch((err) => console.warn('サービスワーカーを登録できませんでした', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

function offerUpdate(worker) {
  waitingWorker = worker;
  document.getElementById('update-bar').hidden = false;
}

// --- 起動 -------------------------------------------------------------

function init() {
  injectCategoryIcons();
  state = loadState() || sampleState();
  state = migrate(state);
  saveState();
  render();

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (btn) switchTab(btn.dataset.tab);
  });

  document.getElementById('room-grid').addEventListener('click', (e) => {
    const card = e.target.closest('.cat-card');
    if (!card) return;
    ui.areaFilter = card.dataset.area;
    renderQuests();
    switchTab('quests');
  });

  initQuests();
  initSettings();
  initBulk();
  initLog();
  initEffects();
  initDialog();
  initTimer();
  render();
  // 前回見ていた画面から始める。なければクエスト
  let lastTab = null;
  try { lastTab = localStorage.getItem(LAST_TAB_KEY); } catch (err) { lastTab = null; }
  switchTab(TAB_NAMES.includes(lastTab) ? lastTab : 'quests');

  document.getElementById('app-version').textContent = `タスククエスト ${APP_VERSION}`;
  measureInsets();
  setTimeout(measureInsets, 500);
  window.addEventListener('resize', measureInsets);
  window.addEventListener('pageshow', measureInsets);
  window.addEventListener('orientationchange', () => setTimeout(measureInsets, 300));
  document.getElementById('update-reload').addEventListener('click', () => {
    if (waitingWorker) waitingWorker.postMessage('skipWaiting');
    else window.location.reload();
  });
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);
