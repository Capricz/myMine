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

let ROWS = 9;
let COLS = 9;
let MINE_COUNT = 10;

const TOP_BAR = 96;
const MINE_INFO_H = 44;
const PAD = 8;
let CELL = 0;
let GRID_W = 0;
let GRID_H = 0;
let ORIGIN_X = 0;
let ORIGIN_Y = 0;

function maxMineCount() {
  // 预留首次点击的 3x3 安全区
  return Math.max(1, ROWS * COLS - 9);
}

function clampMineCount(n) {
  return Math.max(1, Math.min(n, maxMineCount()));
}

function recalcBoardLayout() {
  const gridAvailW = canvas.width - PAD * 2;
  const gridAvailH = canvas.height - TOP_BAR - MINE_INFO_H - PAD * 2;
  CELL = Math.floor(Math.min(gridAvailW / COLS, gridAvailH / ROWS));
  GRID_W = CELL * COLS;
  GRID_H = CELL * ROWS;
  ORIGIN_X = (canvas.width - GRID_W) / 2;
  ORIGIN_Y = TOP_BAR + MINE_INFO_H + PAD;
}

const SCREEN_HOME = 0;
const SCREEN_GAME = 1;
const SCREEN_ABOUT = 2;
const SCREEN_SETTINGS = 3;
const SCREEN_RANK = 4;
const SCREEN_SIGN = 5;
let screen = SCREEN_HOME;

const BTN_HOME_START = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.34,
  w: 200,
  h: 48
};
const BTN_HOME_SETTINGS = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.34 + 58,
  w: 200,
  h: 48
};
const BTN_HOME_RANK = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.34 + 116,
  w: 200,
  h: 48
};
const BTN_HOME_SIGN = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.34 + 174,
  w: 200,
  h: 48
};
const BTN_HOME_ABOUT = {
  x: canvas.width / 2 - 100,
  y: canvas.height * 0.34 + 232,
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

const BTN_SETTINGS_BACK = {
  x: canvas.width / 2 - 55,
  y: canvas.height - 76,
  w: 110,
  h: 44
};
const BTN_SIZE_SMALL = { x: canvas.width / 2 - 135, y: 152, w: 80, h: 40 };
const BTN_SIZE_MID = { x: canvas.width / 2 - 40, y: 152, w: 80, h: 40 };
const BTN_SIZE_LARGE = { x: canvas.width / 2 + 55, y: 152, w: 80, h: 40 };
const BTN_MINE_MINUS = { x: canvas.width / 2 - 90, y: 238, w: 44, h: 40 };
const BTN_MINE_PLUS = { x: canvas.width / 2 + 46, y: 238, w: 44, h: 40 };
const BTN_TIME_MINUS = { x: canvas.width / 2 - 90, y: 322, w: 44, h: 40 };
const BTN_TIME_PLUS = { x: canvas.width / 2 + 46, y: 322, w: 44, h: 40 };
const BTN_AUDIO_BGM = { x: canvas.width / 2 - 100, y: 358, w: 200, h: 40 };
const BTN_AUDIO_SFX = { x: canvas.width / 2 - 100, y: 406, w: 200, h: 40 };
const BTN_RANK_BACK = {
  x: canvas.width / 2 - 55,
  y: canvas.height - 76,
  w: 110,
  h: 44
};
const BTN_SIGN_BACK = {
  x: canvas.width / 2 - 55,
  y: canvas.height - 76,
  w: 110,
  h: 44
};

const SIZE_OPTIONS = [
  { label: '小', rows: 9, cols: 9, mines: 10, timeLimitSec: 300 },
  { label: '中', rows: 12, cols: 12, mines: 22, timeLimitSec: 480 },
  { label: '大', rows: 16, cols: 16, mines: 40, timeLimitSec: 720 }
];
let sizeIndex = 0;
let rankRecent = [];
const SIGN_STORAGE_KEY = 'liangzhilei_sign_data_v1';
const RANK_STORAGE_KEY = 'liangzhilei_rank_v1';
const AUDIO_SETTINGS_KEY = 'liangzhilei_audio_v1';
const GAME_VERSION = '1.0.2';
let signData = {
  checkedDates: [],
  streak: 0,
  lastCheckin: ''
};
let audioSettings = { bgmOn: true, sfxOn: true };
let clockPauseStart = 0;
let audioUnlocked = false;
let bgmPlaying = false;
let audioBgm = null;
let audioTap = null;
let audioFlag = null;
let audioWin = null;
let audioBoom = null;
let audioLose = null;

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

function drawButtonActive(rect, label, active) {
  ctx.fillStyle = active ? 'rgba(255,220,120,0.95)' : 'rgba(255,255,255,0.92)';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = active ? 'rgba(120,80,0,0.45)' : 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const mm = m < 10 ? '0' + String(m) : String(m);
  const dd = d < 10 ? '0' + String(d) : String(d);
  return String(y) + '-' + mm + '-' + dd;
}

function dateAtMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(a, b) {
  const ms = dateAtMidnight(a).getTime() - dateAtMidnight(b).getTime();
  return Math.floor(ms / 86400000);
}

function loadSignData() {
  try {
    const raw = wx.getStorageSync(SIGN_STORAGE_KEY);
    if (!raw) return;
    if (!Array.isArray(raw.checkedDates)) return;
    signData = {
      checkedDates: raw.checkedDates.slice(),
      streak: Number(raw.streak) || 0,
      lastCheckin: raw.lastCheckin || ''
    };
  } catch (e) {
    // ignore storage exception to keep game usable
  }
}

function saveSignData() {
  try {
    wx.setStorageSync(SIGN_STORAGE_KEY, signData);
  } catch (e) {
    // ignore storage exception to keep game usable
  }
}

function loadRankData() {
  try {
    const raw = wx.getStorageSync(RANK_STORAGE_KEY);
    if (!raw || !Array.isArray(raw)) return;
    const list = [];
    for (let i = 0; i < raw.length; i++) {
      const o = raw[i];
      if (!o || typeof o.rows !== 'number' || typeof o.cols !== 'number') continue;
      list.push({
        rows: o.rows,
        cols: o.cols,
        durationMs: Math.max(0, Number(o.durationMs) || 0)
      });
    }
    list.sort(function (a, b) {
      return a.durationMs - b.durationMs;
    });
    rankRecent = list.slice(0, 10);
  } catch (e) {
    // ignore
  }
}

function persistRankData() {
  try {
    wx.setStorageSync(RANK_STORAGE_KEY, rankRecent);
  } catch (e) {
    // ignore
  }
}

function loadAudioSettings() {
  try {
    const raw = wx.getStorageSync(AUDIO_SETTINGS_KEY);
    if (!raw || typeof raw !== 'object') return;
    if (typeof raw.bgmOn === 'boolean') audioSettings.bgmOn = raw.bgmOn;
    if (typeof raw.sfxOn === 'boolean') audioSettings.sfxOn = raw.sfxOn;
  } catch (e) {
    // ignore
  }
}

function saveAudioSettings() {
  try {
    wx.setStorageSync(AUDIO_SETTINGS_KEY, audioSettings);
  } catch (e) {
    // ignore
  }
}

function ensureTodayCheckin() {
  const today = new Date();
  const todayKey = dateKey(today);
  if (signData.lastCheckin === todayKey) return;

  if (signData.lastCheckin) {
    const last = new Date(signData.lastCheckin + 'T00:00:00');
    if (dayDiff(today, last) === 1) {
      signData.streak += 1;
    } else {
      signData.streak = 1;
    }
  } else {
    signData.streak = 1;
  }

  signData.lastCheckin = todayKey;
  if (signData.checkedDates.indexOf(todayKey) < 0) {
    signData.checkedDates.push(todayKey);
  }
  if (signData.checkedDates.length > 540) {
    signData.checkedDates = signData.checkedDates.slice(signData.checkedDates.length - 540);
  }
  saveSignData();
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
let roundSaved = false;
let gameStartAt = 0;
let timeLimitSec = SIZE_OPTIONS[0].timeLimitSec;
let endedElapsedMs = 0;
let timeoutSfxPlayed = false;

function clampTimeLimitSec(n) {
  return Math.max(30, Math.min(3600, n));
}

function getElapsedMs() {
  if (!started || gameStartAt === 0) return 0;
  if (win || gameOver) return endedElapsedMs;
  const end = clockPauseStart > 0 ? clockPauseStart : Date.now();
  return end - gameStartAt;
}

function formatDuration(ms) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return String(m) + ':' + (s < 10 ? '0' : '') + String(s);
}

function initArrays() {
  MINE_COUNT = clampMineCount(MINE_COUNT);
  timeLimitSec = clampTimeLimitSec(timeLimitSec);
  recalcBoardLayout();
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
  roundSaved = false;
  gameStartAt = 0;
  endedElapsedMs = 0;
  timeoutSfxPlayed = false;
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

function initAudioContexts() {
  if (typeof wx.createInnerAudioContext !== 'function') return;
  function make(src) {
    const a = wx.createInnerAudioContext();
    a.src = src;
    a.autoplay = false;
    a.onError(function () {
      // ignore missing or unsupported audio
    });
    return a;
  }
  audioBgm = make('audio/bgm.wav');
  if (audioBgm) {
    audioBgm.loop = true;
    audioBgm.volume = 0.32;
  }
  audioTap = make('audio/tap.wav');
  audioFlag = make('audio/flag.wav');
  audioWin = make('audio/win.wav');
  audioBoom = make('audio/explode.wav');
  audioLose = make('audio/lose.wav');
  if (audioTap) audioTap.volume = 0.55;
  if (audioFlag) audioFlag.volume = 0.5;
  if (audioWin) audioWin.volume = 0.55;
  if (audioBoom) audioBoom.volume = 0.75;
  if (audioLose) audioLose.volume = 0.55;
}

function playSfxOne(ctx) {
  if (!audioSettings.sfxOn || !ctx) return;
  try {
    ctx.stop();
    ctx.play();
  } catch (e) {
    // ignore
  }
}

function playTapSfx() {
  playSfxOne(audioTap);
}

function playFlagSfx() {
  playSfxOne(audioFlag);
}

function playWinSfx() {
  playSfxOne(audioWin);
}

function playBoomSfx() {
  playSfxOne(audioBoom);
}

function playLoseSfx() {
  playSfxOne(audioLose);
}

function syncBgm() {
  if (!audioBgm) return;
  const allow =
    audioSettings.bgmOn &&
    audioUnlocked &&
    (screen === SCREEN_HOME || screen === SCREEN_GAME) &&
    clockPauseStart === 0;
  if (!allow) {
    if (bgmPlaying) {
      try {
        audioBgm.pause();
      } catch (e) {
        // ignore
      }
      bgmPlaying = false;
    }
    return;
  }
  if (!bgmPlaying) {
    try {
      audioBgm.play();
      bgmPlaying = true;
    } catch (e) {
      bgmPlaying = false;
    }
  }
}

function tryUnlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  syncBgm();
}

function saveRoundRankIfNeeded() {
  if (roundSaved || !started || !win) return;
  roundSaved = true;
  playWinSfx();
  rankRecent.push({
    rows: ROWS,
    cols: COLS,
    durationMs: endedElapsedMs
  });
  rankRecent.sort(function (a, b) {
    return a.durationMs - b.durationMs;
  });
  if (rankRecent.length > 10) rankRecent = rankRecent.slice(0, 10);
  persistRankData();
}

function revealCell(i, j) {
  if (gameOver || win) return;
  if (mark[i][j] === MARK_FLAG) return;
  if (revealed[i][j]) return;
  if (mark[i][j] === MARK_QUESTION) mark[i][j] = MARK_NONE;
  if (!started) {
    started = true;
    gameStartAt = Date.now();
    placeMines(i, j);
  }
  if (mines[i][j]) {
    revealed[i][j] = true;
    gameOver = true;
    endedElapsedMs = Date.now() - gameStartAt;
    playBoomSfx();
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
  playTapSfx();
  if (checkWin()) {
    win = true;
    endedElapsedMs = Date.now() - gameStartAt;
    applyWinFlags();
    saveRoundRankIfNeeded();
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
    endedElapsedMs = Date.now() - gameStartAt;
    applyWinFlags();
    saveRoundRankIfNeeded();
  }
}

function cycleMark(i, j) {
  if (gameOver || win) return;
  if (revealed[i][j]) return;
  mark[i][j] = (mark[i][j] + 1) % 3;
  playFlagSfx();
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
  const used = formatDuration(getElapsedMs());
  const leftSec = Math.max(0, timeLimitSec - Math.floor(getElapsedMs() / 1000));
  const left = formatDuration(leftSec * 1000);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const midY = y0 + h / 2 - 2;
  ctx.fillText(
    '\u5171 ' + total + ' \u9897\u96f7  \u5269\u4f59 ' + remain + ' \u9897  \u7528\u65f6 ' + used + '  \u5269\u4f59\u65f6\u95f4 ' + left,
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
  drawButton(BTN_HOME_SETTINGS, '\u6e38\u620f\u8bbe\u7f6e');
  drawButton(BTN_HOME_RANK, '\u6392\u884c\u699c');
  drawButton(BTN_HOME_SIGN, '\u7b7e\u5230');
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
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('\u7248\u672c ' + GAME_VERSION, canvas.width / 2, 74);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  const padX = 24;
  const lines = [
    '\u826f\u4e4b\u96f7\u662f\u8f7b\u91cf\u7ebf\u4e0a\u4f11\u95f2\u4ea7\u54c1\uff0c\u5173\u6ce8\u8f7b\u677e\u3001\u81ea\u7136\u7684\u4f11\u95f2\u4f53\u9a8c\u3002',
    '\u672c\u626b\u96f7\u5c0f\u6e38\u620f\u4e3a\u826f\u4e4b\u96f7\u4f53\u9a8c\u793a\u4f8b\uff0c\u4ec5\u4f9b\u5a31\u4e50\u4e0e\u5b66\u4e60\u4ea4\u6d41\u3002',
    '\u611f\u8c22\u4f7f\u7528\u826f\u4e4b\u96f7\u3002'
  ];
  let ly = 108;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padX, ly);
    ly += 28;
  }
  drawButton(BTN_ABOUT_BACK, '\u8fd4\u56de');
}

function drawSettings() {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('\u6e38\u620f\u8bbe\u7f6e', canvas.width / 2, 44);

  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillText('\u96f7\u533a\u5c3a\u5bf8', 26, 128);
  drawButtonActive(BTN_SIZE_SMALL, '\u5c0f', sizeIndex === 0);
  drawButtonActive(BTN_SIZE_MID, '\u4e2d', sizeIndex === 1);
  drawButtonActive(BTN_SIZE_LARGE, '\u5927', sizeIndex === 2);

  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillText('\u96f7\u7684\u6570\u91cf', 26, 220);
  drawButton(BTN_MINE_MINUS, '-');
  drawButton(BTN_MINE_PLUS, '+');
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(String(MINE_COUNT), canvas.width / 2, BTN_MINE_MINUS.y + BTN_MINE_MINUS.h / 2 + 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.font = '14px sans-serif';
  ctx.fillText('\u65f6\u95f4\u9650\u5236(\u79d2)', 26, 304);
  drawButton(BTN_TIME_MINUS, '-');
  drawButton(BTN_TIME_PLUS, '+');
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(String(timeLimitSec), canvas.width / 2, BTN_TIME_MINUS.y + BTN_TIME_MINUS.h / 2 + 1);

  ctx.textAlign = 'left';
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillText('\u97f3\u9891', 26, 342);
  drawButton(
    BTN_AUDIO_BGM,
    audioSettings.bgmOn ? '\u80cc\u666f\u97f3\u4e50\uff1a\u5f00' : '\u80cc\u666f\u97f3\u4e50\uff1a\u5173'
  );
  drawButton(
    BTN_AUDIO_SFX,
    audioSettings.sfxOn ? '\u97f3\u6548\uff1a\u5f00' : '\u97f3\u6548\uff1a\u5173'
  );

  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.textAlign = 'center';
  ctx.fillText(
    '\u5f53\u524d\uff1a' + ROWS + 'x' + COLS + '\uff0c\u53ef\u8bbe\u7f6e\u8303\u56f4 1~' + maxMineCount(),
    canvas.width / 2,
    456
  );
  ctx.fillText('\u4fdd\u5b58\u65b9\u5f0f\uff1a\u70b9\u201c\u8fd4\u56de\u201d\u540e\u5f00\u59cb\u6e38\u620f\u751f\u6548', canvas.width / 2, 480);

  drawButton(BTN_SETTINGS_BACK, '\u8fd4\u56de');
}

function drawRank() {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('\u6392\u884c\u699c', canvas.width / 2, 44);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('\u6700\u5feb\u5b8c\u6210\u524d 10 \u6761\u8bb0\u5f55\uff08\u5c3a\u5bf8 + \u7528\u65f6\uff09', canvas.width / 2, 76);

  ctx.textAlign = 'left';
  ctx.font = '15px sans-serif';
  if (rankRecent.length === 0) {
    ctx.fillText('\u6682\u65e0\u8bb0\u5f55', 34, 128);
  } else {
    let y = 124;
    for (let i = 0; i < rankRecent.length; i++) {
      const item = rankRecent[i];
      ctx.fillText(
        String(i + 1) + '.  ' + item.rows + 'x' + item.cols + '  ' + formatDuration(item.durationMs),
        34,
        y
      );
      y += 30;
    }
  }
  drawButton(BTN_RANK_BACK, '\u8fd4\u56de');
}

function drawSign() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const checkedSet = new Set(signData.checkedDates);
  const todayKey = dateKey(now);

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('\u7b7e\u5230', canvas.width / 2, 44);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillText(
    '\u5df2\u8fde\u7eed\u6253\u5f00 ' + String(signData.streak) + ' \u5929',
    canvas.width / 2,
    78
  );
  ctx.font = '14px sans-serif';
  ctx.fillText(String(year) + '\u5e74' + String(month + 1) + '\u6708', canvas.width / 2, 106);

  const calX = 24;
  const calY = 136;
  const calW = canvas.width - 48;
  const cellW = calW / 7;
  const cellH = 48;
  const weekNames = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d'];

  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 7; i++) {
    ctx.fillText(weekNames[i], calX + cellW * (i + 0.5), calY);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const idx = firstWeekday + day - 1;
    const r = Math.floor(idx / 7);
    const c = idx % 7;
    const x = calX + c * cellW;
    const y = calY + 20 + r * cellH;
    const key =
      String(year) +
      '-' +
      (month + 1 < 10 ? '0' : '') +
      String(month + 1) +
      '-' +
      (day < 10 ? '0' : '') +
      String(day);
    const checked = checkedSet.has(key);

    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
    if (key === todayKey) {
      ctx.strokeStyle = 'rgba(255,220,120,0.95)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(day), x + cellW / 2, y + 5);

    if (checked) {
      ctx.fillStyle = '#4cd964';
      ctx.font = '16px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2714', x + cellW / 2, y + cellH - 13);
    } else {
      ctx.strokeStyle = 'rgba(220,220,220,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + cellW / 2, y + cellH - 13, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u8bf4\u660e\uff1a\u8fdb\u5165\u7b7e\u5230\u9875\u5f53\u5929\u81ea\u52a8\u6253\u5361', canvas.width / 2, canvas.height - 104);
  drawButton(BTN_SIGN_BACK, '\u8fd4\u56de');
}

function drawTopBar() {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(0, 0, canvas.width, TOP_BAR - 4);

  drawButton(BTN_GAME_RESTART, '\u91cd\u65b0\u5f00\u59cb');
  drawButton(BTN_GAME_EXIT, '\u9000\u51fa');

  ctx.textAlign = 'center';
  ctx.fillStyle = win ? '#2ecc71' : gameOver ? '#e74c3c' : 'rgba(255,255,255,0.95)';
  ctx.textBaseline = 'middle';
  if (win) {
    ctx.font = '22px sans-serif';
    ctx.fillText('\uD83C\uDF89 \u8d62\u4e86', canvas.width / 2, TOP_BAR / 2 - 2);
  } else if (gameOver) {
    ctx.font = '22px sans-serif';
    ctx.fillText('\uD83D\uDCA5 \u8e29\u96f7', canvas.width / 2, TOP_BAR / 2 - 2);
  } else {
    ctx.font = '15px sans-serif';
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
  syncBgm();
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
  if (screen === SCREEN_SETTINGS) {
    drawSettings();
    return;
  }
  if (screen === SCREEN_RANK) {
    drawRank();
    return;
  }
  if (screen === SCREEN_SIGN) {
    drawSign();
    return;
  }
  if (screen === SCREEN_GAME && started && !win && !gameOver) {
    if (getElapsedMs() >= timeLimitSec * 1000) {
      gameOver = true;
      endedElapsedMs = timeLimitSec * 1000;
      if (!timeoutSfxPlayed) {
        timeoutSfxPlayed = true;
        playLoseSfx();
      }
    }
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

function getSharePayload() {
  return {
    title: '\u6765\u6311\u6218\u826f\u4e4b\u96f7\u626b\u96f7\uff01'
  };
}

if (typeof wx.showShareMenu === 'function') {
  try {
    wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] });
  } catch (e) {
    try {
      wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage'] });
    } catch (e2) {
      try {
        wx.showShareMenu();
      } catch (e3) {
        // ignore
      }
    }
  }
}
if (typeof wx.onShareAppMessage === 'function') {
  wx.onShareAppMessage(function () {
    return getSharePayload();
  });
}
if (typeof wx.onShareTimeline === 'function') {
  wx.onShareTimeline(function () {
    return getSharePayload();
  });
}

if (typeof wx.onHide === 'function') {
  wx.onHide(function () {
    if (screen === SCREEN_GAME && started && !win && !gameOver && clockPauseStart === 0) {
      clockPauseStart = Date.now();
    }
    if (audioBgm) {
      try {
        audioBgm.pause();
      } catch (e) {
        // ignore
      }
      bgmPlaying = false;
    }
  });
}
if (typeof wx.onShow === 'function') {
  wx.onShow(function () {
    if (clockPauseStart > 0) {
      const gap = Date.now() - clockPauseStart;
      clockPauseStart = 0;
      if (gameStartAt > 0) gameStartAt += gap;
    }
    syncBgm();
  });
}

initArrays();
loadSignData();
loadRankData();
loadAudioSettings();
initAudioContexts();
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

  tryUnlockAudio();

  if (screen === SCREEN_HOME) {
    if (pointInRect(x, y, BTN_HOME_START)) {
      screen = SCREEN_GAME;
      initArrays();
      startTime = Date.now();
      lastShortTap = null;
      return;
    }
    if (pointInRect(x, y, BTN_HOME_SETTINGS)) {
      screen = SCREEN_SETTINGS;
      return;
    }
    if (pointInRect(x, y, BTN_HOME_RANK)) {
      screen = SCREEN_RANK;
      return;
    }
    if (pointInRect(x, y, BTN_HOME_SIGN)) {
      ensureTodayCheckin();
      screen = SCREEN_SIGN;
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

  if (screen === SCREEN_SETTINGS) {
    if (pointInRect(x, y, BTN_SIZE_SMALL)) {
      sizeIndex = 0;
      ROWS = SIZE_OPTIONS[sizeIndex].rows;
      COLS = SIZE_OPTIONS[sizeIndex].cols;
      MINE_COUNT = SIZE_OPTIONS[sizeIndex].mines;
      timeLimitSec = SIZE_OPTIONS[sizeIndex].timeLimitSec;
      recalcBoardLayout();
      return;
    }
    if (pointInRect(x, y, BTN_SIZE_MID)) {
      sizeIndex = 1;
      ROWS = SIZE_OPTIONS[sizeIndex].rows;
      COLS = SIZE_OPTIONS[sizeIndex].cols;
      MINE_COUNT = SIZE_OPTIONS[sizeIndex].mines;
      timeLimitSec = SIZE_OPTIONS[sizeIndex].timeLimitSec;
      recalcBoardLayout();
      return;
    }
    if (pointInRect(x, y, BTN_SIZE_LARGE)) {
      sizeIndex = 2;
      ROWS = SIZE_OPTIONS[sizeIndex].rows;
      COLS = SIZE_OPTIONS[sizeIndex].cols;
      MINE_COUNT = SIZE_OPTIONS[sizeIndex].mines;
      timeLimitSec = SIZE_OPTIONS[sizeIndex].timeLimitSec;
      recalcBoardLayout();
      return;
    }
    if (pointInRect(x, y, BTN_MINE_MINUS)) {
      MINE_COUNT = clampMineCount(MINE_COUNT - 1);
      return;
    }
    if (pointInRect(x, y, BTN_MINE_PLUS)) {
      MINE_COUNT = clampMineCount(MINE_COUNT + 1);
      return;
    }
    if (pointInRect(x, y, BTN_TIME_MINUS)) {
      timeLimitSec = clampTimeLimitSec(timeLimitSec - 30);
      return;
    }
    if (pointInRect(x, y, BTN_TIME_PLUS)) {
      timeLimitSec = clampTimeLimitSec(timeLimitSec + 30);
      return;
    }
    if (pointInRect(x, y, BTN_AUDIO_BGM)) {
      audioSettings.bgmOn = !audioSettings.bgmOn;
      saveAudioSettings();
      syncBgm();
      return;
    }
    if (pointInRect(x, y, BTN_AUDIO_SFX)) {
      audioSettings.sfxOn = !audioSettings.sfxOn;
      saveAudioSettings();
      return;
    }
    if (pointInRect(x, y, BTN_SETTINGS_BACK)) {
      screen = SCREEN_HOME;
      return;
    }
    return;
  }

  if (screen === SCREEN_RANK) {
    if (pointInRect(x, y, BTN_RANK_BACK)) {
      screen = SCREEN_HOME;
    }
    return;
  }

  if (screen === SCREEN_SIGN) {
    if (pointInRect(x, y, BTN_SIGN_BACK)) {
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
