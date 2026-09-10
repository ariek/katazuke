// クエストのタイマーとセッション（SPEC 7章）
// 状態は state.session に持ち、時刻の差分で進める。画面を閉じても進む

const DONE_HOLD_MS = 2100;     // 完了演出で数字の動きが終わってから閉じるまで
const DONE_LAST_EXTRA_MS = 1000; // 最後のクエストのときはさらに長く見せる
const COUNTDOWN_SEC = 5;       // 次のクエストまでの待ち
const BREAK_SEC = 300;         // 休憩
const CYCLE_SEC = 25 * 60;     // 休憩までの区切り
const IDLE_END_MIN = 30;       // これ以上放置したらセッションを終える

let sessionLoop = null;
let audioCtx = null;
let lastCountdownBeep = 0; // 3・2・1 の音を1回ずつ鳴らすため

const nowIso = () => new Date().toISOString();
const secondsSince = (iso) => (Date.now() - new Date(iso).getTime()) / 1000;

function sessionActive() {
  return !!state.session;
}

function sessionPhase() {
  return state.session ? state.session.phase : 'idle';
}

// 残り秒数（整数、0未満にはしない）
function questRemainingSec(session = state.session) {
  if (!session || !session.timerStartedAt) return 0;
  const pausedNow = session.pausedAt ? secondsSince(session.pausedAt) : 0;
  const elapsed = secondsSince(session.timerStartedAt) - session.pausedTotalSec - pausedNow;
  return Math.max(0, Math.ceil(session.durationSec - elapsed));
}

function breakRemainingSec(session = state.session) {
  return Math.max(0, Math.ceil(BREAK_SEC - secondsSince(session.phaseStartedAt)));
}

function countdownRemainingSec(session = state.session) {
  return Math.max(0, Math.ceil(COUNTDOWN_SEC - secondsSince(session.phaseStartedAt)));
}

function touchSession() {
  if (state.session) state.session.lastActionAt = nowIso();
}

// --- 開始 / 一時停止 / 再開 ------------------------------------------

function ensureAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (err) { audioCtx = null; }
}

function startSession(taskId) {
  if (state.session) return;
  ensureAudio();
  const now = nowIso();
  state.session = {
    startedAt: now,
    cycleStartedAt: now,
    lastActionAt: now,
    phase: 'running',
    phaseStartedAt: now,
    taskId: null,
    durationSec: 0,
    timerStartedAt: null,
    pausedTotalSec: 0,
    pausedAt: null,
    pausedFlag: false,
    timedOut: false,
    combo: 0,
    maxCombo: 0,
    completed: 0,
    xp: 0,
    lastClear: null,
    summary: null,
  };
  // 最初も5秒のカウントダウン（3・2・1の音つき）を経てからスタートする
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) { state.session = null; return; }
  state.session.taskId = taskId;
  state.session.durationSec = QUEST_SECONDS[task.difficulty] || QUEST_SECONDS[1];
  state.session.phase = 'countdown';
  state.session.phaseStartedAt = now;
  lastCountdownBeep = 0;
  saveState();
  ensureSessionLoop();
  render();
}

function beginQuest(taskId) {
  const s = state.session;
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) { endSession('empty'); return; }
  const now = nowIso();
  Object.assign(s, {
    phase: 'running',
    phaseStartedAt: now,
    taskId,
    durationSec: QUEST_SECONDS[task.difficulty] || QUEST_SECONDS[1],
    timerStartedAt: now,
    pausedTotalSec: 0,
    pausedAt: null,
    pausedFlag: false,
    timedOut: false,
    lastActionAt: now,
  });
  saveState();
  ensureSessionLoop();
  playTone([880], 0, 0.6);
  render();
}

function pauseQuest() {
  const s = state.session;
  if (!s || s.phase !== 'running' || s.timedOut) return;
  s.phase = 'paused';
  s.pausedAt = nowIso();
  s.pausedFlag = true; // 記録用。ボーナスとコンボには影響しない
  touchSession();
  saveState();
  render();
}

function resumeQuest() {
  const s = state.session;
  if (!s || s.phase !== 'paused') return;
  s.pausedTotalSec += secondsSince(s.pausedAt);
  s.pausedAt = null;
  s.phase = 'running';
  touchSession();
  saveState();
  render();
}

// --- 完了 --------------------------------------------------------------

function completeQuest() {
  const s = state.session;
  if (!s || (s.phase !== 'running' && s.phase !== 'paused')) return;
  const task = state.tasks.find((t) => t.id === s.taskId);
  if (!task) { endSession('empty'); return; }

  // 一時停止してもボーナスとコンボは続く。時間切れだけが途切れる条件
  const remaining = s.timedOut ? 0 : questRemainingSec(s);
  const eligible = !s.timedOut && remaining > 0;
  const combo = eligible ? s.combo + 1 : 0;
  const baseXp = baseXpForTask(task);
  const bonusXp = eligible ? timerBonus(remaining, combo) : 0;
  const before = levelInfo(state.player.xp).level;

  completeTask(task.id, { xp: baseXp + bonusXp, baseXp, bonusXp, combo, durationSec: s.durationSec, remainingSec: remaining });

  const after = levelInfo(state.player.xp).level;
  s.combo = combo;
  s.maxCombo = Math.max(s.maxCombo, combo);
  s.completed += 1;
  s.xp += baseXp + bonusXp;
  s.lastClear = {
    title: task.title,
    difficulty: task.difficulty,
    baseXp,
    bonusXp,
    combo,
    remainingSec: remaining,
    durationSec: s.durationSec,
    multiplier: comboMultiplier(combo),
    levelUp: after > before ? after : null,
    title2: titleForLevel(after),
  };
  s.phase = 'done';
  s.phaseStartedAt = nowIso();
  s.timerStartedAt = null;
  s.isLast = !pickNextQuest(); // 次のクエストがなければ最後
  // 演出の行数で長さが変わるので、動きが終わってからの静止時間をそろえる
  s.doneMs = clearAnimationMs(s.lastClear) + DONE_HOLD_MS + (s.isLast ? DONE_LAST_EXTRA_MS : 0);
  touchSession();
  saveState();
  render();
  showClearModal(s.lastClear);
}

// 完了演出のあと: 休憩か、次のクエストか、終了か
function afterDone() {
  const s = state.session;
  if (!s) return;
  hideClearModal();
  if (secondsSince(s.cycleStartedAt) > CYCLE_SEC) {
    startBreak();
  } else {
    nextOrEnd();
  }
}

function startBreak() {
  const s = state.session;
  s.phase = 'break';
  s.phaseStartedAt = nowIso();
  saveState();
  render();
}

function endBreak() {
  const s = state.session;
  if (!s || s.phase !== 'break') return;
  s.cycleStartedAt = nowIso();
  touchSession();
  playTone([660, 880], 0.15);
  nextOrEnd();
}

function nextOrEnd() {
  const s = state.session;
  const next = pickNextQuest();
  if (!next) { endSession('empty'); return; }
  s.taskId = next.id;
  s.durationSec = QUEST_SECONDS[next.difficulty] || QUEST_SECONDS[1];
  s.phase = 'countdown';
  s.phaseStartedAt = nowIso();
  s.timerStartedAt = null;
  saveState();
  render();
}

function pickNextQuest() {
  const now = new Date();
  const tasks = state.tasks.filter((t) => !ui.areaFilter || t.areaId === ui.areaFilter);
  const entries = tasks.map((task) => ({ task, status: taskStatus(task, now) }))
    .filter((e) => ['overdue', 'due', 'todo'].includes(e.status));
  const focus = pickFocus(entries, now);
  return focus ? focus.task : null;
}

// --- 終了 --------------------------------------------------------------

async function quitSession() {
  if (!state.session) return;
  if (!(await askConfirm('セッションをやめますか？ 走っているクエストは未完了のまま残ります。', { ok: 'やめる', cancel: '続ける', danger: true }))) return;
  if (!state.session) return; // 待っている間に終わっていたら何もしない
  endSession('quit');
}

function endSession(reason) {
  const s = state.session;
  if (!s) return;
  hideClearModal();
  const endedAt = nowIso();
  const record = {
    startedAt: s.startedAt,
    endedAt,
    completed: s.completed,
    xp: s.xp,
    maxCombo: s.maxCombo,
    durationSec: Math.round(secondsSince(s.startedAt)),
  };
  if (s.completed > 0) state.sessions.push(record);
  const ranked = [...state.sessions].sort((a, b) => b.xp - a.xp);
  const rank = s.completed > 0 ? ranked.findIndex((r) => r === record) + 1 : 0;
  s.phase = 'summary';
  s.phaseStartedAt = endedAt;
  s.timerStartedAt = null;
  s.summary = { ...record, rank, reason };
  saveState();
  render();
}

function closeSummary() {
  state.session = null;
  stopSessionLoop();
  saveState();
  render();
}

// --- ループ ------------------------------------------------------------

function ensureSessionLoop() {
  if (sessionLoop) return;
  sessionLoop = setInterval(tickSession, 250);
}

function stopSessionLoop() {
  clearInterval(sessionLoop);
  sessionLoop = null;
}

function tickSession() {
  const s = state.session;
  if (!s) { stopSessionLoop(); return; }
  switch (s.phase) {
    case 'running':
      if (!s.timedOut && questRemainingSec(s) <= 0) {
        s.timedOut = true;
        s.combo = 0;
        saveState();
        playTone([660, 520, 400], 0.25);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        render();
      }
      break;
    case 'done':
      if (secondsSince(s.phaseStartedAt) * 1000 >= (s.doneMs || 5200)) afterDone();
      break;
    case 'break':
      if (breakRemainingSec(s) <= 0) endBreak();
      break;
    case 'countdown': {
      const left = countdownRemainingSec(s);
      // カーレースのスタートのように、3・2・1 で短い低い音、スタートで長い高い音
      if (left >= 1 && left <= 3 && left !== lastCountdownBeep) {
        lastCountdownBeep = left;
        playTone([440], 0, 0.18);
      }
      if (left <= 0) { lastCountdownBeep = 0; beginQuest(s.taskId); }
      break;
    }
    default:
      break;
  }
  renderTimerTick();
}

// 起動時: 放置が長ければ終了、そうでなければ続きから
function initSession() {
  const s = state.session;
  if (!s) return;
  if (s.phase === 'summary') return; // まとめを表示したまま閉じていた
  if (secondsSince(s.lastActionAt) > IDLE_END_MIN * 60) {
    endSession('idle');
    return;
  }
  if (s.phase === 'done') { s.phase = 'countdown'; s.phaseStartedAt = nowIso(); }
  if (s.phase === 'countdown') {
    // 待ちの間に閉じていたら、開いた時点から数え直す
    s.phaseStartedAt = nowIso();
  }
  if (s.phase === 'running' && !s.timedOut && questRemainingSec(s) <= 0) { s.timedOut = true; s.combo = 0; }
  saveState();
  ensureSessionLoop();
}

// --- 音 ----------------------------------------------------------------

// freqs: 鳴らす周波数の並び、gap: 音と音の間隔（秒）、length: 1音の長さ（秒）
function playTone(freqs, gap, length = 0.3) {
  if (!audioCtx) return;
  try {
    freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = audioCtx.currentTime + i * gap;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
      gain.gain.setValueAtTime(0.22, t + Math.max(0.02, length - 0.08));
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + length + 0.05);
    });
  } catch (err) { /* 鳴らせなくても続行 */ }
}

// --- 描画（秒数だけの更新）------------------------------------------------

const QT_LEN = 2 * Math.PI * 54;

// 数字を1桁ずつ同じ幅の枠に入れて等幅に見せる（フォントが等幅数字に対応していないため）
function digitsHtml(n) {
  return String(n).split('').map((d) => `<span>${d}</span>`).join('');
}

function renderTimerTick() {
  const s = state.session;
  const secEl = document.querySelector('#focus-quests .qt-seconds');
  const fillEl = document.querySelector('#focus-quests .qt-fill');
  if (s && secEl && fillEl) {
    if (s.phase === 'running' || s.phase === 'paused') {
      const remaining = questRemainingSec(s);
      secEl.innerHTML = digitsHtml(remaining);
      fillEl.style.strokeDashoffset = String(QT_LEN * (1 - remaining / s.durationSec));
    } else if (s.phase === 'countdown') {
      const cd = document.querySelector('#focus-quests .qt-next-num');
      if (cd) cd.textContent = String(Math.max(1, countdownRemainingSec(s)));
    }
  }
  if (s && s.phase === 'break') {
    const remaining = breakRemainingSec(s);
    const el = document.getElementById('break-seconds');
    const fill = document.querySelector('#break-modal .qt-fill');
    if (el) el.innerHTML = digitsHtml(remaining);
    if (fill) fill.style.strokeDashoffset = String(QT_LEN * (1 - remaining / BREAK_SEC));
  }
  renderTimerMini();
}

// ヘッダーの残り秒数
function renderTimerMini() {
  const el = document.getElementById('timer-mini');
  const s = state.session;
  const show = s && (s.phase === 'running' || s.phase === 'paused') && ui.tab !== 'quests';
  el.hidden = !show;
  if (show) {
    el.innerHTML = `${iconHtml('i-timer', 'icon icon-timer')} 残り ${questRemainingSec(s)} 秒${s.phase === 'paused' ? '（一時停止中）' : ''}`;
  }
}

function initTimer() {
  document.getElementById('timer-mini').addEventListener('click', () => switchTab('quests'));
  document.getElementById('break-end').addEventListener('click', endBreak);
  document.getElementById('summary-close').addEventListener('click', closeSummary);
  initSession();
}
