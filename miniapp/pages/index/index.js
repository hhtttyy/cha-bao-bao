Page({
  data: {
    alert: "",
    pendingCount: 0
  },
  onShow() {
    my.hideTabBar();
    const pending = my.getStorageSync({ key: "pendingReports" }).data || [];
    this.setData({ pendingCount: pending.length });
    this.loadAlert();
  },
  // 霜冻预警：优先取服务端；接口未接入时展示演示条幅，避免空态误解
  loadAlert() {
    const api = getApp().globalData.apiBase + "/alert";
    my.request({
      url: api,
      method: "GET",
      timeout: 5000,
      success: res => {
        const a = res.data && res.data.alert;
        this.setData({ alert: a || "" });
      },
      fail: () => {
        this.setData({ alert: "【演示】气象台提示：今夜山区最低温 1℃，注意防霜冻（正式版接入气象局数据）" });
      }
    });
  },
  goReport() { my.navigateTo({ url: "/pages/report/report" }); },
  goAround() { my.switchTab({ url: "/pages/around/around" }); },
  goRecords() { my.switchTab({ url: "/pages/records/records" }); }
});
