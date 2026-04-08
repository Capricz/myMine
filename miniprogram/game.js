/**
 * 微信小游戏 - 扫雷（基础难度：9x9，10 雷）
 * 短按：翻开（？格会先清除标记再翻开）；长按（约 0.45s）：无标记→🚩→？→还原
 * 短时内同一格连点两下：对已翻开的数字「和弦」——周围旗数=数字则翻开其余未开格，否则不翻开
 * 首页：开始 / 关于；扫雷顶栏：重新开始、退出（回首页）
 * 雷区上方：总雷数、剩余雷数（剩余=总数-已插旗）
 * 当「未翻开格数」等于「剩余未标雷数」（总数-已插旗）时，自动将未插旗的未翻开格标为 🚩
 */

const sys = wx.getSystemInfoSync();
const canvas = wx.createCanvas();
canvas.width = sys.windowWidth;
canvas.height = sys.windowHeight;
const ctx = canvas.getContext('2d');

const ROWS = 9;
const COLS = 9;
const MINE_COUNT = 10;

const TOP_BAR = 96;
const MINE_INFO_H = 44;
const PAD = 8;
const gridAvailW = canvas.width - PAD * 2;
const gridAvailH = canvas.height - TOP_BAR - MINE_INFO_H - PAD * 2;
const CELL = Math.floor(Math.min(gridAvailW / COLS, gridAvailH / ROWS));
const GRID_W = CELL * COLS;
const GRID_H = CELL * ROWS;
const ORIGIN_X = (canvas.width - GRID_W) / 2;
const ORIGIN_Y = TOP_BAR + MINE_INFO_H + PAD;

const SCREEN_HOME = 0;
const SCREEN_GAME = 1;
const SCREEN_ABOUT = 2;
let screen = SCREEN_HOME;

const BTN_HOME_START = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.4,
  w: 200,
  h: 48
};
const BTN_HOME_ABOUT = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.4 + 58,
  w: 200,
  h: 48
};
const BTN_ABOUT_BACK = {
  x: canvas.width / 2 - 55,
  y: canvas.height - 76,
  w: 110,
  h: 44
};

const BTN_GAME_RESTART = {
  x: 10,
  y: 22,
  w: 92,
  h: 40
};
const BTN_GAME_EXIT = {
  x: canvas.width - 102,
  y: 22,
  w: 92,
  h: 40
};

function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function drawButton(rect, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

const MARK_NONE = 0;
const MARK_FLAG = 1;
const MARK_QUESTION = 2;

let mines = [];
let revealed = [];
let mark = [];
let gameOver = false;
let win = false;
let started = false;
let startTime = Date.now();

function initArrays() {
  mines = [];
  revealed = [];
  mark = [];
  for (let i = 0; i < ROWS; i++) {
    mines[i] = [];
    revealed[i] = [];
    mark[i] = [];
    for (let j = 0; j < COLS; j++) {
      mines[i][j] = false;
      revealed[i][j] = false;
      mark[i][j] = MARK_NONE;
    }
  }
  gameOver = false;
  win = false;
  started = false;
}

function countMines(si, sj) {
  let c = 0;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const ni = si + di;
      const nj = sj + dj;
      if (ni >= 0 && ni < ROWS && nj >= 0 && nj < COLS && mines[ni][nj]) c++;
    }
  }
  return c;
}

function placeMines(excludeI, excludeJ) {
  const forbidden = new Set();
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      const ni = excludeI + di;
      const nj = excludeJ + dj;
      if (ni >= 0 && ni < ROWS && nj >= 0 && nj < COLS) {
        forbidden.add(ni * COLS + nj);
      }
    }
  }
  let placed = 0;
  while (placed < MINE_COUNT) {
    const idx = Math.floor(Math.random() * (ROWS * COLS));
    if (forbidden.has(idx)) continue;
    const ri = Math.floor(idx / COLS);
    const rj = idx % COLS;
    if (mines[ri][rj]) continue;
    mines[ri][rj] = true;
    placed++;
  }
}

function cellNumber(i, j) {
  if (mines[i][j]) return -1;
  return countMines(i, j);
}

function floodReveal(si, sj) {
  const stack = [[si, sj]];
  while (stack.length) {
    const [i, j] = stack.pop();
    if (i < 0 || i >= ROWS || j < 0 || j >= COLS) continue;
    if (mark[i][j] === MARK_FLAG) continue;
    if (revealed[i][j]) continue;
    if (mark[i][j] === MARK_QUESTION) mark[i][j] = MARK_NONE;
    revealed[i][j] = true;
    const n = cellNumber(i, j);
    if (n === 0) {
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue;
          stack.push([i + di, j + dj]);
        }
      }
    }
  }
}

function checkWin() {
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      if (!mines[i][j] && !revealed[i][j]) return false;
    }
  }
  return true;
}

// 当判定赢了：所有真实雷格子，若未标为 🚩（红旗），则强制补标为 🚩
function applyWinFlags() {
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      if (mines[i][j] && mark[i][j] !== MARK_FLAG) {
        mark[i][j] = MARK_FLAG;
      }
    }
  }
}

function revealCell(i, j) {
  if (gameOver || win) return;
  if (mark[i][j] === MARK_FLAG) return;
  if (revealed[i][j]) return;
  if (mark[i][j] === MARK_QUESTION) mark[i][j] = MARK_NONE;
  if (!started) {
    started = true;
    placeMines(i, j);
  }
  if (mines[i][j]) {
    revealed[i][j] = true;
    gameOver = true;
    for (let a = 0; a < ROWS; a++) {
      for (let b = 0; b < COLS; b++) {
        if (mines[a][b]) revealed[a][b] = true;
      }
    }
    return;
  }
  const n = cellNumber(i, j);
  if (n === 0) {
    floodReveal(i, j);
  } else {
    revealed[i][j] = true;
  }
  if (checkWin()) {
    win = true;
    applyWinFlags();
  }
  tryAutoFlag();
}

function countUnrevealed() {
  let c = 0;
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      if (!revealed[i][j]) c++;
    }
  }
  return c;
}

/**
 * 剩余空白格数 = 剩余需标出的雷数（总雷数-已插旗）时，未翻开且未插旗的格必为雷，自动插旗
 */
function tryAutoFlag() {
  if (gameOver || win || !started) return;
  const u = countUnrevealed();
  const r = MINE_COUNT - flagCount();
  if (u === 0 || u !== r) return;
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      if (!revealed[i][j] && mark[i][j] !== MARK_FLAG) {
        mark[i][j] = MARK_FLAG;
      }
    }
  }
  if (checkWin()) {
    win = true;
    applyWinFlags();
  }
}

function cycleMark(i, j) {
  if (gameOver || win) return;
  if (revealed[i][j]) return;
  mark[i][j] = (mark[i][j] + 1) % 3;
  tryAutoFlag();
}

function flagCount() {
  let f = 0;
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      if (mark[i][j] === MARK_FLAG) f++;
    }
  }
  return f;
}

function countNeighborFlags(i, j) {
  let c = 0;
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue;
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= ROWS || nj < 0 || nj >= COLS) continue;
      if (mark[ni][nj] === MARK_FLAG) c++;
    }
  }
  return c;
}

/**
 * 双击数字格：仅当周围 🚩 数量等于该格数字时，翻开周围其余未翻开的格（问号会先被当普通格翻开）
 * 若旗数与数字不一致，不翻开任何格。返回是否按「和弦」规则处理并结束（不再走普通短按翻开）
 */
function chordReveal(i, j) {
  if (gameOver || win) return true;
  if (!started) return false;
  if (!revealed[i][j]) return false;
  if (mines[i][j]) return false;
  const n = cellNumber(i, j);
  if (n <= 0) return false;
  if (countNeighborFlags(i, j) !== n) return false;

  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue;
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= ROWS || nj < 0 || nj >= COLS) continue;
      if (mark[ni][nj] === MARK_FLAG) continue;
      if (revealed[ni][nj]) continue;
      revealCell(ni, nj);
      if (gameOver) return true;
    }
  }
  return true;
}

function screenToCell(x, y) {
  if (x < ORIGIN_X || y < ORIGIN_Y) return null;
  const j = Math.floor((x - ORIGIN_X) / CELL);
  const i = Math.floor((y - ORIGIN_Y) / CELL);
  if (i < 0 || i >= ROWS || j < 0 || j >= COLS) return null;
  return { i: i, j: j };
}

const NUM_COLORS = [
  '',
  '#0000ee',
  '#008200',
  '#ee0000',
  '#000084',
  '#840000',
  '#008484',
  '#000000',
  '#848484'
];

function drawNaturalBackground(t) {
  const w = canvas.width;
  const h = canvas.height;
  const phase = t * 0.00012;
  const g = ctx.createLinearGradient(0, 0, w, h);
  const h1 = 0.5 + 0.5 * Math.sin(phase);
  const h2 = 0.5 + 0.5 * Math.cos(phase * 0.7);
  g.addColorStop(0, 'rgb(' + Math.floor(120 + 40 * h1) + ',' + Math.floor(180 + 50 * h2) + ',' + Math.floor(220 + 30 * h1) + ')');
  g.addColorStop(0.45, 'rgb(' + Math.floor(170 + 30 * h2) + ',' + Math.floor(210 + 40 * h1) + ',' + Math.floor(160 + 40 * h2) + ')');
  g.addColorStop(1, 'rgb(' + Math.floor(90 + 40 * h1) + ',' + Math.floor(140 + 30 * h2) + ',' + Math.floor(100 + 20 * h1) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let k = 0; k < 18; k++) {
    const sx = (w * 0.13 * k + t * 0.012 * (1 + k * 0.07)) % (w + 80) - 40;
    const sy = h * (0.15 + (k % 5) * 0.18) + Math.sin(t * 0.001 + k) * 12;
    const rr = 28 + (k % 4) * 14;
    const cg = ctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    cg.addColorStop(0, 'rgba(255,255,255,0.55)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(sx, sy, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBevelCell(x, y, size, raised) {
  const light = raised ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.22)';
  const dark = raised ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.35)';
  ctx.fillStyle = 'rgba(210,220,215,0.92)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = light;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.lineTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x, y + size);
  ctx.stroke();
}

function drawCell(i, j) {
  const x = ORIGIN_X + j * CELL;
  const y = ORIGIN_Y + i * CELL;
  const pad = 1;
  if (!revealed[i][j]) {
    drawBevelCell(x + pad, y + pad, CELL - pad * 2, true);
    if (mark[i][j] === MARK_FLAG) {
      ctx.font = Math.floor(CELL * 0.5) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83D\uDEA9', x + CELL / 2, y + CELL / 2 + 1);
    } else if (mark[i][j] === MARK_QUESTION) {
      ctx.fillStyle = '#333';
      ctx.font = 'bold ' + Math.floor(CELL * 0.48) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + CELL / 2, y + CELL / 2 + 1);
    }
    return;
  }
  ctx.fillStyle = 'rgba(200,205,200,0.95)';
  ctx.fillRect(x + pad, y + pad, CELL - pad * 2, CELL - pad * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, CELL - pad * 2 - 1, CELL - pad * 2 - 1);
  if (mines[i][j]) {
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.22, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const n = cellNumber(i, j);
  if (n > 0) {
    ctx.fillStyle = NUM_COLORS[n] || '#000';
    ctx.font = 'bold ' + Math.floor(CELL * 0.52) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), x + CELL / 2, y + CELL / 2 + 1);
  }
}

function drawMineInfoBar() {
  const y0 = TOP_BAR;
  const h = MINE_INFO_H;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, y0, canvas.width, h);

  const total = MINE_COUNT;
  const remain = total - flagCount();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const midY = y0 + h / 2 - 2;
  ctx.fillText(
    '\u5171 ' + total + ' \u9897\u96f7  \u5269\u4f59 ' + remain + ' \u9897',
    canvas.width / 2,
    midY
  );
}

function drawHome() {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u826f\u4e4b\u96f7', canvas.width / 2, canvas.height * 0.2);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('\u626b\u96f7', canvas.width / 2, canvas.height * 0.2 + 38);
  drawButton(BTN_HOME_START, '\u5f00\u59cb');
  drawButton(BTN_HOME_ABOUT, '\u5173\u4e8e');
}

function drawAbout() {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('\u5173\u4e8e \u826f\u4e4b\u96f7', canvas.width / 2, 44);
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  const padX = 24;
  const lines = [
    '\u826f\u4e4b\u96f7\u662f\u8f7b\u91cf\u7ebf\u4e0a\u4f11\u95f2\u4ea7\u54c1\uff0c\u5173\u6ce8\u8f7b\u677e\u3001\u81ea\u7136\u7684\u4f11\u95f2\u4f53\u9a8c\u3002',
    '\u672c\u626b\u96f7\u5c0f\u6e38\u620f\u4e3a\u826f\u4e4b\u96f7\u4f53\u9a8c\u793a\u4f8b\uff0c\u4ec5\u4f9b\u5a31\u4e50\u4e0e\u5b66\u4e60\u4ea4\u6d41\u3002',
    '\u611f\u8c22\u4f7f\u7528\u826f\u4e4b\u96f7\u3002'
  ];
  let ly = 96;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padX, ly);
    ly += 28;
  }
  drawButton(BTN_ABOUT_BACK, '\u8fd4\u56de');
}

function drawTopBar() {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, canvas.width, TOP_BAR - 4);

  drawButton(BTN_GAME_RESTART, '\u91cd\u65b0\u5f00\u59cb');
  drawButton(BTN_GAME_EXIT, '\u9000\u51fa');

  ctx.textAlign = 'center';
  ctx.fillStyle = win ? '#2ecc71' : gameOver ? '#e74c3c' : 'rgba(255,255,255,0.95)';
  ctx.font = '15px sans-serif';
  ctx.textBaseline = 'middle';
  if (win) {
    ctx.fillText('\u8d62\u4e86', canvas.width / 2, TOP_BAR / 2 - 2);
  } else if (gameOver) {
    ctx.fillText('\u8e29\u96f7', canvas.width / 2, TOP_BAR / 2 - 2);
  } else {
    ctx.fillText('\u263a', canvas.width / 2, TOP_BAR / 2 - 2);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    '\u77ed\u6309\u7ffb\u5f00 \u00b7 \u8fde\u70b9\u6570\u5b57\u548c\u5f26 \u00b7 \u957f\u6309\uff1a\uD83D\uDEA9\u2192\uff1f\u2192\u8fd8\u539f',
    canvas.width / 2,
    TOP_BAR - 18
  );
}

function drawGridFrame() {
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(ORIGIN_X - 2, ORIGIN_Y - 2, GRID_W + 4, GRID_H + 4);
}

function renderFrame() {
  const t = Date.now() - startTime;
  drawNaturalBackground(t);
  if (screen === SCREEN_HOME) {
    drawHome();
    return;
  }
  if (screen === SCREEN_ABOUT) {
    drawAbout();
    return;
  }
  drawMineInfoBar();
  drawGridFrame();
  for (let i = 0; i < ROWS; i++) {
    for (let j = 0; j < COLS; j++) {
      drawCell(i, j);
    }
  }
  drawTopBar();
}

const raf =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (cb) {
        return setTimeout(function () {
          cb(Date.now());
        }, 16);
      };

function loop() {
  renderFrame();
  raf(loop);
}

initArrays();
loop();

let touchStart = null;
let lastShortTap = null;
const DOUBLE_TAP_MS = 380;

wx.onTouchStart(function (e) {
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
});

wx.onTouchEnd(function (e) {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dt = Date.now() - touchStart.time;
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const x = t.clientX;
  const y = t.clientY;
  touchStart = null;

  if (dist > 18) return;

  if (screen === SCREEN_HOME) {
    if (pointInRect(x, y, BTN_HOME_START)) {
      screen = SCREEN_GAME;
      initArrays();
      startTime = Date.now();
      lastShortTap = null;
      return;
    }
    if (pointInRect(x, y, BTN_HOME_ABOUT)) {
      screen = SCREEN_ABOUT;
      return;
    }
    return;
  }

  if (screen === SCREEN_ABOUT) {
    if (pointInRect(x, y, BTN_ABOUT_BACK)) {
      screen = SCREEN_HOME;
    }
    return;
  }

  if (pointInRect(x, y, BTN_GAME_RESTART)) {
    initArrays();
    startTime = Date.now();
    lastShortTap = null;
    return;
  }
  if (pointInRect(x, y, BTN_GAME_EXIT)) {
    screen = SCREEN_HOME;
    lastShortTap = null;
    return;
  }

  const cell = screenToCell(x, y);
  if (!cell) return;

  if (dt >= 450) {
    cycleMark(cell.i, cell.j);
    lastShortTap = null;
    return;
  }

  const now = Date.now();
  const doubleTap =
    lastShortTap &&
    lastShortTap.i === cell.i &&
    lastShortTap.j === cell.j &&
    now - lastShortTap.time <= DOUBLE_TAP_MS;

  if (doubleTap && chordReveal(cell.i, cell.j)) {
    lastShortTap = null;
    return;
  }

  revealCell(cell.i, cell.j);
  lastShortTap = { i: cell.i, j: cell.j, time: now };
});
