Page({
  data: { items: [] },
  onShow() {
    my.hideTabBar();
    my.request({
      url: getApp().globalData.apiBase + "/around",
      method: "GET",
      timeout: 5000,
      success: res => this.setData({ items: (res.data && res.data.items) || [] }),
      fail: () => this.setData({ items: [] }) // 接口未接入时显示空态，不展示伪造数据
    });
  },
  goReport() { my.navigateTo({ url: "/pages/report/report" }); }
});
