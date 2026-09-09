// クエスト画面: タスク一覧、追加・編集・削除、完了と取り消し

const DIFFICULTY_LABELS = { 1: '★', 2: '★★', 3: '★★★' };

// --- タスクの操作 -----------------------------------------------------

function completeTask(taskId, now = new Date()) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || task.done) return null;
  const inTimer = timerActive(state.timer, now);
  const xp = xpForTask(task, inTimer);
  const before = levelInfo(state.player.xp).level;

  const log = {
    taskId,
    doneAt: now.toISOString(),
    xp,
    inTimer,
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
  return { xp, inTimer, levelUp: after > before ? after : null };
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

// いまやる1つを選ぶ。先送りしたものは最後に回し、その中では先送りが早い順
function pickFocus(todoEntries, now = new Date()) {
  if (todoEntries.length === 0) return null;
  const rank = { overdue: 0, due: 1, todo: 2 };
  const sorted = [...todoEntries].sort((a, b) => {
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
  return sorted[0];
}

function renderFocusCard(entry, areaName, now, remaining) {
  if (!entry) {
    return `<div class="focus-card is-empty">
      <div class="focus-label">いまやる</div>
      <div class="focus-empty">やることはありません。おつかれさま！ ${iconHtml('i-sparkle', 'icon icon-sparkle')}</div>
    </div>`;
  }
  const { task, status } = entry;
  const meta = [areaName, DIFFICULTY_LABELS[task.difficulty], repeatLabel(task.repeat), dueText(task, status, now)]
    .filter(Boolean).join(' · ');
  return `<div class="focus-card" data-status="${status}">
    <div class="focus-head">
      <span class="focus-label">いまやる</span>
      <span class="focus-remaining">あと ${remaining} 件</span>
    </div>
    <div class="focus-title">${escapeHtml(task.title)}</div>
    <div class="focus-meta">${escapeHtml(meta)}</div>
    ${task.note ? `<div class="focus-note">${escapeHtml(task.note)}</div>` : ''}
    <div class="focus-actions">
      <button class="btn focus-defer" data-defer="${task.id}" ${remaining <= 1 ? 'disabled' : ''}>あとで</button>
      <button class="btn btn-primary focus-done" data-complete="${task.id}">完了！</button>
    </div>
  </div>`;
}

// 登録ボーナス: 追加で +1 XP、削除で -1 XP（そのレベルの開始値より下には減らない）
const ADD_XP = 1;

function addRegisterXp() {
  state.player.xp += ADD_XP;
}

function removeRegisterXp(count = 1) {
  const info = levelInfo(state.player.xp);
  const floor = state.player.xp - info.xpInLevel;
  state.player.xp = Math.max(0, floor, state.player.xp - ADD_XP * count);
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
    action = `<button class="task-check" data-complete="${task.id}" aria-label="完了にする"></button>`;
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
  chips.innerHTML = [`<button class="chip ${ui.areaFilter ? '' : 'is-active'}" data-area="">すべて</button>`]
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

  // いまやる1つ
  const focus = pickFocus(todo, now);
  const focusHtml = renderFocusCard(focus, focus ? areaName[focus.task.areaId] || '' : '', now, todo.length);
  document.getElementById('focus-quests').innerHTML = focusHtml;
  document.getElementById('focus-timer').innerHTML = focusHtml;

  const others = todo.filter((e) => e !== focus)
    .sort((a, b) => {
      const da = isDeferredToday(a.task, now);
      const db = isDeferredToday(b.task, now);
      if (da !== db) return da ? 1 : -1;
      return sortDue(a, b);
    });
  if (others.length) {
    html += `<details class="quest-section quest-details" id="todo-details" ${ui.todoOpen ? 'open' : ''}>
      <summary class="quest-heading">ほかのやること <span class="count">${others.length}</span></summary>
      <ul class="task-list">${others.map(row('todo')).join('')}</ul>
    </details>`;
  }

  if (doneToday.length) {
    html += `<section class="quest-section">
      <h2 class="quest-heading">今日やった <span class="count">${doneToday.length}</span></h2>
      <ul class="task-list">${doneToday.map(row('undo')).join('')}</ul>
    </section>`;
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
  const details = document.getElementById('todo-details');
  if (details) details.addEventListener('toggle', () => { ui.todoOpen = details.open; });
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
    ui.areaFilter = chip.dataset.area || null;
    renderQuests();
  });

  const handleTaskAction = (e) => {
    const complete = e.target.closest('[data-complete]');
    if (complete) {
      const result = completeTask(complete.dataset.complete);
      if (result) {
        complete.classList.add('is-popping');
        celebrateComplete(complete, result.xp, result.inTimer);
        setTimeout(() => {
          render();
          if (result.levelUp) celebrateLevelUp(result.levelUp);
        }, result.levelUp ? 500 : 300);
      }
      return;
    }
    const defer = e.target.closest('[data-defer]');
    if (defer) {
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
    if (edit) openTaskSheet(edit.dataset.edit);
  };
  document.getElementById('quest-list').addEventListener('click', handleTaskAction);
  document.getElementById('focus-quests').addEventListener('click', handleTaskAction);
  document.getElementById('focus-timer').addEventListener('click', handleTaskAction);

  document.getElementById('add-task-btn').addEventListener('click', () => openTaskSheet());

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
