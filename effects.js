// 完了時の演出: 紙吹雪、浮かぶ XP、経験値バーの光、レベルアップのお祝い

const EFFECT_COLORS = ['#f6c9b3', '#bfe3d0', '#c9ddf2', '#dcd0f0', '#f7e3a1', '#f4b8c8', '#9fcf9a'];

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function particleShape(i) {
  const kind = i % 4;
  if (kind === 0) return 'is-circle';
  if (kind === 1) return 'is-star';
  if (kind === 2) return 'is-rect';
  return 'is-spark';
}

// 座標から紙吹雪を飛ばす
function burstAt(x, y, count = 22, spread = 130) {
  if (reducedMotion()) return;
  const layer = document.getElementById('fx-layer');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = `fx-particle ${particleShape(i)}`;
    p.style.background = EFFECT_COLORS[i % EFFECT_COLORS.length];
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    layer.appendChild(p);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
    const dist = spread * (0.5 + Math.random() * 0.6);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - spread * 0.35;
    const rot = (Math.random() - 0.5) * 720;
    const duration = 900 + Math.random() * 500;

    // 区間ごとにイージングを分ける: 勢いよく飛び出し、ふわっと落ちながら消える
    p.animate([
      { transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)', opacity: 1, easing: 'cubic-bezier(0.1, 0.9, 0.3, 1)' },
      { transform: `translate(calc(-50% + ${dx * 0.75}px), calc(-50% + ${dy * 0.75}px)) scale(1.1) rotate(${rot * 0.6}deg)`, opacity: 1, offset: 0.4, easing: 'linear' },
      { transform: `translate(calc(-50% + ${dx * 0.95}px), calc(-50% + ${dy + spread * 0.25}px)) scale(1) rotate(${rot * 0.85}deg)`, opacity: 1, offset: 0.7, easing: 'ease-in' },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + spread * 0.6}px)) scale(0.6) rotate(${rot}deg)`, opacity: 0 },
    ], { duration, fill: 'forwards' }).onfinish = () => p.remove();
    setTimeout(() => p.remove(), duration + 300); // 画面が非表示で終了イベントが来なくても消す
  }
}

// 「+25 XP」が浮かび上がる
function floatText(x, y, text, big = false, small = false) {
  const layer = document.getElementById('fx-layer');
  const el = document.createElement('div');
  el.className = `fx-float ${big ? 'is-big' : ''} ${small ? 'is-small' : ''}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  layer.appendChild(el);
  if (reducedMotion()) { setTimeout(() => el.remove(), 900); return; }
  el.animate([
    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0, easing: 'cubic-bezier(0.2, 1.4, 0.4, 1)' },
    { transform: 'translate(-50%, -90%) scale(1.35)', opacity: 1, offset: 0.2, easing: 'ease-out' },
    { transform: 'translate(-50%, -150%) scale(1.2)', opacity: 1, offset: 0.75, easing: 'ease-in' },
    { transform: 'translate(-50%, -210%) scale(1)', opacity: 0 },
  ], { duration: 1400, fill: 'forwards' }).onfinish = () => el.remove();
  setTimeout(() => el.remove(), 1700);
}

// 経験値バーを光らせる
function pulseXpBar() {
  const bar = document.querySelector('.xp-bar');
  const badge = document.getElementById('level-badge');
  for (const el of [bar, badge]) {
    if (!el) continue;
    el.classList.remove('is-gaining');
    void el.offsetWidth; // アニメーションをやり直すためのリフロー
    el.classList.add('is-gaining');
    el.addEventListener('animationend', () => el.classList.remove('is-gaining'), { once: true });
  }
}

// 完了ボタンからの一連の演出
function celebrateComplete(button, xp, inTimer) {
  const { x, y } = centerOf(button);
  burstAt(x, y, inTimer ? 30 : 22, inTimer ? 160 : 130);
  floatText(x, y - 10, `+${xp} XP${inTimer ? ' ×1.5' : ''}`, inTimer);
  setTimeout(pulseXpBar, 350);
  const card = button.closest('.focus-card');
  if (card && !reducedMotion()) card.classList.add('is-cleared');
}

// レベルアップのお祝い
let levelUpTimer = null;
function celebrateLevelUp(level) {
  const overlay = document.getElementById('levelup');
  document.getElementById('levelup-level').textContent = `Lv.${level}`;
  document.getElementById('levelup-title').textContent = titleForLevel(level);
  overlay.hidden = false;
  overlay.classList.remove('is-leaving');

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  burstAt(cx, cy - 40, 36, 220);
  setTimeout(() => burstAt(cx - 90, cy + 20, 18, 140), 250);
  setTimeout(() => burstAt(cx + 90, cy + 20, 18, 140), 400);
  setTimeout(() => burstAt(cx, cy - 60, 26, 200), 900);

  clearTimeout(levelUpTimer);
  levelUpTimer = setTimeout(dismissLevelUp, 3200);
}

function dismissLevelUp() {
  const overlay = document.getElementById('levelup');
  if (overlay.hidden) return;
  clearTimeout(levelUpTimer);
  overlay.classList.add('is-leaving');
  setTimeout(() => { overlay.hidden = true; overlay.classList.remove('is-leaving'); }, 250);
}

function initEffects() {
  document.getElementById('levelup').addEventListener('click', dismissLevelUp);
}
