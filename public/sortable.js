// 一覧のドラッグ＆ドロップ並べ替え。つまみを押したまま上下に動かし、同じ一覧の中で入れ替える。
// ポインターイベントで作っているので、指でもマウスでも同じ動きになる

// fixed を渡すと、それに当てはまる行は動かせず、ほかの行をその前後に割り込ませることもできない（先頭に固定された行など）
function makeSortable(container, { row: rowSel, grip: gripSel, fixed: fixedSel = null, onDrop }) {
  const main = container.closest('.main') || document.scrollingElement;
  let drag = null; // { row, list, grabY: つまんだ位置と行の上端の差, translate, pointerId, startIndex }

  const rowsOf = (list) => [...list.children].filter((el) => el.matches(rowSel));
  const isFixed = (el) => !!fixedSel && el.matches(fixedSel);

  const moveTo = (clientY) => {
    const { row, list, grabY } = drag;
    // 画面の端に近づいたら少しスクロールする
    const m = main.getBoundingClientRect ? main.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    if (clientY < m.top + 48) main.scrollTop -= 8;
    else if (clientY > m.bottom - 48) main.scrollTop += 8;
    // ほかの行の中央を越えたら、その行の前後に移す
    for (const other of rowsOf(list)) {
      if (other === row || isFixed(other)) continue;
      const r = other.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const rowIsAfter = !!(other.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (rowIsAfter && clientY < mid) { list.insertBefore(row, other); break; }
      if (!rowIsAfter && clientY > mid) { other.after(row); break; }
    }
    // 見た目は指の位置に追従させる（transform を除いた本来の位置との差）
    const naturalTop = row.getBoundingClientRect().top - drag.translate;
    drag.translate = clientY - grabY - naturalTop;
    row.style.transform = `translateY(${drag.translate}px)`;
  };

  const finish = (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const { row, list, startIndex } = drag;
    drag = null;
    row.classList.remove('is-dragging');
    row.style.transform = '';
    list.classList.remove('is-reordering');
    try { row.releasePointerCapture(e.pointerId); } catch (err) { /* すでに解放済み */ }
    const endIndex = rowsOf(list).indexOf(row);
    onDrop(row, list, { moved: endIndex !== startIndex, startIndex, endIndex });
  };

  container.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest(gripSel);
    if (!grip || drag) return;
    const row = grip.closest(rowSel);
    if (!row || isFixed(row)) return;
    const list = row.parentElement;
    e.preventDefault();
    drag = { row, list, grabY: e.clientY - row.getBoundingClientRect().top, translate: 0, pointerId: e.pointerId, startIndex: rowsOf(list).indexOf(row) };
    row.classList.add('is-dragging');
    list.classList.add('is-reordering');
    try { row.setPointerCapture(e.pointerId); } catch (err) { /* 取得できなくても続行 */ }
  });
  container.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    moveTo(e.clientY);
  });
  container.addEventListener('pointerup', finish);
  container.addEventListener('pointercancel', finish);
}
