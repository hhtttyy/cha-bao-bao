App({
  globalData: {
    // 后端接口地址：试点上线前替换为真实服务端域名（需加入小程序安全域名白名单）
    apiBase: "https://api.example-tea-sentinel.cn",
    // 长辈模式：默认开启（大字号、语音提示）
    elderMode: true
  },
  onLaunch() {
    const pending = my.getStorageSync({ key: "pendingReports" }).data || [];
    if (pending.length) {
      this.flushPending(pending);
    }
  },
  // 离线补传：网络恢复后重试本地暂存的上报
  flushPending(pending) {
    const remaining = [];
    let done = 0;
    const finish = () => {
      done += 1;
      if (done === pending.length) {
        my.setStorageSync({ key: "pendingReports", data: remaining });
      }
    };
    pending.forEach(item => {
      my.uploadFile({
        url: this.globalData.apiBase + "/report",
        filePath: item.imagePath,
        fileName: "photo",
        formData: {
          lat: String(item.lat),
          lng: String(item.lng),
          capturedAt: item.capturedAt,
          note: item.note || "",
          clientReportId: item.clientReportId
        },
        success: () => {
          item.status = "synced";
          const local = my.getStorageSync({ key: "myReports" }).data || [];
          const idx = local.findIndex(r => r.clientReportId === item.clientReportId);
          if (idx > -1) { local[idx].status = "已同步"; my.setStorageSync({ key: "myReports", data: local }); }
        },
        fail: () => { remaining.push(item); },
        complete: finish
      });
    });
  }
});
