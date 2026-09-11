// 記録画面: 月カレンダー、日ごとの記録、週間サマリー、ストリーク

const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

// 週の始まりは月曜
function startOfWeek(date) {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7;
  return addDays(d, -offset);
}

function logsByDay(logs) {
  const map = {};
  for (const log of logs) {
    const key = dateKey(log.doneAt);
    (map[key] = map[key] || []).push(log);
  }
  return map;
}

function heatLevel(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

function longestStreak(logs) {
  const days = [...new Set(logs.map((l) => dateKey(l.doneAt)))].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    const d = new Date(`${key}T00:00:00`);
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

function renderLog() {
  const now = new Date();
  const today = dateKey(now);
  const byDay = logsByDay(state.logs);
  if (!ui.logMonth) ui.logMonth = { year: now.getFullYear(), month: now.getMonth() };
  if (!ui.logDay) ui.logDay = today;

  // 集計カード
  const streak = currentStreak(state.logs, now);
  const best = Math.max(state.player.bestStreak || 0, longestStreak(state.logs));
  const totalXp = state.logs.reduce((s, l) => s + l.xp, 0);
  document.getElementById('log-stats').innerHTML = [
    ['i-flame', streak, '連続日数'],
    ['i-medal', best, '最長連続'],
    ['i-check', state.logs.length, '達成数'],
    ['i-sparkle', totalXp, '獲得XP'],
  ].map(([icon, value, label]) => `<div class="stat">
    <span class="stat-icon">${iconHtml(icon, `icon stat-svg ${icon}`)}</span>
    <span class="stat-value">${value}</span>
    <span class="stat-label">${label}</span>
  </div>`).join('');

  // カレンダー
  const { year, month } = ui.logMonth;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  document.getElementById('log-month-label').textContent = `${year}年${month + 1}月`;

  let cells = WEEKDAYS.map((w, i) => `<div class="cal-weekday ${i >= 5 ? 'is-weekend' : ''}">${w}</div>`).join('');
  for (let i = 0; i < lead; i++) cells += '<div class="cal-cell is-blank"></div>';
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKey(d);
    const count = (byDay[key] || []).length;
    const classes = ['cal-cell', `heat-${heatLevel(count)}`];
    if (key === today) classes.push('is-today');
    if (key === ui.logDay) classes.push('is-selected');
    if (d > now) classes.push('is-future');
    cells += `<button class="${classes.join(' ')}" data-day="${key}" aria-label="${month + 1}月${day}日 ${count}件">
      <span class="cal-day">${day}</span>${count ? `<span class="cal-count">${count}</span>` : ''}
    </button>`;
  }
  document.getElementById('log-calendar').innerHTML = cells;

  // 選んだ日の記録
  const dayLogs = (byDay[ui.logDay] || []).slice().sort((a, b) => (a.doneAt < b.doneAt ? 1 : -1));
  const sel = new Date(`${ui.logDay}T00:00:00`);
  const dayLabel = ui.logDay === today ? '今日' : `${sel.getMonth() + 1}月${sel.getDate()}日（${WEEKDAYS[(sel.getDay() + 6) % 7]}）`;
  const titleOf = (log) => {
    const task = state.tasks.find((t) => t.id === log.taskId);
    return task ? task.title : '（削除されたタスク）';
  };
  const categoryOf = (log) => {
    const task = state.tasks.find((t) => t.id === log.taskId);
    const category = task && state.categories.find((a) => a.id === task.categoryId);
    return category ? category.name : '';
  };
  document.getElementById('log-day-title').textContent = `${dayLabel}の記録`;
  document.getElementById('log-day-list').innerHTML = dayLogs.length
    ? dayLogs.map((log) => {
      const t = new Date(log.doneAt);
      const time = `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
      return `<li class="log-row">
        <span class="log-time">${time}</span>
        <span class="log-body">
          <span class="log-title">${escapeHtml(titleOf(log))}</span>
          <span class="log-meta">${escapeHtml(categoryOf(log))}${log.combo >= 1 ? ` · ${iconHtml('i-flame', 'icon icon-flame')}${log.combo}コンボ` : ''}</span>
        </span>
        <span class="log-xp">+${log.xp}${log.bonusXp > 0 ? `<small>（+${log.bonusXp}）</small>` : ''}</span>
      </li>`;
    }).join('')
    : '<li class="quest-empty">この日の記録はありません</li>';

  // 週間サマリー
  const weekStart = startOfWeek(now);
  const weekEnd = addDays(weekStart, 7);
  const weekLogs = state.logs.filter((l) => {
    const d = new Date(l.doneAt);
    return d >= weekStart && d < weekEnd;
  });
  const weekXp = weekLogs.reduce((s, l) => s + l.xp, 0);
  const activeDays = new Set(weekLogs.map((l) => dateKey(l.doneAt))).size;
  document.getElementById('log-week-label').textContent =
    `${formatShortDate(weekStart)} 〜 ${formatShortDate(addDays(weekEnd, -1))}`;
  document.getElementById('log-week-stats').innerHTML = [
    [weekLogs.length, '完了'], [weekXp, 'XP'], [activeDays, '日活動'],
  ].map(([v, l]) => `<span class="week-stat"><strong>${v}</strong>${l}</span>`).join('');

  const perCategory = {};
  for (const log of weekLogs) {
    const name = categoryOf(log) || 'その他';
    perCategory[name] = (perCategory[name] || 0) + 1;
  }
  const entries = Object.entries(perCategory).sort((a, b) => b[1] - a[1]);
  const max = entries.length ? entries[0][1] : 1;
  document.getElementById('log-week-categories').innerHTML = entries.length
    ? entries.map(([name, n]) => `<li class="bar-row">
        <span class="bar-label">${escapeHtml(name)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></span></span>
        <span class="bar-value">${n}</span>
      </li>`).join('')
    : '<li class="quest-empty">今週はまだ記録がありません</li>';

  // セッションのランキング（獲得 XP 上位5件）
  const ranked = [...(state.sessions || [])].sort((a, b) => b.xp - a.xp).slice(0, 5);
  document.getElementById('log-rank').innerHTML = ranked.length
    ? ranked.map((r, i) => {
      const d = new Date(r.startedAt);
      const label = `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[(d.getDay() + 6) % 7]}）${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `<li class="rank-row">
        <span class="rank-no">${i + 1}</span>
        <span class="rank-body">
          <span class="rank-date">${label}</span>
          <span class="rank-meta">達成 ${r.completed} · 最大 ${r.maxCombo}コンボ · ${Math.max(1, Math.round(r.durationSec / 60))}分</span>
        </span>
        <span class="rank-xp">${r.xp}<small> XP</small></span>
      </li>`;
    }).join('')
    : '<li class="quest-empty">セッションを終えると、ここに上位5件が並びます</li>';
}

function initLog() {
  document.getElementById('log-prev').addEventListener('click', () => {
    const { year, month } = ui.logMonth;
    ui.logMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
    renderLog();
  });
  document.getElementById('log-next').addEventListener('click', () => {
    const { year, month } = ui.logMonth;
    ui.logMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
    renderLog();
  });
  document.getElementById('log-today').addEventListener('click', () => {
    const now = new Date();
    ui.logMonth = { year: now.getFullYear(), month: now.getMonth() };
    ui.logDay = dateKey(now);
    renderLog();
  });
  document.getElementById('log-calendar').addEventListener('click', (e) => {
    const cell = e.target.closest('[data-day]');
    if (!cell) return;
    ui.logDay = cell.dataset.day;
    renderLog();
  });
}
