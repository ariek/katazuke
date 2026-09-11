// クエスト画面: クエスト（カテゴリー）ごとのカード。色とアイコン、名前、件数を出す

function renderOverview() {
  const now = new Date();
  const grid = document.getElementById('category-grid');
  const cats = [...state.categories].sort((a, b) => a.order - b.order);
  if (cats.length === 0) {
    grid.innerHTML = '<p class="quest-empty">クエストがありません。設定画面から追加するか、タスクの一括追加で作れます。</p>';
    return;
  }
  grid.innerHTML = cats.map((cat) => {
    const tasks = state.tasks.filter((t) => t.categoryId === cat.id && !t.done);
    let todo = 0;
    let overdue = 0;
    for (const t of tasks) {
      const st = taskStatus(t, now);
      if (st === 'overdue' || st === 'due' || st === 'todo') todo += 1;
      if (st === 'overdue' || st === 'due') overdue += 1;
    }
    return `<button class="cat-card" data-category="${cat.id}" style="--cat-color:${categoryColorHex(cat.color)}" aria-label="${escapeHtml(cat.name)}のタスクを見る">
      <span class="cat-card-icon"><svg class="icon" aria-hidden="true"><use href="#c-${categoryIconId(cat.icon)}"/></svg></span>
      <span class="cat-card-name">${escapeHtml(cat.name)}</span>
      <span class="cat-card-count">${todo > 0 ? `やること <strong>${todo}</strong>` : '<span class="is-zero">やること なし</span>'}</span>
      ${overdue > 0 ? `<span class="cat-card-overdue">期限切れ ${overdue}</span>` : ''}
    </button>`;
  }).join('');
}
