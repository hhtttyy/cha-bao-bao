Page({
  data: { ok: false },
  onLoad(query) {
    this.setData({ ok: query && query.ok === "1" });
  },
  goRecords() { my.switchTab({ url: "/pages/records/records" }); },
  goHome() { my.switchTab({ url: "/pages/index/index" }); }
});
