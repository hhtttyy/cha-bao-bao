Page({
  data: { reports: [], playingId: "" },
  onShow() {
    my.hideTabBar();
    const local = my.getStorageSync({ key: "myReports" }).data || [];
    this.setData({
      reports: local.map(r => ({
        ...r,
        capturedAtShort: (r.capturedAt || "").replace("T", " ").slice(0, 16),
        locText: r.lat != null ? "北纬 " + Number(r.lat).toFixed(4) + "，东经 " + Number(r.lng).toFixed(4) : "位置未记录",
        hasVoice: !!r.voicePath,
        durationText: r.voiceSeconds ? "（" + r.voiceSeconds + "″）" : ""
      }))
    });
  },
  preview(e) {
    my.previewImage({ urls: [e.target.dataset.path] });
  },
  playVoice(e) {
    const path = e.target.dataset.path;
    const id = e.target.dataset.id;
    if (!path) return;
    if (this.data.playingId === id) {
      if (this.audio) { try { this.audio.stop(); } catch (err) { /* ignore */ } }
      this.setData({ playingId: "" });
      return;
    }
    if (!my.createInnerAudioContext) {
      my.showToast({ content: "当前版本暂不支持回放", duration: 1500 });
      return;
    }
    this.playWith(path, id, true);
  },
  playWith(path, id, native) {
    if (this.audio) { try { this.audio.destroy(); } catch (err) { /* ignore */ } this.audio = null; }
    let a = null;
    try { a = native ? my.createInnerAudioContext({ useNativePlayer: true }) : my.createInnerAudioContext(); }
    catch (err) { a = my.createInnerAudioContext(); }
    a.volume = 1;
    // 支付宝事件名是 onCanPlay（大小写敏感），onCanplay 是微信写法
    const onReady = () => { if (this.data.playingId === id) { try { a.play(); } catch (err) { /* ignore */ } } };
    if (a.onCanPlay) a.onCanPlay(onReady);
    else if (a.onCanplay) a.onCanplay(onReady);
    a.onEnded(() => this.setData({ playingId: "" }));
    a.onError(() => {
      if (native) { this.playWith(path, id, false); }
      else { this.setData({ playingId: "" }); my.showToast({ content: "播放失败，录音文件可能已失效", duration: 2000 }); }
    });
    this.audio = a;
    a.src = path;
    this.setData({ playingId: id });
    try { a.play(); } catch (err) { /* ignore */ }
  }
});
