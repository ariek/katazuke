// 独自の確認ダイアログ。OS の confirm / alert の代わりに、アプリの見た目で出す
// askConfirm(message, { ok, cancel, danger }) → Promise<boolean>
// showAlert(message, { ok }) → Promise<void>

let dialogResolve = null;

function openDialog({ message, ok = 'OK', cancel = 'キャンセル', danger = false, alertOnly = false }) {
  const modal = document.getElementById('dialog-modal');
  document.getElementById('dialog-message').textContent = message;
  const okBtn = document.getElementById('dialog-ok');
  const cancelBtn = document.getElementById('dialog-cancel');
  okBtn.textContent = ok;
  okBtn.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  cancelBtn.textContent = cancel;
  cancelBtn.hidden = alertOnly;
  setModalVisible(modal, true);
  setTimeout(() => (alertOnly ? okBtn : cancelBtn).focus(), 50);
  return new Promise((resolve) => { dialogResolve = resolve; });
}

function closeDialog(result) {
  const modal = document.getElementById('dialog-modal');
  setModalVisible(modal, false);
  const resolve = dialogResolve;
  dialogResolve = null;
  if (resolve) resolve(result);
}

function askConfirm(message, options = {}) {
  return openDialog({ message, ...options });
}

function showAlert(message, options = {}) {
  return openDialog({ message, alertOnly: true, ...options }).then(() => undefined);
}

function initDialog() {
  document.getElementById('dialog-ok').addEventListener('click', () => closeDialog(true));
  document.getElementById('dialog-cancel').addEventListener('click', () => closeDialog(false));
  const modal = document.getElementById('dialog-modal');
  modal.addEventListener('click', (e) => { if (e.target === modal) closeDialog(false); });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeDialog(false);
    if (e.key === 'Enter') closeDialog(true);
  });
}
