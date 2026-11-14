Page({
  data: {
    imagePath: "",
    locationText: "",
    location: null,
    locationFail: false,
    recording: false,
    voicePath: "",
    voiceSeconds: 0,
    playing: false,
    canSubmit: false,
    locState: "idle",
    locErr: "",
    showDebug: false,
    debugText: ""
  },

  // ---------- 诊断日志（真机无远程console，内置面板供复制反馈） ----------
  dbg(tag, val) {
    const line = "[" + new Date().toLocaleTimeString() + "] " + tag + " " + (typeof val === "string" ? val : JSON.stringify(val));
    this._dbg = this._dbg || [];
    this._dbg.push(line);
    console.log(line);
    if (this.data.showDebug) this.setData({ debugText: this._dbg.join("\n") });
  },
  toggleDebug() {
    const show = !this.data.showDebug;
    this.setData({ showDebug: show, debugText: (this._dbg || []).join("\n") });
  },
  copyDebug() {
    my.setClipboard({ text: (this._dbg || []).join("\n") });
    my.showToast({ content: "日志已复制，可粘贴反馈", duration: 2000 });
  },

  // 照片持久化：走 my.saveFile（本地缓存文件，image 组件可直接显示），沿用原有可用链路。
  persist(path, cb) {
    if (!path) { cb(""); return; }
    if (my.saveFile) {
      my.saveFile({
        apFilePath: path,
        success: r => cb((r && r.apFilePath) || path),
        fail: () => this.copyFallback(path, cb)
      });
    } else this.copyFallback(path, cb);
  },
  copyFallback(path, cb) {
    const fs = my.getFileSystemManager && my.getFileSystemManager();
    const base = (my.env && my.env.USER_DATA_PATH) || "";
    if (fs && fs.copyFile && base) {
      const ext = path.indexOf(".mp3") > -1 ? ".mp3" : ".aac";
      const dest = base + "/media_" + Date.now() + ext;
      fs.copyFile({ srcPath: path, destPath: dest, success: () => cb(dest), fail: () => cb(path) });
    } else cb(path);
  },

  // 录音持久化：支付宝官方录音示例使用 FileSystemManager.saveFile({ tempFilePath })。
  // 不能沿用 my.saveFile / copyFile(usr://)：InnerAudioContext 仅保证播放网络地址与录音临时路径，
  // my.saveFile 还可能移动临时文件，导致播放时本地路径全部失效（“文件已失效”）。
  // 持久化失败时保留原始临时路径（本次启动内仍可播），避免换成不可播放的路径。
  persistVoice(path, cb) {
    if (!path) { cb(""); return; }
    const fs = my.getFileSystemManager && my.getFileSystemManager();
    if (fs && fs.saveFile) {
      fs.saveFile({
        tempFilePath: path,
        success: r => cb((r && r.savedFilePath) || path),
        fail: err => {
          this.dbg("voice.persistFail", err);
          cb(path);
        }
      });
    } else {
      cb(path);
    }
  },

  // ---------- 第一步：现场拍照（仅相机，禁止相册选图 —— 现场性约束） ----------
  takePhoto() {
    my.chooseImage({
      sourceType: ["camera"],
      count: 1,
      success: res => {
        // 兼容不同基础库的返回字段
        const path =
          (res.apFilePaths && res.apFilePaths[0]) ||
          (res.tempFilePaths && res.tempFilePaths[0]) ||
          (res.filePaths && res.filePaths[0]) ||
          (res.tempFiles && res.tempFiles[0] && res.tempFiles[0].path) ||
          "";
        if (!path) {
          my.showToast({ content: "没拿到照片，请再拍一次", duration: 2000 });
          return;
        }
        this.dbg("photo.raw", path);
        this.persist(path, saved => {
          this.dbg("photo.saved", saved);
          this.setData({ imagePath: saved, canSubmit: true });
          // 不自动定位：经纬度由用户点按钮主动获取，避免授权弹窗与拍照流程冲突
        });
      }
    });
  },

  locate() {
    if (this._locTimer) clearTimeout(this._locTimer);
    // 先检查系统定位开关，关闭时立即提示，不做无谓等待
    const sys = my.getSystemSetting ? my.getSystemSetting() : {};
    this.dbg("loc.sys", sys);
    if (sys.locationEnabled === false) {
      this.setData({ locationFail: true, locState: "fail", locErr: "系统定位服务未开启" });
      my.showToast({ content: "请先在手机系统设置中开启定位服务", duration: 2500 });
      return;
    }
    this.setData({ location: null, locationText: "", locationFail: false, locState: "locating", locErr: "" });
    // 兜底：8 秒内没拿到定位就标记失败，不阻塞提交
    this._locTimer = setTimeout(() => {
      this._locTimer = null;
      if (this.data.locState === "locating") {
        this.setData({ locationFail: true, locState: "fail", locErr: "定位超时" });
      }
    }, 8000);
    try {
      my.getLocation({
        type: 0, // 只要经纬度，不做逆地理编码，返回更快
        cacheTimeout: 30,
        success: res => this.handleLocSuccess(res),
        fail: err => this.handleLocFail(err)
      });
    } catch (e) {
      this.handleLocFail(e);
    }
  },

  // 支付宝 my.getLocation 的 success 回调中 latitude/longitude 是 String（官方文档类型均为 String）。
  // 旧代码直接 res.latitude.toFixed(4) 会抛 TypeError；且定时器已被提前清除，界面就永久停在“获取中”。
  // 这里统一 Number 化并校验，任何异常都转失败态。
  handleLocSuccess(res) {
    try {
      const rawLat = res && res.latitude;
      const rawLng = res && res.longitude;
      const hasVal = v => v !== null && v !== undefined && String(v).trim() !== "";
      const lat = Number(rawLat);
      const lng = Number(rawLng);
      const valid = hasVal(rawLat) && hasVal(rawLng) &&
        isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
      if (!valid) {
        this.dbg("loc.invalid", { lat: rawLat, lng: rawLng });
        this.handleLocFail({ error: "INVALID", errorMessage: "经纬度无效" });
        return;
      }
      this.dbg("loc.ok", { lat, lng });
      if (this._locTimer) { clearTimeout(this._locTimer); this._locTimer = null; }
      this.setData({
        location: { lat, lng },
        locationText: "北纬 " + lat.toFixed(4) + "，东经 " + lng.toFixed(4),
        locationFail: false,
        locState: "ok",
        locErr: "",
        canSubmit: !!this.data.imagePath
      });
    } catch (e) {
      this.dbg("loc.renderFail", String(e));
      this.handleLocFail(e);
    }
  },

  // 区分"用户拒绝授权"与"普通定位失败"，并记录真实错误便于排查（如类目准入限制）
  handleLocFail(err) {
    if (this._locTimer) { clearTimeout(this._locTimer); this._locTimer = null; }
    this.dbg("loc.fail", err);
    const code = err && (err.error || err.errCode || err.code);
    const msg = (err && (err.errorMessage || err.errMsg)) || "";
    const detail = (code != null ? "错误" + code : "") + (msg ? " " + msg : "");
    if (my.getSetting) {
      my.getSetting({
        success: r => {
          this.dbg("loc.auth", r.authSetting);
          const denied = r.authSetting && r.authSetting.location === false;
          this.setData({ locationFail: true, locState: denied ? "denied" : "fail", locErr: detail });
        },
        fail: () => this.setData({ locationFail: true, locState: "fail", locErr: detail })
      });
    } else {
      this.setData({ locationFail: true, locState: "fail", locErr: detail });
    }
  },

  openLocSetting() {
    if (my.openSetting) my.openSetting({});
  },

  // ---------- 第二步：方言语音（按住说话） ----------
  // 事件注册只做一次；触摸事件挂在外层稳定节点上，避免 setData 重渲染导致松手事件丢失
  onLoad() {
    const rm = my.getRecorderManager();
    rm.onStop(res => {
      this._recording = false;
      // duration 单位在不同基础库不一致（秒/毫秒），以本地计时为准、返回值校验为辅
      const raw = res.duration || 0;
      const elapsedMs = this._elapsedMs || (Date.now() - (this._startAt || 0));
      let sec = 0;
      if (raw > 2000) sec = Math.round(raw / 1000);       // 毫秒
      else if (raw > 0) sec = Math.round(raw);            // 秒
      else sec = Math.round(elapsedMs / 1000);
      sec = Math.max(1, Math.min(60, sec));
      if (this.audio) { try { this.audio.stop(); } catch (e) { /* not playing */ } }
      this.setData({ recording: false, playing: false });
      const tmp = res.apFilePath || res.tempFilePath || "";
      this._voiceTmp = tmp;
      this.dbg("rec.onStop", res);
      this.persistVoice(tmp, saved => {
        this.dbg("voice.saved", saved);
        this.setData({ voicePath: saved, voiceSeconds: sec, canSubmit: !!this.data.imagePath });
      });
      my.vibrate && my.vibrate({ type: "short" });
    });
    rm.onError(() => {
      this._recording = false;
      this.setData({ recording: false });
      my.showToast({ content: "录音失败，请检查麦克风权限", duration: 2000 });
    });
    this.recorder = rm;
  },

  startRecord() {
    if (this._recording || this._starting) return;
    this._starting = true;
    this._elapsedMs = 0;
    this.setData({ recording: true, voicePath: "", voiceSeconds: 0, playing: false });
    // 略微延迟启动，避开首次录音权限弹窗与松手事件的竞态
    setTimeout(() => {
      this._starting = false;
      if (!this.data.recording) return; // 用户已松手
      this._recording = true;
      this._startAt = Date.now();
      this.recorder.start({ duration: 60000, sampleRate: 16000, numberOfChannels: 1, format: "aac" });
    }, 150);
  },

  stopRecord() {
    if (!this._recording) {
      this.setData({ recording: false }); // 启动延迟期内松手：取消本次录音
      return;
    }
    this._elapsedMs = Date.now() - (this._startAt || 0); // 本地计时，显示秒数以此为准
    const held = this._elapsedMs;
    const MIN_MS = 600; // 太短按一下不构成有效录音，凑满最短时长再停
    const doStop = () => { try { this.recorder.stop(); } catch (e) { /* already stopped */ } };
    if (held < MIN_MS) setTimeout(doStop, MIN_MS - held);
    else doStop();
  },

  checkReady() {
    // 照片是唯一硬性条件；定位/语音均为可选项，不阻塞提交
    this.setData({ canSubmit: !!this.data.imagePath });
  },

  // ---------- 语音回放：多候选路径 × 原生/默认播放器 降级链，全程记日志 ----------
  togglePlay() {
    if (!this.data.voicePath) return;
    if (this.data.playing) {
      if (this.audio) { try { this.audio.stop(); } catch (e) { /* ignore */ } }
      this.setData({ playing: false });
      return;
    }
    const cands = [];
    const push = (p, n) => { if (p && !cands.some(c => c.p === p && c.n === n)) cands.push({ p, n }); };
    // 录音临时路径是支付宝官方保证可播放的音频源；优先它，其次用持久化后的缓存路径
    push(this._voiceTmp, true); push(this._voiceTmp, false);
    push(this.data.voicePath, true); push(this.data.voicePath, false);
    this._playQueue = cands; this._playIdx = 0;
    this.setData({ playing: true });
    this.playNext();
  },

  playNext() {
    const q = this._playQueue || [];
    if (this._playIdx >= q.length) {
      this.setData({ playing: false });
      this.dbg("play.allfail", "");
      my.showToast({ content: "播放失败，点诊断日志查看原因", duration: 2000 });
      return;
    }
    const c = q[this._playIdx++];
    if (this.audio) { try { this.audio.destroy(); } catch (e) { /* ignore */ } this.audio = null; }
    let a = null;
    try { a = c.n ? my.createInnerAudioContext({ useNativePlayer: true }) : my.createInnerAudioContext(); }
    catch (e) { a = my.createInnerAudioContext(); }
    a.volume = 1;
    if ("obeyMuteSwitch" in a) a.obeyMuteSwitch = false; // 绕过iOS静音拨片
    this.dbg("play.try", { path: c.p, native: c.n });
    const fs = my.getFileSystemManager && my.getFileSystemManager();
    if (fs && fs.getFileInfo) {
      fs.getFileInfo({ apFilePath: c.p, success: r => this.dbg("play.file", r), fail: e => this.dbg("play.filefail", e) });
    }
    // 支付宝事件名是 onCanPlay（大小写敏感），onCanplay 是微信写法，注册了也不会触发
    const onReady = () => { if (this.data.playing) { try { a.play(); } catch (e) { /* ignore */ } } };
    if (a.onCanPlay) a.onCanPlay(onReady);
    else if (a.onCanplay) a.onCanplay(onReady);
    a.onEnded(() => this.setData({ playing: false }));
    a.onError(err => { this.dbg("play.err", err); this.playNext(); });
    this.audio = a;
    a.src = c.p;
    try { a.play(); } catch (e) { /* ignore */ }
  },

  // ---------- 第三步：提交 ----------
  submit() {
    if (!this.data.canSubmit) {
      my.showToast({ content: "先拍一张现场照片", duration: 2000 });
      return;
    }
    const app = getApp();
    const hasLoc = !!this.data.location;
    const report = {
      clientReportId: "r" + Date.now() + Math.floor(Math.random() * 1000),
      imagePath: this.data.imagePath,
      voicePath: this.data.voicePath,
      lat: hasLoc ? this.data.location.lat : null,
      lng: hasLoc ? this.data.location.lng : null,
      capturedAt: new Date().toISOString(),
      status: "待同步"
    };
    this.saveLocal(report);

    my.showLoading({ content: "正在提交…" });
    my.uploadFile({
      url: app.globalData.apiBase + "/report",
      filePath: report.imagePath,
      fileName: "photo",
      formData: {
        lat: hasLoc ? String(report.lat) : "",
        lng: hasLoc ? String(report.lng) : "",
        locationMissing: hasLoc ? "0" : "1",
        capturedAt: report.capturedAt,
        voiceSeconds: String(report.voiceSeconds || 0),
        hasVoice: report.voicePath ? "1" : "0",
        clientReportId: report.clientReportId
      },
      success: res => {
        report.status = "已同步";
        this.updateLocal(report);
        if (report.voicePath) this.uploadVoice(report, app);
        my.hideLoading();
        my.navigateTo({ url: "/pages/result/result?ok=1" });
      },
      fail: () => {
        // 离线/弱网：暂存本地，恢复后自动补传
        const pending = my.getStorageSync({ key: "pendingReports" }).data || [];
        pending.push(report);
        my.setStorageSync({ key: "pendingReports", data: pending });
        my.hideLoading();
        my.navigateTo({ url: "/pages/result/result?ok=0" });
      }
    });
  },

  uploadVoice(report, app) {
    my.uploadFile({
      url: app.globalData.apiBase + "/report/voice",
      filePath: report.voicePath,
      fileName: "voice",
      formData: { clientReportId: report.clientReportId }
    });
  },

  saveLocal(report) {
    const local = my.getStorageSync({ key: "myReports" }).data || [];
    local.unshift(report);
    my.setStorageSync({ key: "myReports", data: local });
  },
  updateLocal(report) {
    const local = my.getStorageSync({ key: "myReports" }).data || [];
    const idx = local.findIndex(r => r.clientReportId === report.clientReportId);
    if (idx > -1) { local[idx] = report; my.setStorageSync({ key: "myReports", data: local }); }
  }
});
