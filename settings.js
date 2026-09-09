// 設定画面: エリア編集、エクスポート/インポート、サンプル削除、初期化

const DEFAULT_AREAS = [
  ['机', 'desk'], ['床', 'floor'], ['ベッドまわり', 'bed'], ['クローゼット', 'closet'],
  ['キッチン', 'kitchen'], ['洗面所・風呂', 'bath'], ['玄関', 'entrance'],
];

// --- エリアの操作 -----------------------------------------------------

function sortedAreas() {
  return [...state.areas].sort((a, b) => a.order - b.order);
}

function upsertArea(data) {
  if (data.id) {
    const area = state.areas.find((a) => a.id === data.id);
    if (area) Object.assign(area, { name: data.name, kind: data.kind });
  } else {
    const maxOrder = state.areas.reduce((m, a) => Math.max(m, a.order), -1);
    state.areas.push({ id: newId('a'), name: data.name, kind: data.kind, order: maxOrder + 1 });
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

function importJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    return 'JSON として読み込めませんでした';
  }
  const error = validateImport(data);
  if (error) return error;
  const summary = `エリア ${data.areas.length} 件、クエスト ${data.tasks.length} 件、記録 ${data.logs.length} 件を読み込みます。\n現在のデータは上書きされます。よろしいですか？`;
  if (!confirm(summary)) return null;
  state = migrate(data);
  if (!state.timer) state.timer = { startedAt: null, durationSec: 0, lastResult: null };
  ui.areaFilter = null;
  saveState();
  stopTimerLoop();
  if (timerActive(state.timer)) ensureTimerLoop();
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
  state.timer = { startedAt: null, durationSec: 0, lastResult: null };
  state.sample = false;
  ui.areaFilter = null;
  stopTimerLoop();
  saveState();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  state = emptyState();
  state.areas = DEFAULT_AREAS.map(([name, kind], i) => ({ id: newId('a'), name, kind, order: i }));
  ui.areaFilter = null;
  stopTimerLoop();
  saveState();
}

// --- 描画 -------------------------------------------------------------

function renderSettings() {
  const list = document.getElementById('area-list');
  const areas = sortedAreas();
  const taskCount = {};
  for (const t of state.tasks) taskCount[t.areaId] = (taskCount[t.areaId] || 0) + 1;

  list.innerHTML = areas.map((a, i) => `<li class="area-row">
    <span class="area-thumb">${renderRoomArt(a.kind, 'clean')}</span>
    <button class="area-body" data-area-edit="${a.id}">
      <span class="area-name">${escapeHtml(a.name)}</span>
      <span class="area-meta">${ROOM_KINDS[a.kind] || '棚'}の絵 · クエスト ${taskCount[a.id] || 0} 件</span>
    </button>
    <span class="area-move">
      <button class="icon-btn" data-area-move="${a.id}" data-delta="-1" ${i === 0 ? 'disabled' : ''} aria-label="上へ">▲</button>
      <button class="icon-btn" data-area-move="${a.id}" data-delta="1" ${i === areas.length - 1 ? 'disabled' : ''} aria-label="下へ">▼</button>
    </span>
  </li>`).join('') || '<li class="quest-empty">エリアがありません。下のボタンで追加してください。</li>';

  document.getElementById('sample-section').hidden = !state.sample;
  document.getElementById('data-summary').textContent =
    `エリア ${state.areas.length} 件 · クエスト ${state.tasks.length} 件 · 記録 ${state.logs.length} 件 · データ形式 v${state.version}`;
}

function openAreaSheet(areaId = null) {
  const form = document.getElementById('area-form');
  const area = areaId ? state.areas.find((a) => a.id === areaId) : null;
  form.elements.id.value = area ? area.id : '';
  form.elements.name.value = area ? area.name : '';
  form.elements.kind.innerHTML = Object.entries(ROOM_KINDS)
    .map(([kind, label]) => `<option value="${kind}">${label}</option>`).join('');
  form.elements.kind.value = area ? area.kind : 'shelf';
  document.getElementById('area-sheet-title').textContent = area ? 'エリアを編集' : 'エリアを追加';
  document.getElementById('area-delete').hidden = !area;
  updateAreaPreview();
  document.getElementById('area-sheet').hidden = false;
  setTimeout(() => form.elements.name.focus(), 50);
}

function closeAreaSheet() {
  document.getElementById('area-sheet').hidden = true;
}

function updateAreaPreview() {
  const kind = document.getElementById('area-form').elements.kind.value;
  document.getElementById('area-preview').innerHTML = ['messy', 'normal', 'clean']
    .map((s) => `<span class="area-preview-cell">${renderRoomArt(kind, s)}<small>${CLEAN_LABELS[s]}</small></span>`).join('');
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
  form.elements.kind.addEventListener('change', updateAreaPreview);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) { form.elements.name.focus(); return; }
    upsertArea({ id: form.elements.id.value || null, name, kind: form.elements.kind.value });
    closeAreaSheet();
    render();
  });
  document.getElementById('area-delete').addEventListener('click', () => {
    const id = form.elements.id.value;
    const area = state.areas.find((a) => a.id === id);
    if (!area) return;
    const n = state.tasks.filter((t) => t.areaId === id).length;
    const msg = n > 0
      ? `「${area.name}」と、所属するクエスト ${n} 件をまとめて削除します。よろしいですか？`
      : `「${area.name}」を削除しますか？`;
    if (!confirm(msg)) return;
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
  document.getElementById('import-run').addEventListener('click', () => {
    const text = importArea.value.trim();
    if (!text) { showToast('JSON を貼り付けるかファイルを選んでください'); return; }
    const result = importJson(text);
    if (result === null) return;
    if (result) { showToast(result, 'is-levelup'); return; }
    importArea.value = '';
    render();
    showToast('読み込みました');
  });

  // サンプル削除
  document.getElementById('sample-clear').addEventListener('click', () => {
    if (!confirm('サンプルのクエストと記録を削除します。エリアは残ります。よろしいですか？')) return;
    clearSample();
    render();
    showToast('サンプルを消しました');
  });

  // 初期化
  document.getElementById('reset-all').addEventListener('click', () => {
    if (!confirm('すべてのデータ（エリア、クエスト、記録、レベル）を削除します。よろしいですか？')) return;
    if (!confirm('本当に削除しますか？ この操作は取り消せません。')) return;
    resetAll();
    render();
    showToast('初期化しました');
  });
}
