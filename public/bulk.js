// クエストの一括追加: 貼り付けた文字列を解釈し、内訳を出してから登録する

const BULK_DEFAULT_AREA = 'どこでも';
const BULK_TITLE_MAX = 60;

// 行頭の箇条書き記号を外す
const BULLET_RE = /^(?:[-*・•□■◇◆○●]|\[\s?[xX ]?\]|\d+[.．)）:：]?|[①-⑳])\s*/;
const SEPARATOR_RE = /[：:]/;

function bulkTrim(str) {
  return str.replace(/^[\s　]+|[\s　]+$/g, '');
}

// 文字列を解釈して「登録の計画」を返す。まだ状態は変えない
function parseBulkText(text, areas, tasks) {
  const areaByName = new Map(sortedAreas().map((a) => [a.name, a]));
  const firstKind = sortedAreas()[0] ? sortedAreas()[0].kind : 'shelf';
  const existingTitles = new Set(tasks.filter((t) => !t.done).map((t) => `${t.areaId}\n${t.title}`));
  const newAreas = []; // { name, kind }
  const entries = []; // { areaName, areaId|null, title }
  const skipped = { empty: 0, tooLong: 0, duplicate: 0 };
  const seen = new Set();

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

    let areaName = BULK_DEFAULT_AREA;
    let title = line;
    const m = SEPARATOR_RE.exec(line);
    if (m) {
      const left = bulkTrim(line.slice(0, m.index));
      const right = bulkTrim(line.slice(m.index + 1));
      if (left) areaName = left;
      title = right;
    }
    if (!title) { skipped.empty += 1; continue; }
    if (title.length > BULK_TITLE_MAX) { skipped.tooLong += 1; continue; }

    const area = resolveArea(areaName);
    const key = `${area.id || `new:${area.name}`}\n${title}`;
    if (seen.has(key) || (area.id && existingTitles.has(`${area.id}\n${title}`))) { skipped.duplicate += 1; continue; }
    seen.add(key);
    entries.push({ areaName: area.name, areaId: area.id, title });
  }

  // エリアごとの件数
  const perArea = {};
  for (const e of entries) perArea[e.areaName] = (perArea[e.areaName] || 0) + 1;
  return { newAreas, entries, skipped, perArea };
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
      difficulty: 1,
      repeat: { type: 'none' },
      note: '',
      deadline: null,
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
  const skips = [];
  if (plan.skipped.empty) skips.push(`タイトルなし ${plan.skipped.empty}`);
  if (plan.skipped.tooLong) skips.push(`${BULK_TITLE_MAX}文字超え ${plan.skipped.tooLong}`);
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
