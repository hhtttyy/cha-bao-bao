# ds-flash-eval 修复记录（0.0.14）

> 本文件只存在于修复分支；`main` 仅记录问题与版本状态。
> 真机验收：2026-11-15 用户确认两个问题均已修复。
> 提审：`0.0.14`，审核单号 `3736364703`（AUDITING）。

## 一、基线现象（0.0.11）

1. **经纬度获取异常**：点「获取经纬度」后长时间停在“获取中”，坐标不显示。
2. **录音播放异常**：录音后点播放提示“文件已失效/文件不存在”；照片能正常保存显示，唯独音频不行。

## 二、根因

### 1. 经纬度卡在“获取中”

- 支付宝 `my.getLocation` 的 success 回调中，`latitude` / `longitude` 的官方类型均为 **String**（[官方文档](https://opendocs.alipay.com/mini/api/mkxuqd) 明确标注 String）。
- 旧代码直接 `res.latitude.toFixed(4)`：对字符串调用 `toFixed` 必然抛 `TypeError`。
- 抛错位置恰好发生在 `clearTimeout(this._locTimer)` 之后、`setData` 之前：6 秒兜底定时器已被清除，成功状态没写进去、失败状态也没机会写，`locState` 永久停在 `locating`，界面一直显示“获取中”。
- 本质：**平台返回类型假设错误 + 异常路径没有兜底**。

### 2. 录音无法播放

- 录音 `onStop` 返回的是临时路径 `tempFilePath`；支付宝 `InnerAudioContext` 官方保证的音频源是网络地址或录音临时路径（官方录音示例即 `src = res.tempFilePath`，[RecorderManager 文档](https://opendocs.alipay.com/mini/0769wz)）。
- 旧链路用 `my.saveFile({ apFilePath })` 持久化音频，失败再 `fs.copyFile` 到 `my.env.USER_DATA_PATH`：
  - `my.saveFile` 是面向图片的旧本地缓存接口（Android 落在 `/alipay/pictures/`），还可能移动临时文件；
  - 写入 `myfile://usr` 的用户文件路径也不在音频播放支持范围内；
  - 结果：持久化后的 `voicePath` 指向不可播放路径，原始临时路径又可能已失效，播放时只能报“文件已失效”。
- 附加问题：事件名写成了微信的 `onCanplay`；支付宝是大小写敏感的 `onCanPlay`，导致“可播放”事件注册了也不会触发。
- 旧代码注释“音频读不了 usr://，故不能本末倒置”的假设本身是错的：真正不可靠的是把音频交给 `my.saveFile`/usr:// 链路，而不是临时路径。

## 三、解决思路

### 1. 定位

- success 内统一 `Number()` 化，并对空值、非有限值、经纬度值域做校验；
- 成功路径先完成 `setData`，最后再清除兜底定时器；
- 整个 success 包 `try/catch`，任何取值/渲染异常都转入失败态；
- 兜底定时器改为按 `locState === "locating"` 判定（8 秒），即使 API 不回调也不会卡死；
- 失败、拒绝授权、超时都只提示，不阻塞提交（照片仍是唯一硬性条件）。

### 2. 录音

- 持久化改用官方录音示例的 `FileSystemManager.saveFile({ tempFilePath })`，返回的 `savedFilePath` 用于跨会话；
- 保留原始 `tempFilePath` 作为当次播放的首选音频源；持久化失败也保留临时路径，不再写入不可播放的 usr:// 路径；
- 播放候选按“临时路径 → 持久化路径”逐个降级；
- 事件名修正为 `onCanPlay`（保留 `onCanplay` 作兼容兜底），上报页与“我的上报”页同步修正。

## 四、验证

- 离线桩测试 9 组场景全部通过：String 经纬度、非法值、无回调超时、系统定位关闭、录音持久化/失败降级、临时路径优先播放、播放失败降级、记录页事件。
- 真机体验版 `0.0.14`：
  - 点「获取经纬度」数秒内显示“已获取 + 坐标”；
  - 录音后上报页可播放、“我的上报”可播放、杀掉小程序重进仍可播放；
  - 定位失败/拒绝不阻塞提交。
- 提审：`0.0.14`，审核单号 `3736364703`。

## 五、工具与排障方式复盘

### 为什么必须查官方网页，Skill 为什么不够

- `alipay-onboarding` Skill 是开放平台**操作类**入口：认证、签约、支付接入、小程序发布与管理（构建上传、体验版、提审等 CLI 流程），不包含小程序**运行时 API 语义与真机行为**。
- 本次两个根因都藏在平台 API 的细节里：返回字段类型、音频源支持范围、事件名大小写。这些细节以官方文档为准，Skill 里没有，也不应该靠猜。
- 官方文档可直接定位到证据：
  - `my.getLocation` success 的 `latitude/longitude` 是 **String**（[链接](https://opendocs.alipay.com/mini/api/mkxuqd)）；
  - 录音官方示例用 `fs.saveFile({ tempFilePath })` 持久化、用 `tempFilePath` 播放（[链接](https://opendocs.alipay.com/mini/0769wz)）；
  - `InnerAudioContext` 的音频源说明与 `onCanPlay` 事件名（[链接](https://opendocs.alipay.com/mini/08iqsg)）；
  - 本地临时文件/缓存文件/用户文件的路径协议差异（[链接](https://opendocs.alipay.com/mini-game/08v27x)）。
- 这比“改一版 → 上传 → 真机再试”的盲试快得多，也避免把微信经验直接套到支付宝上。

### 浏览官方网页定位信息的优势

- **权威可核对**：字段类型、示例代码、限制条件都来自平台文档，能直接推翻代码里的错误假设。
- **定位快**：一次检索就把“卡住/失效”缩小到具体 API 的具体字段与事件，减少反复试错。
- **可沉淀**：关键结论写进修复记录与代码注释，后续维护不再踩同一个坑。

### 小程序内报错日志功能的优势

- 小程序真机没有远程 console，用户反馈往往只有一句“打不开/没声音”，无法复现。
- 项目在页面内用 `dbg()` 做了时间戳 + 事件 + 原始返回值的日志缓冲，可一键复制反馈。
- 本次排障中，它把“玄学问题”变成“有证据的调用链”：定位回调字段、保存路径、播放候选的失败顺序都能对照。
- 建议保留并扩展为固定诊断点：`loc.ok` / `loc.fail` / `rec.onStop` / `voice.saved` / `play.try` / `play.err`，必要时给日志面板加折叠入口。

## 六、防回归清单

- 经纬度：先 `Number()` 再 `toFixed()`；任何 success 内的异常都必须落到失败态；清除兜底定时器放在成功状态写入之后。
- 录音：音频不要走 `my.saveFile`/usr:// 链路；优先使用录音临时路径，持久化用 `FileSystemManager.saveFile`。
- 播放：支付宝事件名是 `onCanPlay`（大小写敏感），不要照搬微信的 `onCanplay`。
- 文案：遵守降敏约定，不出现保险/理赔字样；类目保持“工具-效率”。
