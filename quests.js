// クエスト画面: タスク一覧、追加・編集・削除、完了と取り消し

const DIFFICULTY_LABELS = { 1: '★', 2: '★★', 3: '★★★' };

// --- タスクの操作 -----------------------------------------------------

// award: { xp, baseXp, bonusXp, combo, durationSec, remainingSec }（timer.js が計算する）
function completeTask(taskId, award, now = new Date()) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.done) return null;
  const xp = award.xp;
  const before = levelInfo(state.player.xp).level;

  const log = {
    taskId,
    doneAt: now.toISOString(),
    xp,
    baseXp: award.baseXp,
    bonusXp: award.bonusXp,
    combo: award.combo,
    durationSec: award.durationSec,
    remainingSec: award.remainingSec,
    prev: { done: task.done, lastDoneAt: task.lastDoneAt, dueAt: task.dueAt },
  };
  state.logs.push(log);
  state.player.xp += xp;

  if (task.repeat.type === 'none') {
    task.done = true;
    task.lastDoneAt = log.doneAt;
  } else {
    task.lastDoneAt = log.doneAt;
    task.dueAt = nextDueDate(now, task.repeat).toISOString();
  }

  const streak = currentStreak(state.logs, now);
  if (streak > state.player.bestStreak) state.player.bestStreak = streak;
  saveState();

  const after = levelInfo(state.player.xp).level;
  return { xp, levelUp: after > before ? after : null };
}

// 当日分の完了だけ取り消せる
function undoComplete(taskId, now = new Date()) {
  const today = dateKey(now);
  for (let i = state.logs.length - 1; i >= 0; i--) {
    const log = state.logs[i];
    if (log.taskId !== taskId || dateKey(log.doneAt) !== today) continue;
    const task = state.tasks.find((t) => t.id === taskId);
    if (task && log.prev) {
      task.done = log.prev.done;
      task.lastDoneAt = log.prev.lastDoneAt;
      task.dueAt = log.prev.dueAt;
    }
    state.player.xp = Math.max(0, state.player.xp - log.xp);
    state.logs.splice(i, 1);
    saveState();
    return true;
  }
  return false;
}

// 「あとで」: 当日限りで後ろに回す
function deferTask(taskId, now = new Date()) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.deferredAt = now.toISOString();
  saveState();
}

function isDeferredToday(task, now = new Date()) {
  return !!task.deferredAt && dateKey(task.deferredAt) === dateKey(now);
}

// やることの並び順: 先送りしたものは最後（先送りが早い順）、期限切れ → 今日 → 期限なし、
// 同じなら難易度が低い順、さらに同じなら期限が早い順。先頭が「いまやる」になる
function sortFocusOrder(todoEntries, now = new Date()) {
  const rank = { overdue: 0, due: 1, todo: 2 };
  return [...todoEntries].sort((a, b) => {
    const da = isDeferredToday(a.task, now);
    const db = isDeferredToday(b.task, now);
    if (da !== db) return da ? 1 : -1;
    if (da && db) return a.task.deferredAt < b.task.deferredAt ? -1 : 1;
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.task.difficulty !== b.task.difficulty) return a.task.difficulty - b.task.difficulty;
    const ka = a.task.deadline || a.task.dueAt || '9999';
    const kb = b.task.deadline || b.task.dueAt || '9999';
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

// 「エリアごと」のときはエリアの並び順に分け、各エリア内を標準の並びにする
function orderTodo(todoEntries, now = new Date()) {
  const byArea = !ui.areaFilter && ui.sections && ui.sections.byArea;
  if (!byArea) return sortFocusOrder(todoEntries, now);
  const areas = [...state.areas].sort((a, b) => a.order - b.order);
  const out = [];
  for (const a of areas) out.push(...sortFocusOrder(todoEntries.filter((e) => e.task.areaId === a.id), now));
  // どのエリアにも属さないものがあれば最後に
  const seen = new Set(out.map((e) => e.task.id));
  out.push(...sortFocusOrder(todoEntries.filter((e) => !seen.has(e.task.id)), now));
  return out;
}

function pickFocus(todoEntries, now = new Date()) {
  if (todoEntries.length === 0) return null;
  return orderTodo(todoEntries, now)[0];
}

const ICON_PAUSE = '<svg class="icon" aria-hidden="true"><use href="#i-pause"/></svg>';
const ICON_PLAY = '<svg class="icon" aria-hidden="true"><use href="#i-play"/></svg>';

function ringHtml(offset) {
  return `<svg class="qt-ring" viewBox="0 0 130 130"><g filter="url(#wobble)">
      <circle class="qt-track" cx="65" cy="65" r="54"/>
      <circle class="qt-fill" cx="65" cy="65" r="54" stroke-dasharray="${QT_LEN.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"/>
      <circle class="qt-edge" cx="65" cy="65" r="58.5"/><circle class="qt-edge" cx="65" cy="65" r="49.5"/>
    </g></svg>`;
}

function comboBadge(combo) {
  const zero = combo <= 0;
  return `<span class="focus-combo ${zero ? 'is-zero' : ''}"><svg class="icon icon-flame ${zero ? 'icon-off' : ''}" aria-hidden="true"><use href="#i-flame"/></svg>${combo}コンボ</span>`;
}

// 「いまやる」カード。セッションの状態に応じてタイマーとボタンを出し分ける
function renderFocusCard(entry, areaName, now, remaining) {
  const s = state.session;
  const phase = sessionPhase();
  if (!entry && phase === 'idle') {
    return `<div class="focus-card is-empty">
      <div class="focus-label">いまやる</div>
      <div class="focus-empty">やることはありません。おつかれさま！ ${iconHtml('i-sparkle', 'icon icon-sparkle')}</div>
    </div>`;
  }
  const task = entry ? entry.task : null;
  const status = entry ? entry.status : 'todo';
  const inSession = phase !== 'idle' && phase !== 'summary';
  let metaTail = '';
  if (phase === 'paused') metaTail = '一時停止中';
  else if (phase === 'running' && s.timedOut) metaTail = '時間切れ';
  else if (task) metaTail = dueText(task, status, now);
  const meta = task ? [areaName, DIFFICULTY_LABELS[task.difficulty], repeatLabel(task.repeat), metaTail].filter(Boolean).join(' · ') : '';

  // リング
  let seconds = task ? (QUEST_SECONDS[task.difficulty] || QUEST_SECONDS[1]) : 0;
  let offset = 0;
  let qtCls = '';
  let slot = task ? `<button class="qt-ctl" data-qt="start" aria-label="スタート">${ICON_PLAY}</button>` : '';
  let overlay = '';
  if (phase === 'running' || phase === 'paused') {
    const rem = questRemainingSec(s);
    seconds = rem;
    offset = QT_LEN * (1 - rem / s.durationSec);
    if (s.timedOut) {
      qtCls = 'is-timeup';
      slot = '<div class="qt-timeup">時間切れ</div>';
    } else if (phase === 'paused') {
      qtCls = 'is-paused';
      slot = `<button class="qt-ctl" data-qt="resume" aria-label="再開">${ICON_PLAY}</button>`;
    } else {
      slot = `<button class="qt-ctl" data-qt="pause" aria-label="一時停止">${ICON_PAUSE}</button>`;
    }
  } else if (phase === 'countdown') {
    slot = '';
    overlay = `<div class="qt-next">
      <div class="qt-next-label">次のクエストまで</div>
      <div class="qt-next-num">${Math.max(1, countdownRemainingSec(s))}</div>
      <div class="qt-next-sub">自動でスタートします</div>
    </div>`;
  } else if (phase === 'done') {
    // 完了演出の間は、完了した時点の残り秒数とリングをそのまま見せる（戻ったように見せない）
    const lc = s.lastClear;
    if (lc && lc.durationSec) {
      seconds = lc.remainingSec;
      offset = QT_LEN * (1 - lc.remainingSec / lc.durationSec);
    }
    slot = '';
  } else if (phase === 'break' || phase === 'summary') {
    slot = '';
  }

  // ボタン
  let main;
  let sub;
  if (phase === 'idle') {
    main = `<button class="btn btn-primary qt-main is-start" data-qt="start">スタート</button>`;
    sub = `<button class="btn qt-small" data-defer="${task.id}" ${remaining <= 1 ? 'disabled' : ''}>あとで</button>`;
  } else {
    const canComplete = phase === 'running' || phase === 'paused';
    main = `<button class="btn btn-primary qt-main" data-qt="complete" ${canComplete ? '' : 'disabled'}>クエスト完了</button>`;
    sub = `<button class="btn qt-small qt-quit" data-qt="quit">× やめる</button>`;
  }

  // コンボはタイマーの右上に円で出す（2コンボ以上のときだけ）
  const comboCircle = inSession && s.combo >= 2
    ? `<div class="qt-combo"><strong>${s.combo}</strong><small>コンボ</small></div>`
    : '';
  return `<div class="focus-card ${comboCircle ? 'has-combo' : ''}" data-phase="${phase}">
    <div class="focus-title">${task ? escapeHtml(task.title) : ''}</div>
    <div class="focus-meta">${escapeHtml(meta)}</div>
    ${task && task.note && phase === 'idle' ? `<div class="focus-note">${escapeHtml(task.note)}</div>` : ''}
    <div class="qt ${qtCls}">
      <div class="qt-dial">
        ${ringHtml(offset)}
        <div class="qt-center"><div class="qt-seconds">${digitsHtml(seconds)}</div><div class="qt-slot">${slot}</div></div>
        ${overlay}
      </div>
    </div>
    <div class="qt-actions">
      ${main}
      <div class="qt-subrow">${sub}</div>
    </div>
    ${comboCircle}
  </div>`;
}

function upsertTask(data) {
  const now = new Date().toISOString();
  if (data.id) {
    const task = state.tasks.find((t) => t.id === data.id);
    if (!task) return;
    const repeatChanged = JSON.stringify(task.repeat) !== JSON.stringify(data.repeat);
    Object.assign(task, {
      title: data.title,
      areaId: data.areaId,
      difficulty: data.difficulty,
      repeat: data.repeat,
      deadline: data.deadline,
      note: data.note,
    });
    if (task.repeat.type === 'none') {
      task.dueAt = null;
    } else if (repeatChanged && task.lastDoneAt) {
      task.dueAt = nextDueDate(new Date(task.lastDoneAt), task.repeat).toISOString();
    }
  } else {
    state.tasks.push({
      id: newId('t'),
      areaId: data.areaId,
      title: data.title,
      difficulty: data.difficulty,
      repeat: data.repeat,
      note: data.note,
      deadline: data.deadline,
      deferredAt: null,
      lastDoneAt: null,
      dueAt: null,
      done: false,
      createdAt: now,
    });
    addRegisterXp();
  }
  saveState();
}

function deleteTask(taskId) {
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((t) => t.id !== taskId);
  if (state.tasks.length < before) removeRegisterXp();
  saveState();
}

// --- 一覧の描画 -------------------------------------------------------

function dueText(task, status, now) {
  if (status === 'overdue') {
    const d = daysBetween(task.deadline, now);
    return d === 0 ? '今日まで' : `${d}日遅れ`;
  }
  if (status === 'due') {
    if (!task.dueAt) return 'まだ一度も';
    const d = daysBetween(task.dueAt, now);
    return d === 0 ? '今日' : `${d}日遅れ`;
  }
  if (status === 'todo' && task.deadline) return `${formatShortDate(task.deadline)}まで`;
  if (status === 'fresh') return `次は ${formatShortDate(task.dueAt)}`;
  return '';
}

function sortDue(a, b) {
  const rank = { overdue: 0, due: 1, todo: 2 };
  if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
  const ka = a.task.deadline || a.task.dueAt || '9999';
  const kb = b.task.deadline || b.task.dueAt || '9999';
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function taskRow(entry, areaName, now, mode) {
  const { task, status } = entry;
  const meta = [areaName, DIFFICULTY_LABELS[task.difficulty], repeatLabel(task.repeat), dueText(task, status, now),
    isDeferredToday(task, now) ? 'あとで' : '']
    .filter(Boolean).join(' · ');
  let action;
  if (mode === 'undo') {
    action = `<button class="task-undo" data-undo="${task.id}">取り消す</button>`;
  } else if (mode === 'done') {
    action = '<span class="task-check is-done" aria-hidden="true">✓</span>';
  } else if (mode === 'wait') {
    action = '<span class="task-check is-wait" aria-hidden="true"></span>';
  } else {
    action = '<span class="task-check is-todo" aria-hidden="true"></span>';
  }
  return `<li class="task-row" data-status="${status}">
    ${action}
    <button class="task-body" data-edit="${task.id}">
      <span class="task-title">${escapeHtml(task.title)}</span>
      <span class="task-meta">${escapeHtml(meta)}</span>
    </button>
  </li>`;
}

function renderQuests() {
  const now = new Date();
  const today = dateKey(now);
  const areaName = Object.fromEntries(state.areas.map((a) => [a.id, a.name]));

  // エリア絞り込みチップ
  const chips = document.getElementById('area-chips');
  const areas = [...state.areas].sort((a, b) => a.order - b.order);
  const byArea = !ui.areaFilter && ui.sections.byArea;
  chips.innerHTML = [
    `<button class="chip ${!ui.areaFilter && !byArea ? 'is-active' : ''}" data-area="">すべて</button>`,
    `<button class="chip ${byArea ? 'is-active' : ''}" data-mode="area">エリアごと</button>`,
  ]
    .concat(areas.map((a) => `<button class="chip ${ui.areaFilter === a.id ? 'is-active' : ''}" data-area="${a.id}">${escapeHtml(a.name)}</button>`))
    .join('');

  const tasks = state.tasks.filter((t) => !ui.areaFilter || t.areaId === ui.areaFilter);
  const doneTodayIds = new Set(state.logs.filter((l) => dateKey(l.doneAt) === today).map((l) => l.taskId));

  const entries = tasks.map((task) => ({ task, status: taskStatus(task, now) }));
  const todo = entries.filter((e) => ['overdue', 'due', 'todo'].includes(e.status)).sort(sortDue);
  const doneToday = entries.filter((e) => doneTodayIds.has(e.task.id));
  const waiting = entries.filter((e) => e.status === 'fresh' && !doneTodayIds.has(e.task.id))
    .sort((a, b) => (a.task.dueAt < b.task.dueAt ? -1 : 1));
  const finished = entries.filter((e) => e.status === 'done' && !doneTodayIds.has(e.task.id));

  const row = (mode) => (e) => taskRow(e, areaName[e.task.areaId] || '', now, mode);
  let html = '';

  // いまやる1つ。セッション中はセッションが持っているクエスト
  let focus = pickFocus(todo, now);
  if (state.session && state.session.taskId && state.session.phase !== 'summary') {
    const st = state.tasks.find((t) => t.id === state.session.taskId);
    if (st) focus = { task: st, status: taskStatus(st, now) };
  }
  const focusHtml = renderFocusCard(focus, focus ? areaName[focus.task.areaId] || '' : '', now, todo.length);
  document.getElementById('focus-quests').innerHTML = focusHtml;
  document.getElementById('add-task-btn').hidden = sessionActive();

  // 「ほかのやること」は「いまやる」と同じ規則で並べる（上から順に次に来る）
  const others = orderTodo(todo.filter((e) => !focus || e.task.id !== focus.task.id), now);
  if (others.length) {
    let body;
    if (byArea) {
      // エリアごとに分けて、エリアの並び順で見出しを付ける。各エリア内は標準の並び
      body = areas.map((a) => {
        const list = others.filter((e) => e.task.areaId === a.id);
        if (!list.length) return '';
        return `<h3 class="quest-subheading">${escapeHtml(a.name)} <span class="count">${list.length}</span></h3>
          <ul class="task-list">${list.map(row('todo')).join('')}</ul>`;
      }).join('');
    } else {
      body = `<ul class="task-list">${others.map(row('todo')).join('')}</ul>`;
    }
    html += `<details class="quest-section quest-details" data-section="todo" ${ui.sections.todo ? 'open' : ''}>
      <summary class="quest-heading">ほかのやること <span class="count">${others.length}</span></summary>
      ${body}
    </details>`;
  }

  if (doneToday.length) {
    html += `<details class="quest-section quest-details" data-section="done" ${ui.sections.done ? 'open' : ''}>
      <summary class="quest-heading">今日やった <span class="count">${doneToday.length}</span></summary>
      <ul class="task-list">${doneToday.map(row('undo')).join('')}</ul>
    </details>`;
  }
  if (waiting.length) {
    html += `<details class="quest-section quest-details">
      <summary class="quest-heading">次回待ち <span class="count">${waiting.length}</span></summary>
      <ul class="task-list">${waiting.map(row('wait')).join('')}</ul>
    </details>`;
  }
  if (finished.length) {
    html += `<details class="quest-section quest-details">
      <summary class="quest-heading">達成済み <span class="count">${finished.length}</span></summary>
      <ul class="task-list">${finished.map(row('done')).join('')}</ul>
    </details>`;
  }
  if (state.tasks.length === 0) {
    html = '<p class="quest-empty">右下の「＋」から最初のクエストを登録しましょう。</p>';
  }
  document.getElementById('quest-list').innerHTML = html;
  // 折りたたみの開閉を覚える
  document.querySelectorAll('#quest-list details[data-section]').forEach((details) => {
    details.addEventListener('toggle', () => {
      ui.sections[details.dataset.section] = details.open;
      saveSections();
    });
  });
}

// --- 追加・編集シート -------------------------------------------------

function openTaskSheet(taskId = null) {
  const form = document.getElementById('task-form');
  const task = taskId ? state.tasks.find((t) => t.id === taskId) : null;
  const areas = [...state.areas].sort((a, b) => a.order - b.order);

  form.elements.id.value = task ? task.id : '';
  form.elements.title.value = task ? task.title : '';
  form.elements.areaId.innerHTML = areas.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join('');
  form.elements.areaId.value = task ? task.areaId : (ui.areaFilter || (areas[0] && areas[0].id) || '');
  form.elements.difficulty.value = task ? String(task.difficulty) : '1';
  form.elements.repeatType.value = task ? task.repeat.type : 'none';
  form.elements.repeatEvery.value = task && task.repeat.type === 'days' ? task.repeat.every : 3;
  form.elements.deadline.value = task && task.deadline ? dateKey(task.deadline) : '';
  form.elements.note.value = task ? task.note : '';
  document.getElementById('task-sheet-title').textContent = task ? 'クエストを編集' : 'クエストを追加';
  document.getElementById('task-delete').hidden = !task;
  updateTaskFormVisibility();
  document.getElementById('task-sheet').hidden = false;
  setTimeout(() => form.elements.title.focus(), 50);
}

function closeTaskSheet() {
  document.getElementById('task-sheet').hidden = true;
}

function updateTaskFormVisibility() {
  const form = document.getElementById('task-form');
  const type = form.elements.repeatType.value;
  document.getElementById('repeat-every-wrap').hidden = type !== 'days';
  document.getElementById('deadline-wrap').hidden = type !== 'none';
}

function readTaskForm() {
  const form = document.getElementById('task-form');
  const type = form.elements.repeatType.value;
  const repeat = type === 'days'
    ? { type, every: Math.max(1, parseInt(form.elements.repeatEvery.value, 10) || 1) }
    : { type };
  const deadlineValue = form.elements.deadline.value;
  let deadline = null;
  if (type === 'none' && deadlineValue) {
    // 期限日の 23:59:59 を期限にする
    const d = new Date(`${deadlineValue}T23:59:59`);
    if (!Number.isNaN(d.getTime())) deadline = d.toISOString();
  }
  return {
    id: form.elements.id.value || null,
    title: form.elements.title.value.trim(),
    areaId: form.elements.areaId.value,
    difficulty: parseInt(form.elements.difficulty.value, 10) || 1,
    repeat,
    deadline,
    note: form.elements.note.value.trim(),
  };
}

// --- トースト ---------------------------------------------------------

let toastTimer = null;
function showToast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 1800);
}

// --- イベント ---------------------------------------------------------

function initQuests() {
  document.getElementById('area-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    if (chip.dataset.mode === 'area') {
      ui.areaFilter = null;
      ui.sections.byArea = true;
    } else {
      ui.areaFilter = chip.dataset.area || null;
      if (!ui.areaFilter) ui.sections.byArea = false;
    }
    saveSections();
    renderQuests();
  });

  const handleTaskAction = (e) => {
    const qt = e.target.closest('[data-qt]');
    if (qt) {
      const action = qt.dataset.qt;
      if (action === 'start') {
        const card = qt.closest('.focus-card');
        const focus = card && card.dataset.phase === 'idle' ? pickNextQuest() : null;
        if (focus) startSession(focus.id);
      } else if (action === 'pause') pauseQuest();
      else if (action === 'resume') resumeQuest();
      else if (action === 'complete') completeQuest();
      else if (action === 'quit') quitSession();
      return;
    }
    const defer = e.target.closest('[data-defer]');
    if (defer) {
      if (sessionActive()) return;
      deferTask(defer.dataset.defer);
      render();
      return;
    }
    const undo = e.target.closest('[data-undo]');
    if (undo) {
      if (undoComplete(undo.dataset.undo)) {
        showToast('取り消しました');
        render();
      }
      return;
    }
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      if (sessionActive()) { showToast('セッション中は編集できません'); return; }
      openTaskSheet(edit.dataset.edit);
    }
  };
  document.getElementById('quest-list').addEventListener('click', handleTaskAction);
  document.getElementById('focus-quests').addEventListener('click', handleTaskAction);

  document.getElementById('add-task-btn').addEventListener('click', () => { if (!sessionActive()) openTaskSheet(); });

  const sheet = document.getElementById('task-sheet');
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeTaskSheet(); });
  document.getElementById('task-cancel').addEventListener('click', closeTaskSheet);

  const form = document.getElementById('task-form');
  form.elements.repeatType.addEventListener('change', updateTaskFormVisibility);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readTaskForm();
    if (!data.title) { form.elements.title.focus(); return; }
    if (!data.areaId) { showToast('先に設定でエリアを作ってください'); return; }
    const isNew = !data.id;
    const saveBtn = form.querySelector('button[type="submit"]');
    const at = centerOf(saveBtn);
    upsertTask(data);
    closeTaskSheet();
    render();
    if (isNew) {
      floatText(at.x, at.y, `+${ADD_XP} XP`, false, true);
      setTimeout(pulseXpBar, 250);
    }
  });

  document.getElementById('task-delete').addEventListener('click', () => {
    const id = form.elements.id.value;
    if (!id) return;
    if (!confirm('このクエストを削除しますか？')) return;
    const at = centerOf(document.getElementById('task-delete'));
    const before = state.player.xp;
    deleteTask(id);
    closeTaskSheet();
    render();
    if (state.player.xp < before) floatText(at.x, at.y, `-${ADD_XP} XP`, false, true);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) closeTaskSheet();
  });
}
