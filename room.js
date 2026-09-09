// 部屋のカードに描くエリアの絵。種類ごとに 3 段階（messy / normal / clean）
// 手描き風にするため、index.html の #wobble フィルタを通す

const ROOM_KINDS = {
  desk: '机',
  floor: '床',
  bed: 'ベッド',
  closet: 'クローゼット',
  kitchen: 'キッチン',
  bath: '洗面所・風呂',
  entrance: '玄関',
  shelf: '棚',
};

const C = {
  ink: '#5b4a3f',
  white: '#fffdf8',
  peach: '#f6c9b3',
  mint: '#bfe3d0',
  sky: '#c9ddf2',
  lav: '#dcd0f0',
  yellow: '#f7e3a1',
  pink: '#f4b8c8',
  wood: '#e8c9a0',
  wood2: '#d4ad82',
  gray: '#ddd6cc',
  green: '#9fcf9a',
  floor: '#f3e6d2',
  wall: '#fbf3e6',
};

const ST = `stroke="${C.ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"`;
const ST_THIN = `stroke="${C.ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;

// --- 基本図形 ---------------------------------------------------------

function rect(x, y, w, h, fill, opts = {}) {
  const rx = opts.rx ?? 3;
  const tf = opts.rot ? `transform="rotate(${opts.rot} ${x + w / 2} ${y + h / 2})"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${opts.thin ? ST_THIN : ST} ${tf}/>`;
}

function ellipse(cx, cy, rx, ry, fill, thin = false) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${thin ? ST_THIN : ST}/>`;
}

function circle(cx, cy, r, fill, thin = false) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${thin ? ST_THIN : ST}/>`;
}

function path(d, fill = 'none', opts = {}) {
  const tf = opts.rot ? `transform="rotate(${opts.rot} ${opts.cx} ${opts.cy})"` : '';
  return `<path d="${d}" fill="${fill}" ${opts.thin ? ST_THIN : ST} ${tf}/>`;
}

function line(x1, y1, x2, y2, thin = false) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${thin ? ST_THIN : ST}/>`;
}

// --- 小物 -------------------------------------------------------------

function sparkle(x, y, s = 5) {
  const d = `M${x},${y - s} L${x + s * 0.3},${y - s * 0.3} L${x + s},${y} L${x + s * 0.3},${y + s * 0.3} L${x},${y + s} L${x - s * 0.3},${y + s * 0.3} L${x - s},${y} L${x - s * 0.3},${y - s * 0.3} Z`;
  return `<path d="${d}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
}

function paper(x, y, rot = 0) {
  return `<g transform="rotate(${rot} ${x + 9} ${y + 6})">
    ${rect(x, y, 18, 13, C.white, { rx: 1, thin: true })}
    ${line(x + 3, y + 4, x + 13, y + 4, true)}
    ${line(x + 3, y + 8, x + 10, y + 8, true)}
  </g>`;
}

function paperStack(x, y, n = 3) {
  let s = '';
  for (let i = n - 1; i >= 0; i--) {
    s += rect(x + i * 0.6, y - i * 2.5, 24, 5, C.white, { rx: 1, thin: true });
  }
  return s;
}

function crumple(x, y) {
  const d = `M${x - 5},${y + 1} L${x - 3},${y - 4} L${x + 1},${y - 5} L${x + 5},${y - 2} L${x + 4},${y + 3} L${x},${y + 5} Z`;
  return `<path d="${d}" fill="${C.white}" ${ST_THIN}/>`;
}

function mug(x, y, fill = C.pink, rot = 0) {
  return `<g transform="rotate(${rot} ${x + 6} ${y + 6})">
    ${rect(x, y, 12, 12, fill, { rx: 2 })}
    ${path(`M${x + 12},${y + 3} q6,0 6,4 q0,4 -6,4`, 'none')}
  </g>`;
}

function plant(x, y, scale = 1) {
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    ${path('M-8,0 L8,0 L6,12 L-6,12 Z', C.peach)}
    ${ellipse(-6, -8, 5, 8, C.green)}
    ${ellipse(6, -9, 5, 8, C.green)}
    ${ellipse(0, -14, 5, 9, C.green)}
  </g>`;
}

function book(x, y, w, h, fill, rot = 0) {
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    ${rect(x, y, w, h, fill, { rx: 1 })}
    ${line(x + 3, y + 2, x + 3, y + h - 2, true)}
  </g>`;
}

function cloth(x, y, fill, rot = 0) {
  const d = `M${x - 12},${y} q4,-9 14,-7 q10,-3 14,4 q6,6 -3,9 q-9,5 -18,1 q-9,-1 -7,-7 Z`;
  return `<path d="${d}" fill="${fill}" ${ST} transform="rotate(${rot} ${x} ${y})"/>`;
}

function sock(x, y, fill, rot = 0) {
  const d = `M${x},${y} l0,9 q0,5 5,5 l5,0 q4,0 4,-4 q0,-3 -4,-3 l-3,0 l0,-7 Z`;
  return `<path d="${d}" fill="${fill}" ${ST_THIN} transform="rotate(${rot} ${x + 5} ${y + 7})"/>`;
}

function shoe(x, y, fill, rot = 0) {
  const d = `M${x},${y + 4} q0,-5 5,-5 l6,0 q4,2 8,3 q4,1 4,3 l0,2 l-23,0 Z`;
  return `<path d="${d}" fill="${fill}" ${ST_THIN} transform="rotate(${rot} ${x + 11} ${y + 3})"/>`;
}

function bottle(x, y, fill, h = 16, rot = 0) {
  return `<g transform="rotate(${rot} ${x + 3} ${y + h / 2})">
    ${rect(x, y, 7, h, fill, { rx: 2, thin: true })}
    ${rect(x + 1.5, y - 4, 4, 4, C.gray, { rx: 1, thin: true })}
  </g>`;
}

function heart(x, y, s = 4) {
  const d = `M${x},${y + s} C${x - s * 1.8},${y - s * 0.4} ${x - s * 0.5},${y - s * 1.6} ${x},${y - s * 0.4} C${x + s * 0.5},${y - s * 1.6} ${x + s * 1.8},${y - s * 0.4} ${x},${y + s} Z`;
  return `<path d="${d}" fill="${C.pink}" stroke="${C.ink}" stroke-width="1.4" stroke-linejoin="round"/>`;
}

function floorBase(y = 100) {
  return `<rect x="0" y="${y}" width="200" height="${130 - y}" fill="${C.floor}"/>
    ${line(0, y, 200, y)}`;
}

// --- 種類ごとの絵 ---------------------------------------------------

const DRAW = {
  desk(state) {
    let s = floorBase(104);
    // 机
    s += line(40, 80, 40, 104) + line(160, 80, 160, 104);
    s += rect(30, 70, 140, 10, C.wood, { rx: 2 });
    // モニター
    const tilt = state === 'messy' ? -3 : 0;
    s += `<g transform="rotate(${tilt} 105 55)">
      ${rect(80, 36, 50, 32, C.sky, { rx: 3 })}
      ${line(105, 68, 105, 70)}
      ${line(97, 70, 113, 70)}
    </g>`;
    if (state === 'clean') {
      s += paperStack(38, 66, 3);
      s += mug(136, 58, C.pink);
      s += plant(158, 66, 0.9);
      s += sparkle(60, 46, 5) + sparkle(168, 40, 4);
    } else if (state === 'normal') {
      s += paper(40, 58, -8) + paper(62, 60, 5);
      s += book(138, 62, 20, 8, C.lav, -4);
      s += mug(145, 50, C.pink, 6);
    } else {
      s += paper(34, 60, -14) + paper(52, 56, 10) + paper(140, 60, 18) + paper(64, 62, -4);
      s += book(130, 54, 22, 8, C.lav, -10) + book(134, 47, 18, 7, C.pink, 4);
      s += mug(150, 60, C.pink, -18);
      s += crumple(50, 98) + crumple(150, 100);
      s += path('M60,104 q10,-8 20,0 t20,0', 'none', { thin: true });
    }
    return s;
  },

  floor(state) {
    let s = floorBase(60);
    s += ellipse(100, 100, 62, 18, C.lav);
    s += ellipse(100, 100, 46, 12, C.white, true);
    if (state === 'clean') {
      s += plant(28, 70, 1.1);
      s += ellipse(150, 72, 16, 9, C.pink); // クッション
      s += sparkle(120, 82, 5) + sparkle(72, 90, 4);
    } else if (state === 'normal') {
      s += cloth(70, 96, C.sky, -10);
      s += book(120, 92, 22, 8, C.peach, 8);
      s += sock(150, 70, C.yellow, 20);
    } else {
      s += cloth(58, 92, C.sky, -10) + cloth(72, 104, C.peach, 15) + cloth(130, 90, C.yellow, -20) + cloth(140, 106, C.pink, 8);
      s += sock(96, 82, C.mint, -15) + sock(160, 66, C.lav, 30);
      s += book(100, 100, 22, 8, C.peach, 25) + book(30, 74, 20, 8, C.sky, -30);
      s += crumple(40, 100) + crumple(172, 96);
    }
    return s;
  },

  bed(state) {
    let s = floorBase(104);
    s += rect(30, 44, 12, 60, C.wood2, { rx: 3 }); // ヘッドボード
    s += rect(30, 72, 140, 28, C.wood, { rx: 3 });
    s += rect(42, 62, 128, 14, C.white, { rx: 3 }); // マットレス
    if (state === 'clean') {
      s += path('M78,62 L170,62 L170,76 L78,76 Z', C.sky);
      s += line(78, 66, 170, 66, true);
      s += ellipse(60, 66, 15, 6, C.peach); // 枕
      // ぬいぐるみ
      s += circle(150, 54, 6, C.peach) + circle(145, 49, 2.5, C.peach, true) + circle(155, 49, 2.5, C.peach, true);
      s += sparkle(100, 48, 5) + sparkle(176, 56, 4);
    } else if (state === 'normal') {
      s += path('M78,64 q20,-6 40,0 t52,-2 L170,76 L78,76 Z', C.sky);
      s += ellipse(60, 64, 15, 7, C.peach, false);
      s += cloth(120, 58, C.yellow, 10);
    } else {
      s += path('M76,66 q12,-14 26,-2 q10,-16 24,-4 q14,-14 24,0 q12,-8 20,4 L170,76 L76,76 Z', C.sky);
      s += ellipse(64, 60, 15, 7, C.peach);
      s += cloth(110, 54, C.yellow, -12) + cloth(150, 58, C.pink, 10);
      s += cloth(120, 100, C.lav, 5) + sock(50, 96, C.mint, -20);
    }
    return s;
  },

  closet(state) {
    let s = floorBase(110);
    s += rect(58, 18, 84, 92, C.wood, { rx: 4 });
    if (state === 'clean') {
      s += line(100, 22, 100, 106);
      s += circle(94, 64, 2.2, C.ink, true) + circle(106, 64, 2.2, C.ink, true);
      s += heart(100, 44, 4);
      s += sparkle(48, 30, 5) + sparkle(154, 48, 4);
      s += plant(160, 100, 0.9);
    } else if (state === 'normal') {
      s += line(100, 22, 100, 106);
      s += circle(94, 64, 2.2, C.ink, true);
      // 右扉が少し開く
      s += rect(100, 22, 30, 84, C.wood2, { rx: 2, rot: -8 });
      s += cloth(126, 88, C.sky, 20);
    } else {
      // 両扉が開いて中身が見える
      s += rect(62, 22, 76, 84, C.lav, { rx: 2, thin: true });
      s += rect(38, 24, 26, 82, C.wood2, { rx: 2, rot: 6 });
      s += rect(136, 24, 26, 82, C.wood2, { rx: 2, rot: -6 });
      s += cloth(80, 50, C.pink, -10) + cloth(112, 46, C.yellow, 12) + cloth(96, 68, C.sky, -6);
      s += cloth(70, 106, C.mint, -14) + cloth(130, 108, C.peach, 10) + sock(100, 96, C.yellow, 25);
    }
    return s;
  },

  kitchen(state) {
    let s = floorBase(110);
    s += rect(18, 74, 164, 36, C.mint, { rx: 3 }); // カウンター
    s += line(18, 82, 182, 82, true);
    s += rect(44, 68, 52, 10, C.gray, { rx: 3 }); // シンク
    s += path('M70,68 l0,-10 q0,-6 6,-6 l6,0', 'none'); // 蛇口
    s += rect(120, 64, 46, 12, C.gray, { rx: 3 }); // コンロ
    s += circle(132, 70, 4, C.ink, true) + circle(154, 70, 4, C.ink, true);
    if (state === 'clean') {
      s += sparkle(60, 56, 5) + sparkle(100, 48, 4);
      // やかん
      s += path('M126,64 q0,-14 12,-14 q12,0 12,14 Z', C.sky) + path('M132,50 q6,-6 12,0', 'none', { thin: true });
      s += path('M150,58 l8,-4', 'none', { thin: true });
      s += ellipse(30, 74, 6, 1.6, C.white, true);
    } else if (state === 'normal') {
      s += ellipse(60, 66, 12, 3, C.white, true) + ellipse(60, 62, 12, 3, C.white, true) + ellipse(60, 58, 12, 3, C.white, true);
      s += rect(140, 52, 22, 12, C.lav, { rx: 3 }) + line(162, 56, 172, 54);
      s += mug(28, 62, C.pink, 5);
    } else {
      for (let i = 0; i < 6; i++) s += ellipse(60, 66 - i * 4, 12, 3, C.white, true);
      s += rect(126, 50, 22, 14, C.lav, { rx: 3 }) + rect(150, 46, 16, 18, C.peach, { rx: 3, rot: 8 });
      s += mug(24, 60, C.pink, -12) + mug(104, 66, C.sky, 15);
      s += circle(36, 96, 2, C.ink, true) + circle(44, 90, 1.6, C.ink, true) + circle(168, 94, 2.2, C.ink, true);
      s += ellipse(112, 96, 9, 3, C.sky, true);
    }
    return s;
  },

  bath(state) {
    let s = `<rect x="0" y="0" width="200" height="130" fill="${C.sky}" opacity="0.35"/>` + floorBase(108);
    s += rect(72, 20, 56, 38, C.white, { rx: 8 }); // 鏡
    s += ellipse(100, 74, 42, 9, C.white); // 洗面台
    s += path('M100,60 l0,8', 'none') + path('M94,60 q6,-6 12,0', 'none');
    s += rect(58, 80, 84, 28, C.lav, { rx: 3 }); // 収納
    s += line(100, 84, 100, 104, true);
    if (state === 'clean') {
      s += sparkle(84, 30, 5) + sparkle(118, 46, 4);
      s += bottle(150, 62, C.mint, 14);
      s += rect(30, 90, 22, 12, C.peach, { rx: 3 }) + line(30, 96, 52, 96, true); // 畳んだタオル
    } else if (state === 'normal') {
      s += bottle(146, 60, C.mint, 14) + bottle(156, 62, C.pink, 12);
      s += path('M40,60 q-6,20 6,40', C.peach); // かかったタオル
    } else {
      s += bottle(142, 56, C.mint, 16) + bottle(152, 60, C.pink, 12, 14) + bottle(38, 56, C.yellow, 14, -20) + bottle(160, 100, C.sky, 12, 80);
      s += cloth(36, 114, C.peach, -8);
      s += line(60, 66, 66, 52, true) + circle(66, 51, 2, C.pink, true); // 歯ブラシ
      s += circle(84, 48, 2, C.sky, true) + circle(120, 40, 2.5, C.sky, true) + circle(110, 54, 1.8, C.sky, true);
    }
    return s;
  },

  entrance(state) {
    let s = floorBase(108);
    s += rect(74, 14, 52, 94, C.peach, { rx: 3 }); // ドア
    s += rect(82, 24, 36, 34, C.sky, { rx: 3, thin: true }); // 窓
    s += circle(116, 70, 3, C.ink, true);
    s += rect(56, 110, 88, 8, C.lav, { rx: 2 }); // マット
    if (state === 'clean') {
      s += shoe(66, 112, C.pink) + shoe(90, 112, C.sky);
      s += plant(160, 106, 1);
      s += sparkle(40, 60, 5) + sparkle(150, 40, 4);
    } else if (state === 'normal') {
      s += shoe(60, 111, C.pink, -8) + shoe(100, 114, C.sky, 12);
      s += path('M156,60 l4,44', 'none') + path('M150,64 q10,-14 20,0', C.yellow); // 傘
    } else {
      s += shoe(40, 112, C.pink, -20) + shoe(72, 110, C.sky, 15) + shoe(112, 116, C.pink, 30) + shoe(140, 108, C.mint, -12) + shoe(168, 112, C.sky, 8);
      s += line(40, 84, 66, 104) + path('M26,78 q14,-16 28,-2 Z', C.yellow, { rot: 36, cx: 40, cy: 76 });
      s += rect(148, 82, 24, 22, C.lav, { rx: 3, rot: -10 }) + path('M154,82 q6,-10 12,0', 'none');
      s += paper(26, 60, -12) + paper(164, 56, 10);
    }
    return s;
  },

  shelf(state) {
    let s = floorBase(110);
    s += rect(50, 16, 100, 94, C.wood, { rx: 3 });
    s += line(50, 46, 150, 46) + line(50, 78, 150, 78);
    const colors = [C.sky, C.pink, C.mint, C.yellow, C.lav, C.peach];
    if (state === 'clean') {
      for (let i = 0; i < 8; i++) s += rect(56 + i * 10, 22 + (i % 3) * 2, 8, 22 - (i % 3) * 2, colors[i % 6], { rx: 1, thin: true });
      for (let i = 0; i < 5; i++) s += rect(56 + i * 10, 54, 8, 22, colors[(i + 2) % 6], { rx: 1, thin: true });
      s += plant(124, 76, 0.8);
      s += rect(56, 88, 30, 18, C.white, { rx: 2 }) + rect(92, 88, 30, 18, C.white, { rx: 2 });
      s += sparkle(160, 30, 5) + sparkle(38, 70, 4);
    } else if (state === 'normal') {
      for (let i = 0; i < 6; i++) s += rect(56 + i * 10, 22, 8, 22, colors[i % 6], { rx: 1, thin: true, rot: i === 5 ? -18 : 0 });
      s += rect(56, 54, 8, 22, C.pink, { rx: 1, thin: true }) + rect(66, 54, 8, 22, C.mint, { rx: 1, thin: true });
      s += rect(84, 66, 24, 8, C.sky, { rx: 1, thin: true, rot: 4 });
      s += rect(56, 88, 30, 18, C.white, { rx: 2 }) + rect(94, 84, 30, 22, C.white, { rx: 2, rot: -6 });
      s += mug(130, 60, C.yellow, 6);
    } else {
      for (let i = 0; i < 4; i++) s += rect(56 + i * 10, 22, 8, 22, colors[i % 6], { rx: 1, thin: true, rot: i === 3 ? -30 : 0 });
      s += rect(104, 36, 24, 8, C.lav, { rx: 1, thin: true }) + rect(110, 28, 24, 8, C.peach, { rx: 1, thin: true, rot: 6 });
      s += rect(58, 68, 24, 8, C.sky, { rx: 1, thin: true, rot: -8 }) + rect(90, 56, 8, 22, C.mint, { rx: 1, thin: true, rot: 40 });
      s += rect(56, 90, 36, 18, C.white, { rx: 2, rot: 5 }) + cloth(120, 96, C.pink, -10);
      s += book(20, 100, 22, 8, C.lav, 12) + book(160, 102, 22, 8, C.sky, -14) + crumple(176, 90);
    }
    return s;
  },
};

function renderRoomArt(kind, state) {
  const draw = DRAW[kind] || DRAW.shelf;
  return `<svg viewBox="0 10 200 112" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <g filter="url(#wobble)">${draw(state)}</g>
  </svg>`;
}
