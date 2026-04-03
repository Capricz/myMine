Page({
  onClickHello() {
    wx.showModal({
      title: '提示',
      content: 'hello 良之雷',
      showCancel: false
    });
  }
});
