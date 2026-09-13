// 一覧のドラッグ＆ドロップ並べ替え。つまみを押したまま上下に動かし、同じ一覧の中で入れ替える。
// ポインターイベントで作っているので、指でもマウスでも同じ動きになる。
//
// 作り: ドラッグ中は DOM を動かさず、行の位置を transform でずらして見せる。指を離した瞬間に DOM を並べ替える。
// （ドラッグ中に行を DOM 上で動かすと、iOS でポインターの捕捉が外れて pointerup が届かなくなり、
//   ドラッグ状態が残ったままになることがあったため）
// イベントは window で受けるので、一覧の外で指を離しても必ず終わる。

// fixed を渡すと、それに当てはまる行は動かせず、ほかの行をその前後に割り込ませることもできない（先頭に固定された行など）
function makeSortable(container, { row: rowSel, grip: gripSel, fixed: fixedSel = null, onDrop }) {
  const main = container.closest('.main') || document.scrollingElement;
  let drag = null;

  const rowsOf = (list) => [...list.children].filter((el) => el.matches(rowSel));
  const isFixed = (el) => !!fixedSel && el.matches(fixedSel);
  const listY = (list, clientY) => clientY - list.getBoundingClientRect().top; // 一覧の上端からの位置（スクロールしても変わらない）

  // 動かせる行の、一覧内での位置と高さ（ドラッグ開始時に測る）
  const measure = (list) => {
    const top = list.getBoundingClientRect().top;
    return rowsOf(list).filter((el) => !isFixed(el)).map((el) => {
      const r = el.getBoundingClientRect();
      return { el, top: r.top - top, height: r.height, mid: r.top - top + r.height / 2 };
    });
  };

  const applyShift = () => {
    const { rows, startIndex, targetIndex, rowH, gap } = drag;
    rows.forEach((r, i) => {
      if (i === startIndex) return;
      let dy = 0;
      if (startIndex < targetIndex && i > startIndex && i <= targetIndex) dy = -(rowH + gap);
      else if (startIndex > targetIndex && i >= targetIndex && i < startIndex) dy = rowH + gap;
      r.el.style.transform = dy ? `translateY(${dy}px)` : '';
    });
  };

  const moveTo = (clientY) => {
    const { list, rows, startIndex, grabY, rowH } = drag;
    // 画面の端に近づいたら少しスクロールする
    const m = main.getBoundingClientRect ? main.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    if (clientY < m.top + 48) main.scrollTop -= 8;
    else if (clientY > m.bottom - 48) main.scrollTop += 8;
    const y = listY(list, clientY);
    const dragTop = y - grabY;
    const center = dragTop + rowH / 2;
    // 行の中央を越えた数で行き先を決める
    let target = startIndex;
    if (center < rows[startIndex].mid) {
      for (let i = startIndex - 1; i >= 0; i -= 1) { if (center < rows[i].mid) target = i; else break; }
    } else {
      for (let i = startIndex + 1; i < rows.length; i += 1) { if (center > rows[i].mid) target = i; else break; }
    }
    drag.targetIndex = target;
    applyShift();
    drag.row.style.transform = `translateY(${dragTop - rows[startIndex].top}px)`;
  };

  const finish = () => {
    if (!drag) return;
    const { row, list, rows, startIndex, targetIndex } = drag;
    drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('blur', onUp);
    rows.forEach((r) => { r.el.style.transform = ''; });
    row.classList.remove('is-dragging');
    list.classList.remove('is-reordering');
    if (targetIndex !== startIndex) {
      const other = rows[targetIndex].el;
      if (targetIndex < startIndex) list.insertBefore(row, other);
      else other.after(row);
    }
    onDrop(row, list, { moved: targetIndex !== startIndex, startIndex, endIndex: targetIndex });
  };

  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    moveTo(e.clientY);
  };
  const onUp = (e) => {
    if (!drag) return;
    if (e && e.pointerId !== undefined && e.pointerId !== drag.pointerId) return;
    finish();
  };

  container.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest(gripSel);
    if (!grip) return;
    if (drag) finish(); // 前のドラッグが残っていたら片付けてから始める
    const row = grip.closest(rowSel);
    if (!row || isFixed(row)) return;
    const list = row.parentElement;
    e.preventDefault();
    const rows = measure(list);
    const startIndex = rows.findIndex((r) => r.el === row);
    if (startIndex < 0) return;
    const gap = rows.length > 1 ? Math.max(0, rows[1].top - rows[0].top - rows[0].height) : 0;
    drag = { row, list, rows, startIndex, targetIndex: startIndex, rowH: rows[startIndex].height, gap, grabY: listY(list, e.clientY) - rows[startIndex].top, pointerId: e.pointerId };
    row.classList.add('is-dragging');
    list.classList.add('is-reordering');
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
  });
}
