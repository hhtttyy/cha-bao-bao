# Design

## Theme

bold-brand — picked 2026-11-09. Why: 用户要"Apple 级设计质感 + 茶园真实粗粝感"的电影级品牌叙事页；bold-brand 的重磅展示字体与大色块最契合，定制成暗色电影调色板。

## Changed tokens

- `--bg:#0a0d0b` / `--surface:#131a16` — 近黑茶绿底，暴风雨夜基调
- `--accent:#6fcf97` / `--accent-deep:#2f6b4f` — 春茶绿（暗底用亮绿，品牌深绿用于暖底）
- `--gold:#e6b455` — 破晓暖金，情绪转折点
- `--cold:#7fa6c9` — 暴风雨冷蓝，气象站"不公"读数
- `--danger:#e0533d` — 愤怒红
- `--dawn-text/--dawn-muted/--dawn-surface/--dawn-border/--dawn-badge` — CTA 破晓暖光段专用暖色 token
- `--font-display:"Noto Serif SC"` 900 — 中文文学张力大标题；`--font-body:"Noto Sans SC"`；`--font-mono:"Space Mono"` 数据读数
- 影像以 base64 内嵌（--img-storm/dawn/station/farmer/aerial/logo/qr），保持单文件离线形态

## Rejected

Things the user said no to. Don't bring them back.

- 2026-11-09 小程序文案"茶山哨兵" — 用户要求品牌统一为"茶保宝"
- 2026-11-09 小程序出现保险/理赔字样 — 必须降敏才能过审（讲述站不受此限）

## Accepted

- 滚动驱动六幕电影 + 电影暗色→破晓暖光 + 小程序换肤（用户三选均确认推荐项）
- Apple 级精密排版运镜 + 纪实粗粝茶园影像（35mm 胶片颗粒、风化叶片、泥土感）

## Gate

Rules for `gate/run.mjs`. 本页是电影级滚动叙事，刻意突破"安静 UI"规则，以下 ignore 均为此项目正当设计意图。

```gate
ignore: R13   # why: 电影级大标题 clamp() 字号刻意超出 UI type scale（Apple 级展示排版），非组件界面
ignore: R16   # why: 滚动叙事用 >400ms 揭示动效、胶片颗粒无限循环、分幕 stagger 入场；motion.md 的 400ms 上限针对 UI 界面，不适用于电影叙事。已把语音条 height 动画改为 transform 避免卡顿
ignore: R06   # why: 每幕一个 mono kicker 场景标记是电影分幕语言，刻意保留 6 个
```