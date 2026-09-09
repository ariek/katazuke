// 片付けタイマー: 開始時刻と長さを保存し、差分で残り時間を計算する

const TIMER_PRESETS = [5, 10, 15, 25];
let timerInterval = null;
let audioCtx = null;

function timerEndAt(timer) {
  return new Date(timer.startedAt).getTime() + timer.durationSec * 1000;
}

function timerRemainingSec(timer, now = new Date()) {
  return Math.max(0, Math.ceil((timerEndAt(timer) - now.getTime()) / 1000));
}

// タイマー中に達成したタスクの集計
function timerSessionStats(startedAt, endAt) {
  const from = new Date(startedAt).getTime();
  const to = endAt ? new Date(endAt).getTime() : Infinity;
  const logs = state.logs.filter((l) => {
    const t = new Date(l.doneAt).getTime();
    return l.inTimer && t >= from && t <= to;
  });
  return { count: logs.length, xp: logs.reduce((sum, l) => sum + l.xp, 0) };
}

function startTimer(minutes) {
  // 音は操作直後にしか鳴らせないので、開始時に用意しておく
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (err) { audioCtx = null; }

  state.timer = { startedAt: new Date().toISOString(), durationSec: minutes * 60, lastResult: state.timer.lastResult || null };
  saveState();
  ensureTimerLoop();
  renderTimer();
  renderTimerMini();
}

function stopTimer() {
  if (!state.timer.startedAt) return;
  const stats = timerSessionStats(state.timer.startedAt, new Date().toISOString());
  const elapsedSec = Math.min(state.timer.durationSec, Math.round((Date.now() - new Date(state.timer.startedAt).getTime()) / 1000));
  state.timer = { startedAt: null, durationSec: 0, lastResult: { durationSec: elapsedSec, finished: false, ...stats } };
  saveState();
  stopTimerLoop();
  renderTimer();
  renderTimerMini();
}

function finishTimer(silent = false) {
  if (!state.timer.startedAt) return;
  const endAt = new Date(timerEndAt(state.timer)).toISOString();
  const stats = timerSessionStats(state.timer.startedAt, endAt);
  state.timer = { startedAt: null, durationSec: 0, lastResult: { durationSec: state.timer.durationSec, finished: true, ...stats } };
  saveState();
  stopTimerLoop();
  renderTimer();
  renderTimerMini();
  if (!silent) {
    playFinishSound();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
    showToast('タイマー終了！おつかれさま', 'is-levelup');
  }
}

function ensureTimerLoop() {
  if (timerInterval) return;
  timerInterval = setInterval(tickTimer, 1000);
}

function stopTimerLoop() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function tickTimer() {
  if (!state.timer.startedAt) { stopTimerLoop(); return; }
  if (Date.now() >= timerEndAt(state.timer)) {
    finishTimer();
    return;
  }
  renderTimer();
  renderTimerMini();
}

function playFinishSound() {
  if (!audioCtx) return;
  try {
    const notes = [660, 880, 1100];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = audioCtx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch (err) { /* 鳴らせなくても続行 */ }
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- 描画 -------------------------------------------------------------

const RING_R = 50;
const RING_LEN = 2 * Math.PI * RING_R;

function renderTimer() {
  const timer = state.timer;
  const running = timerActive(timer);
  const remaining = running ? timerRemainingSec(timer) : 0;
  const ratio = running ? remaining / timer.durationSec : 1;

  document.getElementById('timer-ring-fill').style.strokeDashoffset = String(RING_LEN * (1 - ratio));
  document.getElementById('timer-clock').textContent = running ? formatClock(remaining) : '--:--';
  document.getElementById('timer-caption').textContent = running
    ? `${Math.round(timer.durationSec / 60)}分の片付け中 · 完了は 1.5 倍`
    : '時間を決めて、その間だけ片付ける';

  document.getElementById('timer-presets').hidden = running;
  document.getElementById('timer-stop').hidden = !running;

  const session = document.getElementById('timer-session');
  if (running) {
    const stats = timerSessionStats(timer.startedAt, null);
    session.hidden = false;
    session.textContent = stats.count > 0
      ? `このセッションで ${stats.count} 件達成 · +${stats.xp} XP`
      : 'クエストを完了するとここに出ます';
  } else if (timer.lastResult) {
    const r = timer.lastResult;
    session.hidden = false;
    session.textContent = `${r.finished ? '前回' : '前回（途中終了）'}: ${Math.round(r.durationSec / 60)}分で ${r.count} 件達成 · +${r.xp} XP`;
  } else {
    session.hidden = true;
  }
  document.getElementById('timer-ring').classList.toggle('is-running', running);
}

// タイマー画面以外に出す残り時間
function renderTimerMini() {
  const el = document.getElementById('timer-mini');
  const running = timerActive(state.timer);
  el.hidden = !running || ui.tab === 'timer';
  if (running) el.innerHTML = `${iconHtml('i-timer', 'icon icon-timer')} 残り ${formatClock(timerRemainingSec(state.timer))} · タイマー中は完了が 1.5 倍`;
}

function initTimer() {
  const presets = document.getElementById('timer-presets');
  presets.innerHTML = TIMER_PRESETS.map((m) => `<button class="preset" data-minutes="${m}">${m}<small>分</small></button>`).join('');
  presets.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-minutes]');
    if (btn) startTimer(parseInt(btn.dataset.minutes, 10));
  });
  document.getElementById('timer-stop').addEventListener('click', () => {
    if (confirm('タイマーをやめますか？')) stopTimer();
  });
  document.getElementById('timer-mini').addEventListener('click', () => switchTab('timer'));

  // 起動時に期限が過ぎていたら静かに終了扱いにする
  if (state.timer.startedAt && Date.now() >= timerEndAt(state.timer)) finishTimer(true);
  if (timerActive(state.timer)) ensureTimerLoop();
  renderTimer();
  renderTimerMini();
}
