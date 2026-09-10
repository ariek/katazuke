// クエストの一括追加: 貼り付けた文字列を解釈し、内訳を出してから登録する

const BULK_DEFAULT_AREA = 'どこでも';
const BULK_TITLE_MAX = 60;
const BULK_NOTE_MAX = 200;

// 行頭の箇条書き記号を外す
const BULLET_RE = /^(?:[-*・•□■◇◆○●]|\[\s?[xX ]?\]|\d+[.．)）]|[①-⑳])\s*/;
const SEPARATOR_RE = /[：:\t]/;

function bulkTrim(str) {
  return str.replace(/^[\s　]+|[\s　]+$/g, '');
}

// 難易度: 1〜3、★〜★★★、☆〜☆☆☆（全角数字も可）。読めなければ null
function parseDifficulty(str) {
  const t = bulkTrim(str).replace(/[１２３]/g, (c) => String('１２３'.indexOf(c) + 1));
  if (/^[1-3]$/.test(t)) return Number(t);
  if (/^[★☆]{1,3}$/.test(t)) return t.length;
  return null;
}

function looksLikeDifficulty(str) {
  return parseDifficulty(str) !== null;
}

// 期限: 2026/9/20、9/20、2026-09-20、9月20日、今日、明日、明後日。その日の 23:59:59 を返す。読めなければ null
function parseDeadline(str, now = new Date()) {
  const t = bulkTrim(str).replace(/[０-９]/g, (c) => String('０１２３４５６７８９'.indexOf(c)));
  const endOfDay = (y, m, d) => {
    const dt = new Date(y, m - 1, d, 23, 59, 59);
    return dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
  };
  const rel = { '今日': 0, '明日': 1, '明後日': 2, 'きょう': 0, 'あした': 1, 'あさって': 2 };
  if (rel[t] !== undefined) {
    const d = addDays(now, rel[t]);
    return endOfDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  let m = t.match(/^(\d{4})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?$/);
  if (m) return endOfDay(Number(m[1]), Number(m[2]), Number(m[3]));
  m = t.match(/^(\d{1,2})[\/\-月](\d{1,2})日?$/);
  if (m) {
    const month = Number(m[1]); const day = Number(m[2]);
    let dt = endOfDay(now.getFullYear(), month, day);
    if (!dt) return null;
    // 年なしは今日以降で直近のその日付
    if (dt < startOfDay(now)) dt = endOfDay(now.getFullYear() + 1, month, day);
    return dt;
  }
  return null;
}

// 文字列を解釈して「登録の計画」を返す。まだ状態は変えない
function parseBulkText(text, areas, tasks) {
  const areaByName = new Map(sortedAreas().map((a) => [a.name, a]));
  const firstKind = sortedAreas()[0] ? sortedAreas()[0].kind : 'shelf';
  const existingTitles = new Set(tasks.filter((t) => !t.done).map((t) => `${t.areaId}\n${t.title}`));
  const newAreas = []; // { name, kind }
  const entries = []; // { areaName, areaId|null, title, deadline, difficulty }
  const skipped = { empty: 0, badDeadline: 0, badDifficulty: 0, duplicate: 0 };
  let truncated = 0;
  const seen = new Set();
  const now = new Date();

  const resolveArea = (name) => {
    const found = areaByName.get(name);
    if (found) return { id: found.id, name: found.name };
    let pending = newAreas.find((a) => a.name === name);
    if (!pending) {
      pending = { name, kind: name === BULK_DEFAULT_AREA ? 'house' : firstKind };
      newAreas.push(pending);
    }
    return { id: null, name };
  };

  for (const rawLine of String(text).split(/\r?\n/)) {
    let line = bulkTrim(rawLine);
    if (!line) continue;
    line = bulkTrim(line.replace(BULLET_RE, ''));
    if (!line) continue;

    // エリア：タイトル：期限：難易度：メモ（区切りは ：, :, タブ。メモの中の区切りはそのまま残す）
    const parts = line.split(SEPARATOR_RE).map(bulkTrim);
    let areaName = BULK_DEFAULT_AREA;
    let title = '';
    let deadlineText = '';
    let difficultyText = '';
    let note = '';
    if (parts.length === 1) {
      title = parts[0];
    } else if (parts.length === 2) {
      [areaName, title] = parts;
    } else if (parts.length === 3) {
      [areaName, title] = parts;
      if (looksLikeDifficulty(parts[2])) difficultyText = parts[2]; else deadlineText = parts[2];
    } else {
      [areaName, title, deadlineText, difficultyText] = parts;
      note = parts.slice(4).join('：');
    }
    if (!areaName) areaName = BULK_DEFAULT_AREA;
    if (!title) { skipped.empty += 1; continue; }
    if (title.length > BULK_TITLE_MAX) { title = title.slice(0, BULK_TITLE_MAX); truncated += 1; }
    if (note.length > BULK_NOTE_MAX) note = note.slice(0, BULK_NOTE_MAX);

    let deadline = null;
    if (deadlineText) {
      const d = parseDeadline(deadlineText, now);
      if (!d) { skipped.badDeadline += 1; continue; }
      deadline = d.toISOString();
    }
    let difficulty = 1;
    if (difficultyText) {
      const v = parseDifficulty(difficultyText);
      if (v === null) { skipped.badDifficulty += 1; continue; }
      difficulty = v;
    }

    const area = resolveArea(areaName);
    const key = `${area.id || `new:${area.name}`}\n${title}`;
    if (seen.has(key) || (area.id && existingTitles.has(`${area.id}\n${title}`))) { skipped.duplicate += 1; continue; }
    seen.add(key);
    entries.push({ areaName: area.name, areaId: area.id, title, deadline, difficulty, note });
  }

  // エリアごとの件数
  const perArea = {};
  for (const e of entries) perArea[e.areaName] = (perArea[e.areaName] || 0) + 1;
  return { newAreas, entries, skipped, perArea, truncated };
}

let lastBulk = null; // 取り消し用

function applyBulkPlan(plan) {
  const now = new Date().toISOString();
  const createdAreaIds = [];
  const createdTaskIds = [];
  let maxOrder = state.areas.reduce((m, a) => Math.max(m, a.order), -1);
  const idByName = new Map(state.areas.map((a) => [a.name, a.id]));

  for (const a of plan.newAreas) {
    maxOrder += 1;
    const area = { id: newId('a'), name: a.name, kind: a.kind, order: maxOrder };
    state.areas.push(area);
    idByName.set(area.name, area.id);
    createdAreaIds.push(area.id);
  }
  for (const e of plan.entries) {
    const task = {
      id: newId('t'),
      areaId: e.areaId || idByName.get(e.areaName),
      title: e.title,
      difficulty: e.difficulty || 1,
      repeat: { type: 'none' },
      note: e.note || '',
      deadline: e.deadline || null,
      deferredAt: null,
      lastDoneAt: null,
      dueAt: null,
      done: false,
      createdAt: now,
    };
    state.tasks.push(task);
    createdTaskIds.push(task.id);
    addRegisterXp();
  }
  saveState();
  lastBulk = { createdAreaIds, createdTaskIds };
  return { areas: createdAreaIds.length, tasks: createdTaskIds.length };
}

function undoBulk() {
  if (!lastBulk) return false;
  const taskIds = new Set(lastBulk.createdTaskIds);
  const before = state.tasks.length;
  state.tasks = state.tasks.filter((t) => !taskIds.has(t.id));
  const removed = before - state.tasks.length;
  if (removed > 0) removeRegisterXp(removed);
  // 今回作ったエリアは、ほかにクエストが残っていなければ消す
  for (const areaId of lastBulk.createdAreaIds) {
    if (!state.tasks.some((t) => t.areaId === areaId)) {
      state.areas = state.areas.filter((a) => a.id !== areaId);
      if (ui.areaFilter === areaId) ui.areaFilter = null;
    }
  }
  sortedAreas().forEach((a, i) => { a.order = i; });
  lastBulk = null;
  saveState();
  return true;
}

// --- 画面 -------------------------------------------------------------

let bulkPlan = null;

function renderBulkPreview(plan) {
  const box = document.getElementById('bulk-result');
  const parts = [];
  if (plan.newAreas.length) {
    parts.push(`<p><strong>新しいエリア ${plan.newAreas.length} 件</strong>: ${plan.newAreas.map((a) => escapeHtml(a.name)).join('、')}</p>`);
  }
  const areaLines = Object.entries(plan.perArea).map(([name, n]) => `${escapeHtml(name)} ${n}`).join('、');
  parts.push(`<p><strong>クエスト ${plan.entries.length} 件</strong>${areaLines ? `: ${areaLines}` : ''}</p>`);
  if (plan.truncated) parts.push(`<p class="bulk-skip">切り詰め: ${BULK_TITLE_MAX}文字に短くした行 ${plan.truncated}</p>`);
  const skips = [];
  if (plan.skipped.empty) skips.push(`タイトルなし ${plan.skipped.empty}`);
  if (plan.skipped.badDeadline) skips.push(`期限が読めない ${plan.skipped.badDeadline}`);
  if (plan.skipped.badDifficulty) skips.push(`難易度が読めない ${plan.skipped.badDifficulty}`);
  if (plan.skipped.duplicate) skips.push(`重複 ${plan.skipped.duplicate}`);
  if (skips.length) parts.push(`<p class="bulk-skip">読み飛ばし: ${skips.join('、')}</p>`);
  const canApply = plan.entries.length > 0;
  parts.push(`<div class="btn-row">
    <button class="btn btn-primary" id="bulk-apply" ${canApply ? '' : 'disabled'}>登録する</button>
    <button class="btn" id="bulk-cancel">やめる</button>
  </div>`);
  box.innerHTML = parts.join('');
  box.hidden = false;
}

function renderBulkDone(result) {
  const box = document.getElementById('bulk-result');
  box.innerHTML = `<p><strong>${result.tasks} 件を登録しました</strong>（+${result.tasks} XP${result.areas ? `、エリア ${result.areas} 件を追加` : ''}）</p>
    <div class="btn-row"><button class="btn" id="bulk-undo">取り消す</button></div>`;
  box.hidden = false;
}

function clearBulkResult() {
  const box = document.getElementById('bulk-result');
  box.hidden = true;
  box.innerHTML = '';
  bulkPlan = null;
}

function initBulk() {
  const textarea = document.getElementById('bulk-text');
  const box = document.getElementById('bulk-result');

  document.getElementById('bulk-parse').addEventListener('click', () => {
    const text = textarea.value;
    if (!bulkTrim(text)) { showToast('1行1クエストで貼り付けてください'); return; }
    lastBulk = null;
    bulkPlan = parseBulkText(text, state.areas, state.tasks);
    renderBulkPreview(bulkPlan);
  });

  box.addEventListener('click', (e) => {
    if (e.target.closest('#bulk-cancel')) { clearBulkResult(); return; }
    if (e.target.closest('#bulk-apply') && bulkPlan) {
      const result = applyBulkPlan(bulkPlan);
      bulkPlan = null;
      textarea.value = '';
      render();
      renderBulkDone(result);
      const at = centerOf(document.getElementById('bulk-parse'));
      floatText(at.x, at.y, `+${result.tasks} XP`, false, true);
      setTimeout(pulseXpBar, 250);
      return;
    }
    if (e.target.closest('#bulk-undo')) {
      if (undoBulk()) {
        clearBulkResult();
        render();
        showToast('取り消しました');
      }
    }
  });

  // 次の操作をしたら取り消しは無効にする
  textarea.addEventListener('input', () => { if (lastBulk) { lastBulk = null; clearBulkResult(); } });
}
