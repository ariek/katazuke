// 設定画面: クエスト（カテゴリー）編集、エクスポート/インポート、サンプル削除、初期化

// 初期クエスト（名前、色、アイコン）
const DEFAULT_AREAS = [
  ['仕事', 'sky', 'briefcase'], ['家事', 'mint', 'house'], ['勉強', 'lav', 'book'], ['健康', 'pink', 'heart'], ['買い物', 'yellow', 'cart'],
];

// まだ使われていない色から順に選ぶ
function nextFreeColor() {
  const used = new Set(state.areas.map((a) => a.color));
  const free = CATEGORY_COLORS.find((c) => !used.has(c.id));
  return free ? free.id : CATEGORY_COLORS[state.areas.length % CATEGORY_COLORS.length].id;
}

// --- クエスト（カテゴリー）の操作 -----------------------------------------------------

function sortedAreas() {
  return [...state.areas].sort((a, b) => a.order - b.order);
}

function upsertArea(data) {
  if (data.id) {
    const area = state.areas.find((a) => a.id === data.id);
    if (area) Object.assign(area, { name: data.name, color: data.color, icon: data.icon });
  } else {
    const maxOrder = state.areas.reduce((m, a) => Math.max(m, a.order), -1);
    state.areas.push({ id: newId('a'), name: data.name, color: data.color, icon: data.icon, order: maxOrder + 1 });
  }
  saveState();
}

function deleteArea(areaId) {
  const ids = new Set(state.tasks.filter((t) => t.areaId === areaId).map((t) => t.id));
  state.tasks = state.tasks.filter((t) => t.areaId !== areaId);
  if (ids.size > 0) removeRegisterXp(ids.size);
  state.logs = state.logs.filter((l) => !ids.has(l.taskId));
  state.areas = state.areas.filter((a) => a.id !== areaId);
  sortedAreas().forEach((a, i) => { a.order = i; });
  if (ui.areaFilter === areaId) ui.areaFilter = null;
  saveState();
}

function moveArea(areaId, delta) {
  const list = sortedAreas();
  const index = list.findIndex((a) => a.id === areaId);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
  list.forEach((a, i) => { a.order = i; });
  saveState();
}

// --- エクスポート / インポート ----------------------------------------

function exportJson() {
  return JSON.stringify(state, null, 2);
}

function validateImport(data) {
  if (!data || typeof data !== 'object') return 'JSON の形式が違います';
  if (!Array.isArray(data.areas) || !Array.isArray(data.tasks) || !Array.isArray(data.logs)) {
    return 'areas / tasks / logs が見つかりません';
  }
  if (!data.player || typeof data.player.xp !== 'number') return 'player の情報が見つかりません';
  return null;
}

async function importJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return 'JSON として読み込めませんでした';
  }
  const error = validateImport(data);
  if (error) return error;
  const summary = `クエスト ${data.areas.length} 件、タスク ${data.tasks.length} 件、記録 ${data.logs.length} 件を読み込みます。現在のデータは上書きされます。`;
  if (!(await askConfirm(summary, { ok: '読み込む', danger: true }))) return null;
  state = migrate(data);
  ui.areaFilter = null;
  saveState();
  stopSessionLoop();
  initSession();
  return '';
}

function downloadJson() {
  const blob = new Blob([exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `katazuke-${dateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- サンプル削除 / 初期化 --------------------------------------------

function clearSample() {
  state.tasks = [];
  state.logs = [];
  state.player = { xp: 0, level: 1, bestStreak: 0 };
  state.session = null;
  state.sessions = [];
  state.sample = false;
  ui.areaFilter = null;
  stopSessionLoop();
  saveState();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = emptyState(); // クエストも含めてすべて消す
  ui.areaFilter = null;
  stopSessionLoop();
  saveState();
}

// --- 描画 -------------------------------------------------------------

function renderSettings() {
  const list = document.getElementById('area-list');
  const areas = sortedAreas();
  const taskCount = {};
  for (const t of state.tasks) taskCount[t.areaId] = (taskCount[t.areaId] || 0) + 1;

  list.innerHTML = areas.map((a, i) => `<li class="area-row">
    ${categoryIconHtml(a, 'cat-icon cat-icon--lg')}
    <button class="area-body" data-area-edit="${a.id}">
      <span class="area-name">${escapeHtml(a.name)}</span>
      <span class="area-meta">タスク ${taskCount[a.id] || 0} 件</span>
    </button>
    <span class="area-move">
      <button class="icon-btn" data-area-move="${a.id}" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="上へ">▲</button>
      <button class="icon-btn" data-area-move="${a.id}" data-delta="1" ${i === areas.length - 1 ? 'disabled' : ''} aria-label="下へ">▼</button>
    </span>
  </li>`).join('') || '<li class="quest-empty">クエストがありません。下のボタンで追加してください。</li>';

  document.getElementById('sample-section').hidden = !state.sample;
  document.getElementById('data-summary').textContent =
    `クエスト ${state.areas.length} 件 · タスク ${state.tasks.length} 件 · 記録 ${state.logs.length} 件 · データ形式 v${state.version}`;
}

function openAreaSheet(areaId = null) {
  const form = document.getElementById('area-form');
  const area = areaId ? state.areas.find((a) => a.id === areaId) : null;
  form.elements.id.value = area ? area.id : '';
  form.elements.name.value = area ? area.name : '';
  form.elements.color.value = area ? area.color : nextFreeColor();
  form.elements.icon.value = area ? area.icon : DEFAULT_ICON;
  document.getElementById('area-sheet-title').textContent = area ? 'クエストを編集' : 'クエストを追加';
  document.getElementById('area-delete').hidden = !area;
  renderPickers();
  document.getElementById('area-sheet').hidden = false;
  setTimeout(() => form.elements.name.focus(), 50);
}

function closeAreaSheet() {
  document.getElementById('area-sheet').hidden = true;
}

// 色とアイコンの選択肢
function renderPickers() {
  const form = document.getElementById('area-form');
  const color = form.elements.color.value;
  const icon = form.elements.icon.value;
  document.getElementById('color-picker').innerHTML = CATEGORY_COLORS.map((c) =>
    `<button type="button" class="color-swatch ${c.id === color ? 'is-selected' : ''}" data-color="${c.id}" style="--cat-color:${c.hex}" aria-label="${c.name}"></button>`).join('');
  document.getElementById('icon-picker').innerHTML = CATEGORY_ICONS.map(([name, label]) =>
    `<button type="button" class="icon-choice ${name === icon ? 'is-selected' : ''}" data-icon="${name}" style="--cat-color:${categoryColorHex(color)}" aria-label="${label}" title="${label}"><svg class="icon" aria-hidden="true"><use href="#c-${name}"/></svg></button>`).join('');
}

// --- イベント ---------------------------------------------------------

function initSettings() {
  document.getElementById('area-list').addEventListener('click', (e) => {
    const move = e.target.closest('[data-area-move]');
    if (move) {
      moveArea(move.dataset.areaMove, parseInt(move.dataset.delta, 10));
      render();
      return;
    }
    const edit = e.target.closest('[data-area-edit]');
    if (edit) openAreaSheet(edit.dataset.areaEdit);
  });
  document.getElementById('area-add-btn').addEventListener('click', () => openAreaSheet());

  const sheet = document.getElementById('area-sheet');
  const form = document.getElementById('area-form');
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeAreaSheet(); });
  document.getElementById('area-cancel').addEventListener('click', closeAreaSheet);
  document.getElementById('color-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-color]');
    if (!b) return;
    form.elements.color.value = b.dataset.color;
    renderPickers();
  });
  document.getElementById('icon-picker').addEventListener('click', (e) => {
    const b = e.target.closest('[data-icon]');
    if (!b) return;
    form.elements.icon.value = b.dataset.icon;
    renderPickers();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); return; }
    upsertArea({ id: form.elements.id.value || null, name, color: form.elements.color.value, icon: form.elements.icon.value });
    closeAreaSheet();
    render();
  });
  document.getElementById('area-delete').addEventListener('click', async () => {
    const id = form.elements.id.value;
    const area = state.areas.find((a) => a.id === id);
    if (!area) return;
    const n = state.tasks.filter((t) => t.areaId === id).length;
    const msg = n > 0
      ? `「${area.name}」と、所属するタスク ${n} 件をまとめて削除します。`
      : `「${area.name}」を削除します。`;
    if (!(await askConfirm(msg, { ok: '削除する', danger: true }))) return;
    deleteArea(id);
    closeAreaSheet();
    render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !sheet.hidden) closeAreaSheet();
  });

  // エクスポート
  const exportArea = document.getElementById('export-text');
  document.getElementById('export-show').addEventListener('click', () => {
    exportArea.value = exportJson();
    document.getElementById('export-box').hidden = false;
    exportArea.focus();
    exportArea.select();
  });
  document.getElementById('export-copy').addEventListener('click', async () => {
    exportArea.value = exportJson();
    try {
      await navigator.clipboard.writeText(exportArea.value);
      showToast('コピーしました');
    } catch (err) {
      exportArea.focus();
      exportArea.select();
      showToast('選択したので手動でコピーしてください');
    }
  });
  document.getElementById('export-download').addEventListener('click', downloadJson);

  // インポート
  const importArea = document.getElementById('import-text');
  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { importArea.value = String(reader.result || ''); };
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('import-run').addEventListener('click', async () => {
    const text = importArea.value.trim();
    if (!text) { showToast('JSON を貼り付けるかファイルを選んでください'); return; }
    const result = await importJson(text);
    if (result === null) return;
    if (result) { showToast(result, 'is-levelup'); return; }
    importArea.value = '';
    render();
    showToast('読み込みました');
  });

  // サンプル削除
  document.getElementById('sample-clear').addEventListener('click', async () => {
    if (!(await askConfirm('サンプルのタスクと記録を削除します。クエストは残ります。', { ok: '消す', danger: true }))) return;
    clearSample();
    render();
    showToast('サンプルを消しました');
  });

  // 初期化
  document.getElementById('reset-all').addEventListener('click', async () => {
    if (!(await askConfirm('すべてのデータ（クエスト、タスク、記録、レベル）を削除します。', { ok: '削除する', danger: true }))) return;
    if (!(await askConfirm('本当に削除しますか？ この操作は取り消せません。', { ok: '本当に削除する', danger: true }))) return;
    resetAll();
    render();
    showToast('初期化しました');
  });
}
