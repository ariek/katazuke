// ゲームルール: 経験値、レベル、ストリーク、きれい度の計算
// 数値はすべて仮置き（SPEC.md 5章）

const XP_BY_DIFFICULTY = { 1: 10, 2: 25, 3: 50 };
const TIMER_BONUS = 1.5;

const TITLES = [
  [1, '見習い'],
  [3, '片付け見習い'],
  [5, '片付け係'],
  [8, '整理上手'],
  [10, '整理の達人'],
  [15, '片付けマスター'],
];

function xpToNext(level) {
  return 100 * level;
}

// 累計経験値からレベルと現在レベル内の経験値を求める
function levelInfo(totalXp) {
  let level = 1;
  let xp = totalXp;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  return { level, xpInLevel: xp, xpToNext: xpToNext(level) };
}

function titleForLevel(level) {
  let title = TITLES[0][1];
  for (const [lv, name] of TITLES) {
    if (level >= lv) title = name;
  }
  return title;
}

function xpForTask(task, inTimer) {
  const base = XP_BY_DIFFICULTY[task.difficulty] || XP_BY_DIFFICULTY[1];
  return Math.round(inTimer ? base * TIMER_BONUS : base);
}

// タスクの状態
//   done    : 繰り返しなしで達成済み
//   todo    : 繰り返しなし。期限なし、または期限内。やることに出るが、きれい度では期限内扱い
//   overdue : 繰り返しなしで期限切れ
//   fresh   : 繰り返しありで次回期限がまだ来ていない
//   due     : 繰り返しありで次回期限が来ている（未完了を含む）
function taskStatus(task, now = new Date()) {
  if (task.done) return 'done';
  const t = now.getTime();
  if (task.repeat.type === 'none') {
    if (!task.deadline) return 'todo';
    return new Date(task.deadline).getTime() <= t ? 'overdue' : 'todo';
  }
  if (!task.dueAt) return 'due';
  return new Date(task.dueAt).getTime() <= t ? 'due' : 'fresh';
}

function isDueStatus(status) {
  return status === 'due' || status === 'overdue';
}

// エリアのきれい度: 期限内のタスク数 ÷ 有効なタスク数。タスクなしは 1
function areaCleanliness(areaId, tasks, now = new Date()) {
  const active = tasks.filter((task) => task.areaId === areaId && !task.done);
  if (active.length === 0) return { ratio: 1, state: 'clean', dueCount: 0, todoCount: 0, total: 0 };
  let fresh = 0;
  let dueCount = 0; // 期限が来ているもの
  let todoCount = 0; // やることに出るもの（期限切れ・今日・期限なし）
  for (const task of active) {
    const status = taskStatus(task, now);
    if (isDueStatus(status)) { dueCount += 1; todoCount += 1; }
    else if (status === 'todo') { fresh += 1; todoCount += 1; }
    else fresh += 1;
  }
  const ratio = fresh / active.length;
  return { ratio, state: cleanState(ratio), dueCount, todoCount, total: active.length };
}

function cleanState(ratio) {
  if (ratio >= 0.8) return 'clean';
  if (ratio >= 0.4) return 'normal';
  return 'messy';
}

const CLEAN_LABELS = { clean: 'きれい', normal: 'ふつう', messy: '散らかり' };

// ローカル日付キー YYYY-MM-DD
function dateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ストリーク: 今日または昨日から遡って、達成日が連続している日数
function currentStreak(logs, now = new Date()) {
  const days = new Set(logs.map((log) => dateKey(log.doneAt)));
  if (days.size === 0) return 0;
  let cursor = new Date(now);
  if (!days.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!days.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (days.has(dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// --- 日付ユーティリティと繰り返し ------------------------------------

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 完了時刻から次回期限を求める。翌日以降の 0:00 にそろえる
function nextDueDate(doneAt, repeat) {
  const base = startOfDay(doneAt);
  if (repeat.type === 'daily') return addDays(base, 1);
  if (repeat.type === 'weekly') return addDays(base, 7);
  if (repeat.type === 'days') return addDays(base, Math.max(1, repeat.every || 1));
  return null;
}

function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

function formatShortDate(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function repeatLabel(repeat) {
  if (repeat.type === 'daily') return '毎日';
  if (repeat.type === 'weekly') return '毎週';
  if (repeat.type === 'days') return `${repeat.every}日ごと`;
  return '';
}

// タイマーが動いているか
function timerActive(timer, now = new Date()) {
  if (!timer || !timer.startedAt) return false;
  return now.getTime() < new Date(timer.startedAt).getTime() + timer.durationSec * 1000;
}
