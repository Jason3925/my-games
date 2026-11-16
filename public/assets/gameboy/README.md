# Gameboy 切图

正式 PNG 已放入本目录（命名与 [落地计划书](../../../docs/落地计划书.md) 一致）。

| 文件 | 用途 |
|------|------|
| `body.png` | 机身底板 |
| `screen.png` | 屏幕层（含边框 / 绿屏） |
| `dpad.png` / `dpad-shadow.png` | 方向键 |
| `btn-action.png` / `btn-action-shadow.png` | A/B |
| `btn-option.png` / `btn-option-shadow.png` | Select / Start |

图层坐标与绿屏内容区见 `src/gameboy/layout.ts`（设计像素，×30 = 源图像素）。

源副本仍可保留在仓库根目录 `assets/gameboy/`；运行时以 `public/` 为准。
