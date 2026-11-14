# 茶保宝（Cha Bao Bao）

面向茶农的**田间灾害众包记录**演示作品：受灾后现场拍照（自动带经纬度与时间）、按住说话录入方言语音，形成带位置的灾害记录；保险端有据可查、政府端实时调度、科研端沉淀地面真值数据。

> 个人学习用途演示作品。**不含任何保险 / 金融 / 支付 / 交易 / 社交功能**，未对接后端服务器，数据仅存用户手机。支付宝主营类目：工具-效率。

本仓库包含两个交付物，统一做版本管理：

| 目录 | 内容 | 形态 |
|---|---|---|
| `site/` | 电影级滚动叙事讲述站（首页 + 茶农 / 保险商家 / 科研工作者 四个角色页） | 单文件静态 HTML（影像 base64 内嵌），已托管上线 |
| `miniapp/` | 支付宝小程序源码（首页 / 上报 / 我的上报 / 周边农情 / 结果 + 自定义 tabBar 组件） | 原生小程序（axml/acss/js） |

- 讲述站线上地址：https://tea-sentinel-n4qvlnvj0o4.qoder.zone
- 小程序 AppId：`2021007118622107`

---

## 当前版本

- **线上（RELEASE）**：`0.0.6`
- **过审待发布（WAIT_RELEASE）**：`0.0.11`（审核单号 3734786453）
- **最新体验版（待真机验证）**：`0.0.13`（qwen-eval 分支，含定位崩溃修复）
- 另有 `0.0.7` 过审未发布，已被取代。

> 约定：每次提审/发布后更新「当前版本」，并在下表追加一行变更记录。

## 版本变更记录

| 版本 | 日期 | 审核/发布状态 | 主要变更 |
|---|---|---|---|
| 0.0.1 | 2026-11-05 | 历史 | 初版 MVP：拍照/定位/语音/我的上报/周边农情/结果页 |
| 0.0.2 | 2026-11-05 | 历史 | 修复录音无法停止：稳定父节点挂触摸事件、onLoad 一次注册、延迟启动、最短时长 |
| 0.0.3 | 2026-11-05 | 历史 | 修复首拍照片不加载（多返回字段兜底）；录音秒数改本地计时 |
| 0.0.4 | 2026-11-05 | 历史 | 修复播放无声（useNativePlayer）；记录页语音播放 |
| 0.0.5 | 2026-11-05 | 历史 | 新增结果页 demo 提示；定位失败不阻塞提交 |
| 0.0.6 | 2026-11-05 | ✅ 通过并发布（**线上**，3733411095） | 降敏（去保险字样）+ 类目改工具-效率 |
| 0.0.7 | 2026-11-09 | 过审未发布（3733854617） | 品牌统一茶保宝 + 整端换肤 + 首页三步引导 |
| 0.0.8 | 2026-11-11 | 撤审 | 视觉微交互 v2：渐变按钮/三步进度/录音脉冲/空态/成功动效 |
| 0.0.9 | 2026-11-11 | 撤审 | 自定义 tabBar；录音 saveFile 持久化；定位显式按钮+授权引导 |
| 0.0.10 | 2026-11-11 | 撤审 | 录音复制 usr:// + 双播放器降级；定位手动+系统预检+6s 超时 |
| 0.0.11 | 2026-11-11 | ✅ 通过·待发布（3734786453） | 持久化改 saveFile 优先；多候选×双播放器；type0；内置 dbg 诊断日志 |
| 0.0.12 | 2026-11-14 | 体验版（qwen-eval） | 上报页接入诊断日志面板（开关/复制/滚动）；真机确认**录音可播放** |
| 0.0.13 | 2026-11-14 | 体验版·待验证（qwen-eval） | 定位坐标 Number() 转换修复字符串 toFixed 崩溃；首定位超时放宽 10s；去除 resource 网址无效 getFileInfo 诊断 |

---

## ⚠️ 已知问题（当前未解决，优先攻关）

### 1. 无法获取经纬度 —— ✅ 已修复（0.0.13 真机确认）

- 现象：`my.getLocation` 调用后无成功回调，一直"获取中"，授权弹窗不出现。
- 根因分析（按支付宝官方/社区资料）：
  1. **类目准入**：支付宝自 2023-11-15 起位置类接口仅对符合要求的主营行业开放。当前类目「工具-效率」疑似不在开放范围，平台层直接限制接口（代码无法绕过）。
  2. **三层授权**：系统定位开关 → 系统给支付宝的定位权限 → 小程序用户授权，缺一不可。
  3. `type` 精度：已改 `type:0`（仅经纬度，去掉拖慢的逆地理编码）。
- 已做缓解：改为**手动按钮触发**（取消拍照自动定位，避免弹窗冲突）；系统定位预检；6s 超时兜底；用 `my.getSetting` 区分"拒绝授权/普通失败"；**真实错误码暴露到 UI 与诊断日志**；定位不阻塞提交（照片为唯一硬性条件）。
- **根因已确认（0.0.12 真机日志）**：`my.getLocation` 实际**成功**（`loc.ok` 有坐标），但返回**字符串**坐标，代码 `res.latitude.toFixed(4)` 对字符串抛 TypeError，`setData` 未执行，UI 永远停"获取中"。**类目准入并非本次主因**。
- **修复（0.0.13，待真机验证）**：坐标统一 `Number()` 转换；首定位超时放宽到 10s。

### 2. 录音无法播放 —— ✅ 已修复（0.0.12 真机确认可播放）

- 现象：录音完成后点播放报"播放失败，文件可能已失效"。**照片能正常保存并在"我的上报"显示，唯独音频不行**。
- 根因分析：路径协议差异。照片复制到 `USER_DATA_PATH`（`usr://`）后 `<image>` 可读；但 `innerAudioContext` 在部分基础库上**读不了 `usr://` 音频**。早期把音频也复制到 `usr://` 的"持久化"反而把可播路径换成了不可播路径。
- 已做缓解：持久化改 `my.saveFile` 优先（返回 resource 沙盒路径，image/audio 均可读）；播放用「多候选路径 × 原生/默认双播放器」降级链；`obeyMuteSwitch=false` 绕过 iOS 静音拨片；`onCanplay` 后再 play；全程诊断日志。
- **已验证（0.0.12 真机日志）**：`voice.saved` 为 `https://resource/….audio`，原生播放器可读，录音正常播放。日志中 `play.filefail 错误2` 仅为诊断用 `getFileInfo` 不认 resource 网址的误报，0.0.13 已移除该无效诊断。

### 诊断手段

- 体验版/线上版**无远程 console 日志**；真机日志需 IDE「真机调试」或 mPaaS 日志服务。
- `miniapp/pages/report/report.js` 已内置 `dbg()` 诊断日志（记录拍照/录音/播放/定位每步真实返回），`toggleDebug()/copyDebug()` 可显示/复制（面板按钮待接入 axml）。

---

## 缺陷复盘：错误原因 → 解决思路（qwen-eval，均已真机验证）

> 方法论：不盲改。先内置 `dbg()` 诊断日志拿到真机真实返回（路径/错误码），再对照支付宝平台特性定根因，最后最小修改。以下"错误版"指 0.0.9–0.0.11，"修复版"指 0.0.12–0.0.13。

### A. 录音播放「文件已失效」

**错误版代码（0.0.10）**：把录音复制到 `USER_DATA_PATH` 再播放：
```js
const dest = my.env.USER_DATA_PATH + "/media_xxx.aac";   // usr:// 协议
fs.copyFile({ srcPath: tmp, destPath: dest, success: () => play(dest) });
```
**错误原因**：`<image>` 能读 `usr://`（所以照片正常），但 `innerAudioContext` 在该基础库**读不了 `usr://` 音频** → `onError`「文件已失效」。"持久化"反而把可播路径换成了不可播路径。另：单一播放器无降级、play 早于 canplay、iOS 静音拨片静音，都是叠加因素。

**解决思路（0.0.12–0.0.13）**：
```js
// 持久化改用 my.saveFile，返回 https://resource/… （image 与原生 audio 均可读）
my.saveFile({ apFilePath: tmp, success: r => play(r.apFilePath) });
// 播放：多候选路径 × 原生/默认双播放器降级；obeyMuteSwitch=false；onCanplay 后再 play
```
并移除对 `https://resource/` 调 `getFileInfo` 的无效诊断（它必报"参数无效"，纯误报）。

### B. 经纬度一直「获取中」

**错误版代码**：拍照后自动定位 + 对字符串坐标调 `toFixed`：
```js
takePhoto(){ ...; this.locate(); }              // 自动定位，与手动按钮抢授权弹窗
my.getLocation({ type: 1, success: res => {
  locationText: "北纬 " + res.latitude.toFixed(4)  // res.latitude 是字符串 → TypeError
}});                                            // 抛错后 setData 不执行 → UI 永停"获取中"
```
**错误原因**：真机日志 `loc.ok` 证明接口**成功**，但返回字符串坐标，`.toFixed` 抛 TypeError 中断 `setData`；叠加 `type:1` 逆地理编码慢、6s 超时过短、自动/手动定位冲突。

**解决思路（0.0.13）**：
```js
// 取消自动定位，仅手动按钮触发；type:0 只取经纬度
my.getLocation({ type: 0, success: res => {
  const lat = Number(res.latitude), lng = Number(res.longitude);  // 先转数值
  locationText: "北纬 " + lat.toFixed(4) + "，东经 " + lng.toFixed(4)
}});
// 超时放宽 10s；getSetting 区分"拒绝授权/失败"；locErr 暴露真实错误；定位不阻塞提交
```

**教训**：① 平台 API 返回值类型不可假设（坐标可能是字符串）；② 文件路径协议决定可读性（`usr://` vs `resource`），image 与 audio 能力不同；③ 真机无远程 console 时，内置诊断日志是定位根因的唯一可靠手段。

---

## 目录结构

```
site/            讲述站（单文件 HTML，直接打开或托管）
  index.html     首页·六幕电影叙事
  farmer.html    茶农页（基差叙事+功能按钮↔示意栏联动）
  insurance.html 保险商家页
  research.html  科研工作者页
  DESIGN.md      设计系统/调色板/gate 规则
miniapp/         支付宝小程序
  app.js/json/acss
  components/tab-bar/   自定义底部导航
  pages/{index,report,records,around,result}/
  assets/logo.png
```

## 开发与发布

- **讲述站**：纯静态，无构建步骤；改 `site/*.html` 后托管发布即可。设计遵循 `site/DESIGN.md`（bold-brand 定制电影调色板、Noto Serif SC 大标题、纪实粗粝影像、无页码、按钮用 SVG 禁 emoji）。
- **小程序**：用 `alipay-cli` 走 `build upload(SOURCE_AFTS) → experience create → audit submit → publish`。源码 zip 需包含 `app.* assets components pages`。
- 小程序文案保持**降敏**（不出现保险/理赔等字样）以过审；讲述站不受此限。

## 版本管理约定

- 本仓库为唯一源码真相； site 与 miniapp 同仓演进。
- 每次小程序发版在 README/CHANGELOG 记录版本号与审核单号；已知问题修复后从「已知问题」移除并补充根因结论。