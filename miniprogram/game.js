const sys = wx.getSystemInfoSync();
const canvas = wx.createCanvas();
canvas.width = sys.windowWidth;
canvas.height = sys.windowHeight;
const ctx = canvas.getContext('2d');

const btnW = Math.min(360, sys.windowWidth - 48);
const btnH = 56;
const btn = {
  x: (sys.windowWidth - btnW) / 2,
  y: sys.windowHeight / 2 - btnH / 2,
  w: btnW,
  h: btnH
};

function draw() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#07c160';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('点击显示 hello 良之雷', btn.x + btn.w / 2, btn.y + btn.h / 2);
}

draw();

wx.onTouchStart(function (e) {
  const t = e.touches[0];
  const x = t.clientX;
  const y = t.clientY;
  if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
    wx.showModal({
      title: '提示',
      content: 'hello 良之雷',
      showCancel: false
    });
  }
});
