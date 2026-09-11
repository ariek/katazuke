// クエスト（カテゴリー）に使える色とアイコンの一覧。
// アイコンは起動時に index.html のシンボル集へ <symbol> として追加する

const CATEGORY_COLORS = [
  { id: 'peach', name: '桃', hex: '#f6c9b3' },
  { id: 'yellow', name: '黄', hex: '#f7e3a1' },
  { id: 'mint', name: '緑', hex: '#bfe3d0' },
  { id: 'sky', name: '水色', hex: '#c9ddf2' },
  { id: 'lav', name: '薄紫', hex: '#dcd0f0' },
  { id: 'pink', name: 'ピンク', hex: '#f4b8c8' },
  { id: 'orange', name: '橙', hex: '#f8d3a3' },
  { id: 'gray', name: '灰', hex: '#ddd6cc' },
];

const DEFAULT_COLOR = 'gray';
const DEFAULT_ICON = 'star';

// 線は currentColor、塗りは --icon-fill-a（クエストの色を入れる）
const CATEGORY_ICONS = [
  ['briefcase', '仕事', '<rect x="3" y="7" width="18" height="13" rx="2.5" style="fill:var(--icon-fill-a, none)"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3 12h18" fill="none"/>'],
  ['house', '家', '<path d="M3.5 11.5 12 4l8.5 7.5" fill="none"/><path d="M5.5 10.5V20h13v-9.5" style="fill:var(--icon-fill-a, none)"/><path d="M10 20v-5.5h4V20" fill="none"/>'],
  ['book', '本', '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z" style="fill:var(--icon-fill-a, none)"/><path d="M5 17a2 2 0 0 1 2-2h12M9 8h6" fill="none"/>'],
  ['heart', 'ハート', '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z" style="fill:var(--icon-fill-a, none)"/>'],
  ['cart', 'カート', '<path d="M3 5h2.5l2 10h10l2-7H7" style="fill:var(--icon-fill-a, none)"/><circle cx="9" cy="19" r="1.6" fill="none"/><circle cx="16.5" cy="19" r="1.6" fill="none"/>'],
  ['coin', 'コイン', '<circle cx="12" cy="12" r="8.5" style="fill:var(--icon-fill-a, none)"/><path d="M9 9.5l3 4 3-4M12 13.5V17M9.5 14.5h5" fill="none"/>'],
  ['person', '人', '<circle cx="12" cy="8" r="4" style="fill:var(--icon-fill-a, none)"/><path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6" style="fill:var(--icon-fill-a, none)"/>'],
  ['star', '星', '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8Z" style="fill:var(--icon-fill-a, none)"/>'],
  ['car', '車', '<path d="M4 14l1.5-5A2 2 0 0 1 7.4 7.5h9.2a2 2 0 0 1 1.9 1.5L20 14v4H4v-4Z" style="fill:var(--icon-fill-a, none)"/><circle cx="8" cy="18" r="1.6" fill="none"/><circle cx="16" cy="18" r="1.6" fill="none"/><path d="M4 14h16" fill="none"/>'],
  ['food', '食事', '<path d="M6 3v8M4 3v4a2 2 0 0 0 4 0V3M6 11v10" fill="none"/><path d="M17 3c-2 0-3 2.5-3 6v3h3v9" style="fill:var(--icon-fill-a, none)"/>'],
  ['broom', 'ほうき', '<path d="M14 3 8.5 12.5" fill="none"/><path d="M6 13.5l4-2 4.5 3-2.5 5.5L5.5 18Z" style="fill:var(--icon-fill-a, none)"/><path d="M8 15.5l1.5 3.5M11 14.5l1 3.5" fill="none"/>'],
  ['shirt', 'シャツ', '<path d="M8 4 4 7l2 3.5 2-1V20h8v-10.5l2 1L20 7l-4-3a4 4 0 0 1-8 0Z" style="fill:var(--icon-fill-a, none)"/>'],
  ['phone', '電話', '<rect x="7" y="3" width="10" height="18" rx="2.5" style="fill:var(--icon-fill-a, none)"/><path d="M10.5 17.5h3" fill="none"/>'],
  ['mail', 'メール', '<rect x="3" y="6" width="18" height="13" rx="2.5" style="fill:var(--icon-fill-a, none)"/><path d="m4 8 8 6 8-6" fill="none"/>'],
  ['laptop', 'PC', '<rect x="5" y="5" width="14" height="10" rx="2" style="fill:var(--icon-fill-a, none)"/><path d="M3 18h18M8 18l1-3h6l1 3" fill="none"/>'],
  ['dumbbell', '運動', '<path d="M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12" fill="none"/><rect x="6" y="8" width="3" height="8" rx="1" style="fill:var(--icon-fill-a, none)"/><rect x="15" y="8" width="3" height="8" rx="1" style="fill:var(--icon-fill-a, none)"/>'],
  ['music', '音楽', '<path d="M10 17V5l9-2v12" fill="none"/><circle cx="7" cy="17" r="3" style="fill:var(--icon-fill-a, none)"/><circle cx="16" cy="15" r="3" style="fill:var(--icon-fill-a, none)"/>'],
  ['suitcase', '旅行', '<rect x="4" y="8" width="16" height="12" rx="2.5" style="fill:var(--icon-fill-a, none)"/><path d="M9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M8 8v12M16 8v12" fill="none"/>'],
  ['paw', 'ペット', '<circle cx="7" cy="9" r="2" style="fill:var(--icon-fill-a, none)"/><circle cx="12" cy="6.5" r="2" style="fill:var(--icon-fill-a, none)"/><circle cx="17" cy="9" r="2" style="fill:var(--icon-fill-a, none)"/><path d="M12 11c3 0 5.5 3 5.5 5.5A2.5 2.5 0 0 1 15 19h-6a2.5 2.5 0 0 1-2.5-2.5C6.5 14 9 11 12 11Z" style="fill:var(--icon-fill-a, none)"/>'],
  ['leaf', '植物', '<path d="M5 19c0-8 5-13 14-13-.5 9-5 14-11 14-1 0-2-.3-3-1Z" style="fill:var(--icon-fill-a, none)"/><path d="M5 19c3-4 6-7 10-9" fill="none"/>'],
  ['file', '書類', '<path d="M6 3h8l4 4v14H6V3Z" style="fill:var(--icon-fill-a, none)"/><path d="M14 3v4h4M9 12h6M9 16h6" fill="none"/>'],
  ['calendar', 'カレンダー', '<rect x="4" y="6" width="16" height="14" rx="2.5" style="fill:var(--icon-fill-a, none)"/><path d="M4 10.5h16M8 3.5v4M16 3.5v4" fill="none"/>'],
  ['clock', '時計', '<circle cx="12" cy="12" r="8.5" style="fill:var(--icon-fill-a, none)"/><path d="M12 7.5V12l3 2" fill="none"/>'],
  ['flag', '旗', '<path d="M6 21V4" fill="none"/><path d="M6 4h11l-2.5 4 2.5 4H6" style="fill:var(--icon-fill-a, none)"/>'],
  ['bulb', 'アイデア', '<path d="M8 14a6 6 0 1 1 8 0v2H8v-2Z" style="fill:var(--icon-fill-a, none)"/><path d="M9.5 19h5M10.5 21h3" fill="none"/>'],
  ['wrench', '工具', '<path d="M14.5 4a5 5 0 0 0-4.6 6.9L4 16.8 6.2 19l5.9-5.9A5 5 0 0 0 19 8.5l-2.8 1.3-2.2-2.2L15.3 4.8A5 5 0 0 0 14.5 4Z" style="fill:var(--icon-fill-a, none)"/>'],
  ['gift', 'ギフト', '<rect x="4" y="10" width="16" height="10" rx="2" style="fill:var(--icon-fill-a, none)"/><path d="M3 7h18v3H3zM12 7v13M12 7c-1.5-3.5-5-3.5-5-1.5S10 7 12 7Zm0 0c1.5-3.5 5-3.5 5-1.5S14 7 12 7Z" fill="none"/>'],
  ['camera', 'カメラ', '<path d="M4 8h3.5l1.5-2h6l1.5 2H20v11H4V8Z" style="fill:var(--icon-fill-a, none)"/><circle cx="12" cy="13" r="3.2" fill="none"/>'],
  ['gamepad', 'ゲーム', '<path d="M7 8h10a4 4 0 0 1 4 4.5l-.6 4a2 2 0 0 1-3.6.9L15 15H9l-1.8 2.4a2 2 0 0 1-3.6-.9L3 12.5A4 4 0 0 1 7 8Z" style="fill:var(--icon-fill-a, none)"/><path d="M8 11v3M6.5 12.5h3M15.5 11.5h.01M17.5 13h.01" fill="none"/>'],
  ['pen', 'ペン', '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" style="fill:var(--icon-fill-a, none)"/><path d="M13.5 8l3 3" fill="none"/>'],
  ['bed', '寝室', '<path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3H10v3" fill="none"/><rect x="4" y="9" width="5" height="4" rx="1.5" style="fill:var(--icon-fill-a, none)"/>'],
  ['bath', 'お風呂', '<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3Z" style="fill:var(--icon-fill-a, none)"/><path d="M6 12V6a2 2 0 0 1 4 0M7 20v1M17 20v1" fill="none"/>'],
  ['pot', '料理', '<path d="M4 10h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5Z" style="fill:var(--icon-fill-a, none)"/><path d="M2 10h20M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3" fill="none"/>'],
  ['bike', '自転車', '<circle cx="6" cy="16" r="3.5" style="fill:var(--icon-fill-a, none)"/><circle cx="18" cy="16" r="3.5" style="fill:var(--icon-fill-a, none)"/><path d="M6 16l4-7h5l3 7M10 9h6M12.5 16l2.5-7" fill="none"/>'],
  ['chat', '連絡', '<path d="M4 5h16v10H10l-4 4v-4H4V5Z" style="fill:var(--icon-fill-a, none)"/><path d="M8 9h8M8 12h5" fill="none"/>'],
  ['trophy', 'トロフィー', '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" style="fill:var(--icon-fill-a, none)"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8.5 18h7" fill="none"/>'],
];

function categoryColorHex(id) {
  const c = CATEGORY_COLORS.find((x) => x.id === id) || CATEGORY_COLORS.find((x) => x.id === DEFAULT_COLOR);
  return c.hex;
}

function categoryIconId(id) {
  return CATEGORY_ICONS.some(([name]) => name === id) ? id : DEFAULT_ICON;
}

// クエストの色付きアイコン（丸い札）
function categoryIconHtml(cat, cls = 'cat-icon') {
  const color = categoryColorHex(cat ? cat.color : DEFAULT_COLOR);
  const icon = categoryIconId(cat ? cat.icon : DEFAULT_ICON);
  return `<span class="${cls}" style="--cat-color:${color}"><svg class="icon" aria-hidden="true"><use href="#c-${icon}"/></svg></span>`;
}

// シンボル集にクエスト用アイコンを追加する（起動時に1回）
function injectCategoryIcons() {
  const defs = document.querySelector('svg defs');
  if (!defs || defs.querySelector('#c-star')) return;
  for (const [name, , body] of CATEGORY_ICONS) {
    const sym = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    sym.setAttribute('id', `c-${name}`);
    sym.setAttribute('viewBox', '0 0 24 24');
    sym.innerHTML = body;
    defs.appendChild(sym);
  }
}
